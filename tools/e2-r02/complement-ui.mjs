import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {config,root,localEnvironment,verifyHub,complementTest} from '../local/config.mjs';
assert.equal(complementTest,true);assert.equal(config.firestore,28080);await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),admin=require('firebase-admin/app'),fs=require('firebase-admin/firestore');
const app=admin.initializeApp({projectId:config.projectId},'complement-ui'),db=fs.getFirestore(app),service=require('./cycles/service').createCycleService(db);
const base='http://127.0.0.1:4204',out=resolve(root,'docs/evidence/r02-complement');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:950}}),results=[];
page.setDefaultTimeout(30000);expect.configure({timeout:30000});
const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
const c=(id,code,status,specialsEnabled=false)=>({id,code,label:'Ciclo ficticio '+code,status,specialsEnabled,revision:1,createdAt:'2026-01-01T00:00:00Z',captureStartedAt:'2026-01-01T00:00:00Z',captureClosedAt:null,closedAt:status==='Cerrado'?'2026-09-30T00:00:00Z':null,tentativeCaptureCloseAt:null});
async function cycles(status,specials=false){const batch=db.batch();for(const doc of (await db.collection('ciclos').get()).docs)batch.delete(doc.ref);batch.set(db.doc('ciclos/demo-27-1'),c('demo-27-1','27-1',status,specials));batch.set(db.doc('ciclos/demo-26-3'),c('demo-26-3','26-3','Cerrado'));await batch.commit();await service.inspect({uid:'demo-sistemas'});}
const ready=()=>page.waitForFunction(()=>{const host=document.querySelector('spai-cycles-page');return host && window.ng?.getComponent(host)?.contextReady();});
const dialog=()=>page.getByRole('dialog');
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
async function enter(){await page.goto(base+'/ciclos');await ready();}
try {
 await cycles('Captura');await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible({timeout:30000});
 await check('Automatic notice only Captura; dismiss by button, cross and Escape without cycle writes',async()=>{
  for(const status of ['Preparacion','Captura cerrada','Cerrado']){await cycles(status);await enter();await expect(dialog()).toHaveCount(0);}
  for(const method of ['Entendido','Cerrar','Escape']){await cycles('Captura');await enter();await expect(dialog()).toBeVisible();await expect(dialog()).toContainText('Sin fecha definida');const before=(await db.doc('ciclos/demo-27-1').get()).data();if(method==='Escape')await page.keyboard.press('Escape');else await dialog().getByRole('button',{name:method,exact:true}).click();await expect(dialog()).toHaveCount(0);await service.inspect({uid:'demo-sistemas'});assert.deepEqual((await db.doc('ciclos/demo-27-1').get()).data(),before);await expect(page.getByRole('button',{name:'Nuevo ciclo',exact:true})).toBeDisabled();}
 });
 await check('No late auto-opening when entering closed capture then state changes to Captura',async()=>{
  await cycles('Captura cerrada');await enter();await db.doc('ciclos/demo-27-1').update({status:'Captura',revision:2});await service.inspect({uid:'demo-sistemas'});await expect(page.locator('tbody tr').first()).toContainText('Captura');await ready();await expect(dialog()).toHaveCount(0);
 });
 await check('Closed capture actions, whitespace reason, keyboard tooltip, responsive evidence and cancel',async()=>{
  await cycles('Captura cerrada');await enter();
  const row=page.locator('tbody tr').filter({has:page.locator('.cycle-code',{hasText:'27-1'})});
  const reopen=row.getByRole('button',{name:'Reabrir captura',exact:true});await expect(reopen).toBeDisabled();await row.getByLabel('Motivo para reabrir').fill('    ');await expect(reopen).toBeDisabled();
  await row.locator('.cycle-action-help').focus();await expect(row.locator('.cycle-action-help [role=tooltip]')).toBeVisible();
  for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:950});await row.locator('.cycle-icon-actions').scrollIntoViewIfNeeded();const boxes=await row.locator('.cycle-icon-actions button').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {y:b.y,w:b.width,h:b.height};}));assert.equal(boxes.length,3);assert.ok(boxes.every(b=>b.w===44&&b.h===44&&Math.abs(b.y-boxes[0].y)<1));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:resolve(out,`acciones-${width}.png`),fullPage:true});}
  await row.getByLabel('Motivo para reabrir').fill('Revisión ficticia');await expect(reopen).toBeEnabled();await reopen.click();await expect(dialog()).toContainText('Reabrir captura');const before=(await db.doc('ciclos/demo-27-1').get()).data();await dialog().getByRole('button',{name:'Cancelar',exact:true}).click();assert.deepEqual((await db.doc('ciclos/demo-27-1').get()).data(),before);await expect(reopen).toBeDisabled();
 });
 await check('Two histories: creation flow opens, confirmation blocked; explicit deletion modal and cancel',async()=>{
  await page.setViewportSize({width:1280,height:950});await cycles('Cerrado');await enter();await page.getByRole('button',{name:'Nuevo ciclo',exact:true}).click();await expect(dialog()).toContainText('Ya hay dos ciclos registrados');await expect(dialog().getByRole('button',{name:'Guardar ciclo',exact:true})).toBeDisabled();await page.screenshot({path:resolve(out,'limite-dos.png')});await dialog().getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.locator('tbody tr').filter({has:page.locator('.cycle-code',{hasText:'26-3'})}).getByRole('button',{name:'Eliminar ciclo histórico'}).click();await expect(dialog()).toContainText('26-3');await expect(dialog().getByRole('button',{name:'Eliminar ciclo',exact:true})).toBeDisabled();await dialog().getByLabel('Motivo de eliminación',{exact:false}).fill('Revisión de interfaz');await page.screenshot({path:resolve(out,'eliminar-historico.png')});await dialog().getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal((await db.collection('ciclos').get()).size,2);
 });
 await check('Assignment tabs: closed ordinary blocked; Specials only when enabled; live removal blocks open form',async()=>{
  const existing=(await db.collection('grupos').get()).docs.map(d=>d.data()).find(g=>g.cycleCode==='27-1'&&g.programAbbreviation==='ADM');
  assert.ok(existing);await db.doc('grupos/27_1_ADM_11_C_A').set({...existing,id:'27_1_ADM_11_C_A',fullGroup:'27-1 ADM 11 C.A',section:'C.A',modality:'Virtual',status:'Activo'});
  await cycles('Captura cerrada',true);await page.goto(base+'/asignaciones');
  const create=page.getByRole('button',{name:'Asignacion',exact:true});await expect(create).toBeVisible({timeout:30000});
  for(const name of ['Escolarizado','Ejecutivo','Virtual','Salud','Posgrados','Inglés']){await page.locator('.mode-tabs').getByRole('button',{name,exact:true}).click();await expect(create).toBeDisabled();}
  await page.locator('.assignment-create-control').focus();await expect(page.getByRole('tooltip')).toContainText('La captura está cerrada. Solo pueden registrarse asignaciones especiales autorizadas.');
  await page.screenshot({path:resolve(out,'asignacion-bloqueada.png')});
  await page.locator('.mode-tabs').getByRole('button',{name:'Especiales',exact:true}).click();await expect(create).toBeEnabled({timeout:30000});await create.click();await expect(dialog()).toBeVisible();
  assert.equal(await page.evaluate(()=>window.ng.getComponent(document.querySelector('spai-assignments-page')).assignmentTypeForForm()),'ESPECIAL');
  await db.doc('ciclos/demo-27-1').update({specialsEnabled:false,revision:2});await service.inspect({uid:'demo-sistemas'});
  await page.waitForFunction(()=>!window.ng.getComponent(document.querySelector('spai-assignments-page')).canSaveAssignmentForm());
  await expect(dialog().getByRole('button',{name:'Guardar asignacion',exact:true})).toBeDisabled();
  await page.screenshot({path:resolve(out,'especiales-revocadas.png')});
  await page.goto(base+'/asignaciones');await cycles('Cerrado',true);await page.locator('.mode-tabs').getByRole('button',{name:'Especiales',exact:true}).click();await expect(create).toBeDisabled();
 });
 await check('Real deletion flow on empty older history; server revision rejection leaves target intact',async()=>{
  // Repeatable synthetic fixture only, guarded above to the dedicated 28080 slot.
  // Never clear a marker belonging to any other target or to the shared demo.
  for(const id of ['code_24-1','id_ui-empty-24']) {
   const marker=db.doc('ciclos_retirados/'+id), saved=await marker.get();
   if(saved.exists){assert.equal(saved.data().cycleId,'ui-empty-24');await marker.delete();}
  }
  const batch=db.batch();for(const row of (await db.collection('ciclos').get()).docs)batch.delete(row.ref);batch.set(db.doc('ciclos/ui-empty-24'),c('ui-empty-24','24-1','Cerrado'));batch.set(db.doc('ciclos/ui-empty-25'),c('ui-empty-25','25-2','Cerrado'));await batch.commit();await service.inspect({uid:'demo-sistemas'});
  await enter();await page.getByRole('button',{name:'Eliminar ciclo histórico',exact:true}).click();await dialog().getByLabel('Motivo de eliminación',{exact:false}).fill('Histórico de prueba sin dependencias');await db.doc('ciclos/ui-empty-24').update({revision:2});await dialog().getByRole('button',{name:'Eliminar ciclo',exact:true}).click();await expect(page.getByRole('alert')).toContainText('CONFLICTO_VERSION');assert.equal((await db.doc('ciclos/ui-empty-24').get()).exists,true);
  await ready();await page.getByRole('button',{name:'Eliminar ciclo histórico',exact:true}).click();await expect(dialog().getByLabel('Motivo de eliminación',{exact:false})).toHaveValue('');await dialog().getByLabel('Motivo de eliminación',{exact:false}).fill('Confirmación aislada sin dependencias');await dialog().getByRole('button',{name:'Eliminar ciclo',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(1,{timeout:30000});assert.equal((await db.doc('ciclos/ui-empty-25').get()).exists,true);
 });
 await cycles('Captura');await page.setViewportSize({width:1280,height:950});await enter();await page.screenshot({path:resolve(out,'modal-captura-1280.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(out,'modal-captura-390.png')});
 writeFileSync(resolve(out,'ui.json'),JSON.stringify({at:new Date().toISOString(),results,environment:'isolated complement 28080 / 4204',humanAcceptance:false},null,2));
}catch(e){await page.screenshot({path:resolve(out,'failure.png'),fullPage:true});throw e;}finally{await browser.close();await admin.deleteApp(app);}
