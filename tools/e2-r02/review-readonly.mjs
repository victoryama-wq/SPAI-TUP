import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {root,config,testOffset,isolatedTest,verifyHub} from '../local/config.mjs';
assert.ok(isolatedTest && testOffset===10000);await verifyHub();
const out=resolve(root,'docs/evidence/r02-two-cycles'),base='http://127.0.0.1:4202';
const browser=await chromium.launch({headless:true}),page=await browser.newPage();
const commands=[];page.on('request',r=>{if(r.url().endsWith('/cycleCommand'))commands.push(r.postData());});
const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
try {
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();
 for(const width of [1280,768,390,320]){
  await page.setViewportSize({width,height:950});await page.goto(base+'/ciclos');const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(d=>d.contains(document.activeElement)));}
  await dialog.getByRole('button',{name:'Cerrar captura',exact:true}).click();await expect(dialog).toContainText('Al cerrar la captura, se bloquearán las operaciones académicas ordinarias del ciclo.');await expect(dialog).toHaveCount(1);await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.screenshot({path:resolve(out,`tabla-${width}.png`),fullPage:true});
  const action=page.getByRole('row').filter({has:page.locator('.cycle-code',{hasText:'27-1'})}).getByRole('button',{name:'Cerrar captura',exact:true});await action.scrollIntoViewIfNeeded();await action.focus();await expect(action).toBeEnabled();await page.screenshot({path:resolve(out,`acciones-${width}.png`)});
 }
 const viewer=await browser.newPage();
 await viewer.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
 await viewer.goto(base);await viewer.getByLabel('Cuenta ficticia del emulador').selectOption('demo.auxiliar@tecplayacar.edu.mx');await viewer.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(viewer.locator('nav')).toBeVisible();
 // Generic synthetic auxiliary has no delegation. The restored owner's grant
 // belongs only to the historical session and must not be copied into this test.
 await viewer.goto(base+'/ciclos');await expect(viewer.getByRole('heading',{name:'Acceso restringido',exact:true})).toBeVisible();
 await expect(viewer.getByRole('dialog')).toHaveCount(0);
 await expect(viewer.getByRole('button',{name:'Cerrar captura',exact:true})).toHaveCount(0);
 await expect(viewer.getByRole('button',{name:'Nuevo ciclo',exact:true})).toHaveCount(0);
 await expect(viewer.getByRole('button',{name:'Cerrar captura',exact:true})).toHaveCount(0);await viewer.close();
 assert.deepEqual(commands,[]);
 writeFileSync(resolve(out,'readonly.json'),JSON.stringify({at:new Date().toISOString(),status:'PASS',sizes:[1280,768,390,320],keyboardFocusContained:true,modalToConfirmationWithoutOverlap:true,cancelledWithoutCommand:true,rowActionAfterDismiss:true,undelegatedAuxiliaryAccessRestricted:true,commands:0},null,2));
 console.log('PASS responsive gallery, keyboard, modal-to-confirmation cancellation: zero commands');
}finally{await browser.close();}
