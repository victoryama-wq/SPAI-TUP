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
  await page.getByRole('button', { name: 'Roles personalizados', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', {name:'Directorio de roles personalizados'})).toBeVisible();
  await expect(page.getByRole('dialog').locator('form')).toHaveCount(0);
  await page.getByRole('button', { name: 'Crear rol', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', {name:'Crear rol',exact:true})).toHaveCount(0);
  await page.getByLabel('Nombre', { exact: true }).fill('Consulta sintética R01 UI');
  const row = page.locator('.permission-row').filter({ has: page.locator('strong', { hasText: /^Docentes$/ }) });
  await row.getByLabel('Editar', { exact: true }).check();
  await expect(row.getByLabel('Consultar', { exact: true })).toBeChecked();
  await row.getByLabel('Editar', { exact: true }).uncheck();
  await expect(row.getByLabel('Consultar', { exact: true })).toBeChecked();
  await row.getByLabel('Consultar', { exact: true }).uncheck();
  await expect(row.getByLabel('Editar', { exact: true })).not.toBeChecked();
  await row.getByLabel('Consultar', { exact: true }).check();
  await page.getByLabel('Programas (claves separadas por coma)').fill('ADM');
  await page.getByRole('button', { name: 'Revisar y confirmar', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Motivo del cambio').fill('Verificación sintética de controles R01');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.locator('.security-panel').getByRole('status')).toHaveText('Operación confirmada y auditada.');
  await page.getByRole('row').filter({hasText:'demo.coordinacion.a@'}).getByRole('button',{name:'Ver acceso',exact:true}).click();
  await expect(page.getByRole('option', { name: 'Consulta sintética R01 UI' })).toHaveCount(1);
  await page.screenshot({ path: '.local/test-results/r01-ui-administracion.png', fullPage: true });
});
test('Coordinación consulta sus módulos y no abre el directorio administrativo', async ({ page }) => {
  await login(page, 'demo.coordinacion.a@tecplayacar.edu.mx');
  await expect(page.locator('nav').getByText('Usuarios', { exact: true })).toHaveCount(0);
  await page.goto('/grupos');
  await expect(page.getByText('27-1 ADM 11 01', { exact: true }).first()).toBeVisible();
  await page.goto('/usuarios');
  await expect(page.getByRole('button', { name: 'Nuevo usuario' })).toHaveCount(0);
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
    await page.getByRole('row').filter({hasText:'demo.coordinacion.a@'}).getByRole('button',{name:'Ver acceso',exact:true}).click();
    await expect(page.getByRole('heading', { name: 'Asignar un rol preaprobado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo usuario' })).toHaveCount(0);
    await command({ action: 'revokeDelegation', targetId: result.data.delegationId, expectedRevision: 1 });
    await expect(page.getByRole('heading', { name: 'Asignar un rol preaprobado' })).toHaveCount(0);
    await expect(page.locator('nav').getByText('Usuarios', { exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(new URL('/acceso-restringido',test.info().project.use.baseURL).href);
    await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
    await expect(page.locator('.security-panel')).toHaveCount(0);
    await page.screenshot({ path: '.local/test-results/r01-ui-revocacion.png', fullPage: true });
  } finally { await terminate(client.db); await deleteApp(client.app); await deleteAdmin(admin); }
});

async function withSyntheticDb(work) {
  if (process.env.SPAI_LOCAL_SYNTHETIC !== 'true') throw new Error('Solo fixtures sintéticos');
  await verifyHub(); Object.assign(process.env,localEnvironment());
  const require=createRequire(resolve(root,'functions/package.json'));
  const {initializeApp,deleteApp}=require('firebase-admin/app'); const {getFirestore}=require('firebase-admin/firestore');
  const app=initializeApp({projectId:config.projectId},crypto.randomUUID());
  try { await work(getFirestore(app),require('./security/policy')); } finally {await deleteApp(app);}
}

test('CO-11 bloques, saludo conservado, dos pasos y modal accesible en escritorio y móvil', async ({page}) => {
  await login(page,'demo.sistemas@tecplayacar.edu.mx'); await page.goto('/usuarios');
  await page.locator('.panel-actions').getByRole('button',{name:'Nuevo usuario',exact:true}).click();
  const dialog=page.getByRole('dialog');
  for(const name of ['Datos de acceso','Alcance académico','Módulos disponibles']) await expect(dialog.getByRole('group',{name,exact:true})).toBeVisible();
  await expect(dialog.getByRole('combobox',{name:'Saludo',exact:true})).toHaveValue('Femenino');
  for(const [width,height,label] of [[1366,900,'desktop'],[390,844,'mobile']]) {
    await page.setViewportSize({width,height});
    await expect(dialog).toBeVisible();
    const layout=await dialog.evaluate(d=>{
      const header=d.querySelector('.editor-heading').getBoundingClientRect();
      const footer=d.querySelector('.editor-actions').getBoundingClientRect();
      const body=d.querySelector('.editor-body'); body.scrollTop=body.scrollHeight;
      const fieldsets=[...body.querySelectorAll(':scope > fieldset')].map(e=>e.getBoundingClientRect());
      return {modal:d.matches(':modal'),headerTop:header.top,footerBottom:footer.bottom,overflow:d.scrollWidth>d.clientWidth,sameColumn:Math.abs(fieldsets[0].left-fieldsets[1].left)<2};
    });
    expect(layout.modal).toBe(true); expect(layout.headerTop).toBeGreaterThanOrEqual(0);expect(layout.footerBottom).toBeLessThanOrEqual(height);expect(layout.overflow).toBe(false);
    expect(layout.sameColumn).toBe(true); // Cards form one stack beside the numbered guide.
    await dialog.locator('.editor-body').evaluate(e=>e.scrollTop=0);
    await page.screenshot({path:`.local/test-results/r01-review-${label}.png`});
  }
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await expect(page.locator('.panel-actions').getByRole('button',{name:'Nuevo usuario',exact:true})).toBeFocused();
  await page.setViewportSize({width:1366,height:900});
  await page.getByRole('row').filter({hasText:'demo.inactivo@tecplayacar.edu.mx'}).getByRole('button',{name:'Editar',exact:true}).click();
  await dialog.getByRole('combobox',{name:'Saludo',exact:true}).selectOption('Masculino');
  await dialog.getByRole('button',{name:'Revisar y confirmar',exact:true}).click();
  await dialog.getByLabel('Motivo del cambio').fill('Conservar saludo del perfil ficticio');
  await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(page.locator('.security-panel').getByRole('status')).toHaveText('Operación confirmada y auditada.');
  await page.getByRole('row').filter({hasText:'demo.inactivo@tecplayacar.edu.mx'}).getByRole('button',{name:'Editar',exact:true}).click();
  await expect(dialog.getByRole('combobox',{name:'Saludo',exact:true})).toHaveValue('Masculino');
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('button',{name:'Roles personalizados'}).click();
  await dialog.getByRole('article').filter({hasText:'Consulta sintética R01 UI'}).getByRole('button',{name:'Editar',exact:true}).click();
  await expect(dialog.getByLabel('Nombre',{exact:true})).toHaveValue('Consulta sintética R01 UI');
  await dialog.getByRole('button',{name:'Volver al directorio'}).click();
  await expect(dialog.getByRole('button',{name:'Crear rol',exact:true})).toBeVisible();
});

test('CO-02 CUSTOM VIEW muestra únicamente Asignaciones concedidas y ninguna acción operativa',async({page})=>{
  await withSyntheticDb(async(db,P)=>{
    const ref=db.doc('usuarios/demo-inactivo');const before=(await ref.get()).data();
    try {
      await ref.update({status:'Activo',baseRole:'CUSTOM',permissionSchemaVersion:2,permissions:P.levels({asignaciones:'VIEW'}),scope:P.scope({programs:['ADM'],cycles:['27-1']})});
      await login(page,'demo.inactivo@tecplayacar.edu.mx');await page.goto('/asignaciones');
      await expect(page.getByRole('heading',{name:'Asignaciones academicas',exact:true})).toBeVisible();
      await expect(page.locator('nav a')).toHaveCount(1);await expect(page.locator('nav')).toContainText('Asignaciones');
      await expect(page.locator('.assignment-table tbody tr, .table-panel tbody tr').first()).toBeVisible();
      await expect(page.locator('.table-panel')).not.toContainText('27-1 DER');
      await expect(page.getByRole('button',{name:/Editar asignacion|Eliminar asignacion|^Asignacion$/})).toHaveCount(0);
      await expect(page.getByText('No se pudo leer el catalogo de asignaciones.')).toHaveCount(0);
      await page.screenshot({path:'.local/test-results/r01-review-view.png',fullPage:true});
      await page.goto('/usuarios');await expect(page.getByRole('heading',{name:'Control de accesos — Seguridad y permisos'})).toHaveCount(0);
    } finally {await ref.set(before);}
  });
});

test('UI retira autorización temporal al vencer y al cambiar el mapeo en sesión abierta',async({page})=>{
  await withSyntheticDb(async(db,P)=>{
    const ref=db.doc('usuarios/demo-inactivo');const original=(await ref.get()).data();
    const mappingRef=db.doc('mapeos_permisos/demo-inactivo');
    const legacy={mappingVersion:P.MAPPING_VERSION,mappingRevision:1,profileRevision:1,issuedAtMillis:0,expiresAtMillis:Date.now()+7*86400000,permissionSchemaVersion:2,baseRole:'COORDINACION_ACADEMICA',permissions:P.levels({asignaciones:'VIEW'}),scope:P.scope({programs:['ADM'],cycles:['27-1']}),capabilities:[],status:'Activo'};
    const profile={...original,status:'Activo',permissionSchemaVersion:1,revision:1,legacyAuthorization:legacy};
    const mapping={status:'ACTIVE',version:P.MAPPING_VERSION,approvedBy:'demo-sistemas',baseRole:legacy.baseRole,revision:1,profileRevision:1};
    try {
      await mappingRef.set(mapping); await ref.set(profile);
      await login(page,'demo.inactivo@tecplayacar.edu.mx');await page.goto('/asignaciones');
      await expect(page.locator('nav')).toBeVisible();
      await ref.update({'legacyAuthorization.expiresAtMillis':1});
      await expect(page.getByRole('alert').filter({hasText:'La autorización temporal de siete días venció.'})).toBeVisible();
      await expect(page.locator('nav')).toHaveCount(0);
      await ref.set(profile);await expect(page.locator('nav')).toBeVisible();
      await mappingRef.update({status:'REVOKED'});
      await expect(page.getByRole('alert').filter({hasText:'La autorización temporal requiere revisión'})).toBeVisible();
      await expect(page.locator('nav')).toHaveCount(0);
    } finally {await ref.set(original);await mappingRef.delete();}
  });
});
