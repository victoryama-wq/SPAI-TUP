import { test, expect } from '@playwright/test';
import { verifyHub, root, config, localEnvironment, password } from '../local/config.mjs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runtime, localConfig } from '../local/tests/runtime.mjs';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { terminate } from 'firebase/firestore';
import { deleteApp } from 'firebase/app';
test.beforeEach(async ({ page }) => {
  await verifyHub();
  // Same release acknowledgement the login writes; avoid the existing one-off
  // forced logout obscuring the permission interaction under test.
  await page.addInitScript(() => localStorage.setItem('spai.session.release', '2026-08-03-operational-dashboard'));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
  });
});
async function login(page, email) {
  await page.goto('/');
  await page.getByLabel('Cuenta ficticia del emulador').selectOption(email);
  await page.getByRole('button', { name: 'Ingresar a DEMO', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ingresar a DEMO', exact: true })).toHaveCount(0);
  await expect(page.locator('nav')).toBeVisible();
}
test('Administración configura Consultar/Editar y confirma un rol auditado', async ({ page }) => {
  await login(page, 'demo.sistemas@tecplayacar.edu.mx');
  await page.goto('/usuarios');
  await page.getByRole('button', { name: 'Definir rol personalizado', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Consulta sintética R01 UI');
  const row = page.locator('.permission-row').filter({ has: page.locator('strong', { hasText: /^docentes$/ }) });
  await row.getByLabel('Editar', { exact: true }).check();
  await expect(row.getByLabel('Consultar', { exact: true })).toBeChecked();
  await row.getByLabel('Editar', { exact: true }).uncheck();
  await expect(row.getByLabel('Consultar', { exact: true })).toBeChecked();
  await row.getByLabel('Consultar', { exact: true }).uncheck();
  await expect(row.getByLabel('Editar', { exact: true })).not.toBeChecked();
  await row.getByLabel('Consultar', { exact: true }).check();
  await page.getByLabel('Programas (claves separadas por coma)').fill('ADM');
  await page.getByLabel('Motivo del cambio').fill('Verificación sintética de controles R01');
  await page.getByRole('button', { name: 'Revisar y confirmar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.locator('.security-panel').getByRole('status')).toHaveText('Operación confirmada y auditada.');
  await expect(page.getByRole('option', { name: 'Consulta sintética R01 UI' })).toHaveCount(1);
  await page.screenshot({ path: '.local/test-results/r01-ui-administracion.png', fullPage: true });
});
test('Coordinación consulta sus módulos y no abre el directorio administrativo', async ({ page }) => {
  await login(page, 'demo.coordinacion.a@tecplayacar.edu.mx');
  await expect(page.locator('nav').getByText('Usuarios', { exact: true })).toHaveCount(0);
  await page.goto('/grupos');
  await expect(page.getByText('27-1 ADM 11 01', { exact: true }).first()).toBeVisible();
  await page.goto('/usuarios');
  await expect(page.getByRole('button', { name: 'Nuevo perfil institucional' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('demo.inactivo@tecplayacar.edu.mx');
});

test('Una sesión auxiliar abierta pierde el directorio al revocar su delegación', async ({ page }) => {
  if (process.env.SPAI_LOCAL_SYNTHETIC !== 'true') throw new Error('Solo emuladores con fixtures sintéticos.');
  Object.assign(process.env, localEnvironment());
  const require = createRequire(resolve(root, 'functions/package.json'));
  const { initializeApp, deleteApp: deleteAdmin } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const admin = initializeApp({ projectId: config.projectId }, 'ui-r01');
  const db = getFirestore(admin);
  const client = runtime.initializeFirebaseRuntime(localConfig, 'ui-admin-command');
  try {
    await signInWithEmailAndPassword(client.auth, 'demo.sistemas@tecplayacar.edu.mx', password);
    const command = data => httpsCallable(client.functions, 'securityCommand')({ operationId: crypto.randomUUID(), reason: 'Revocación sintética con sesión UI abierta', ...data });
    const helper = (await db.doc('usuarios/demo-auxiliar').get()).data();
    const result = await command({ action: 'grantDelegation', targetId: 'demo-auxiliar', expectedRevision: helper.revision, value: { permissions: { grupos: 'VIEW' }, capabilities: ['MANAGE_CUSTOM_ROLES'], scope: { programs: ['ADM'] } } });
    await login(page, 'demo.auxiliar@tecplayacar.edu.mx');
    await page.goto('/usuarios');
    await expect(page.getByRole('heading', { name: 'Asignar un rol preaprobado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo perfil institucional' })).toHaveCount(0);
    await command({ action: 'revokeDelegation', targetId: result.data.delegationId, expectedRevision: 1 });
    await expect(page.getByRole('heading', { name: 'Asignar un rol preaprobado' })).toHaveCount(0);
    await expect(page.locator('nav').getByText('Usuarios', { exact: true })).toHaveCount(0);
    await expect(page).toHaveURL('http://127.0.0.1:4200/');
    await expect(page.locator('.security-panel')).toHaveCount(0);
    await page.screenshot({ path: '.local/test-results/r01-ui-revocacion.png', fullPage: true });
  } finally { await terminate(client.db); await deleteApp(client.app); await deleteAdmin(admin); }
});
