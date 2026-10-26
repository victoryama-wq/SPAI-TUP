import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {config,root,complementTest,verifyHub,localEnvironment} from '../local/config.mjs';
assert.equal(complementTest,true);assert.equal(config.firestore,28080);await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),A=require('firebase-admin/app');
const app=A.initializeApp({projectId:config.projectId},'hallazgos-ui'),db=require('firebase-admin/firestore').getFirestore(app);
const out=resolve(root,'docs/evidence/r02-hallazgos-20261026');mkdirSync(out,{recursive:true});
const results=[],browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:900}});
page.setDefaultTimeout(30000);const check=expect.configure({timeout:30000});const base='http://127.0.0.1:4204';
const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
let behavior='pass';const pending=[],actions=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/userDeletionCommand',async route=>{
 const data=route.request().postDataJSON().data;actions.push(data.action);assert.equal(data.action,'prepare','UI regression never confirms a deletion');
 if(behavior==='failure')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'UNAVAILABLE'}})});
 if(behavior==='hold'){
  const response=await route.fetch();await new Promise(done=>pending.push(async()=>{try{await route.fulfill({response});}finally{done();}}));return;
 }
 return route.continue();
});
const snapshot=async()=>Object.fromEntries(await Promise.all(['usuarios','bitacora','operaciones_baja','eventos_baja','bajas_usuarios','bloqueos_identidad'].map(async c=>[c,(await db.collection(c).orderBy('__name__').get()).docs.map(d=>[d.id,d.data()])])));
try{
 // Historic schema examples are explicit fictitious records, never rewrites of existing events.
 const common={module:'Ciclos',action:'start',entity:'ciclos',entityId:'demo-27-1',createdAt:new Date().toISOString(),source:'SERVIDOR',integrity:'VERIFICADO'};
 await db.doc('bitacora/h01-readable').set({...common,description:'H01 identidad persistida ficticia',actorId:'actor-retirado-ficticio',actorName:'Actor histórico ficticio',actorRole:'Administración de Sistemas'});
 await db.doc('bitacora/h01-missing').set({...common,description:'H01 identidad no recuperable ficticia'});
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await check(page.locator('nav')).toBeVisible();
 await page.goto(base+'/bitacora');await page.getByPlaceholder('Modulo, accion, usuario, descripcion o folio').fill('H01');
 await check(page.getByText('Actor histórico ficticio',{exact:true})).toBeVisible();await check(page.getByText('Usuario no identificado',{exact:true})).toBeVisible();await page.screenshot({path:resolve(out,'audit-desktop.png'),fullPage:true});results.push({name:'H01: actor persistido sin perfil actual; desconocido no atribuido al consultante',status:'PASS'});
 await page.goto(base+'/usuarios');const row=page.locator('tbody tr').filter({hasText:'Usuario inactivo DEMO'}),button=row.getByRole('button',{name:'Eliminar usuario',exact:true}),dialog=page.getByRole('dialog');await check(button).toBeEnabled();const before=await snapshot();
 for(const [dismiss,width] of [['Cancelar',1280],['Cerrar editor',390],['Escape',768]]){
  await page.setViewportSize({width,height:900});behavior='hold';await button.click();await check(dialog.getByText('Verificando identidad y autorización…')).toBeVisible();await check.poll(()=>pending.length).toBe(1);
  await check(dialog.getByRole('button',{name:'Eliminar usuario',exact:true})).toBeDisabled();await dialog.screenshot({path:resolve(out,`deletion-pending-${width}.png`)});
  if(dismiss==='Escape')await page.keyboard.press('Escape');else await dialog.getByRole('button',{name:dismiss,exact:true}).click();
  await check(dialog).not.toBeVisible();await check(button).toBeFocused();await pending.shift()();await page.waitForTimeout(150);await check(dialog).not.toBeVisible();results.push({name:'H02: cancelar verificación mediante '+dismiss+' a '+width+'px',status:'PASS'});
 }
 // A response from A cannot populate B, including its busy state.
 behavior='hold';await button.click();await check.poll(()=>pending.length).toBe(1);await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
 const other=page.locator('tbody tr').filter({hasText:'demo.coordinacion.a@tecplayacar.edu.mx'}).getByRole('button',{name:'Eliminar usuario',exact:true});await other.click();await check.poll(()=>pending.length).toBe(2);
 await pending.shift()();await check(dialog.getByText('Verificando identidad y autorización…')).toBeVisible();await check(dialog).not.toContainText('Usuario inactivo DEMO');await pending.shift()();await check(dialog.getByLabel('Motivo de la baja')).toBeEnabled();await check(dialog.getByLabel('Motivo de la baja')).toHaveValue('');await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();results.push({name:'H02: destinatarios y respuestas tardías aislados',status:'PASS'});
 behavior='hold';await button.click();await check.poll(()=>pending.length).toBe(1);await check(dialog.getByRole('alert')).toContainText('tardó demasiado',{timeout:20000});await check(dialog.getByRole('button',{name:'Eliminar usuario',exact:true})).toBeDisabled();await pending.shift()();await page.waitForTimeout(150);await check(dialog.getByRole('button',{name:'Eliminar usuario',exact:true})).toBeDisabled();await dialog.screenshot({path:resolve(out,'deletion-timeout.png')});
 behavior='failure';await dialog.getByRole('button',{name:'Reintentar verificación'}).click();await check(dialog.getByRole('alert')).toContainText('No se pudo verificar');await check(dialog.getByRole('button',{name:'Eliminar usuario',exact:true})).toBeDisabled();
 behavior='pass';await dialog.getByRole('button',{name:'Reintentar verificación'}).click();await check(dialog.getByLabel('Motivo de la baja')).toBeEnabled();await dialog.getByLabel('Motivo de la baja').fill('Motivo ficticio sin confirmar baja');await check(dialog.getByRole('button',{name:'Eliminar usuario',exact:true})).toBeEnabled();await dialog.screenshot({path:resolve(out,'deletion-ready-mobile.png')});await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();results.push({name:'H02: timeout 15s, error técnico y reintento real; no confirmar tras fallo',status:'PASS'});
 assert.deepEqual(await snapshot(),before);assert.equal(errors.length,0);assert.ok(actions.every(a=>a==='prepare'));
}finally{
 writeFileSync(resolve(out,'ui.json'),JSON.stringify({at:new Date().toISOString(),results,errors,actions,transportSimulation:'Only deletion prepare delays/failure; retry uses real isolated Functions. No deletion confirmed in this UI suite.',humanAcceptance:false},null,2));await browser.close();await A.deleteApp(app);
}
