import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {config,root,localEnvironment,complementTest,verifyHub} from '../local/config.mjs';
assert.equal(complementTest,true);await verifyHub();Object.assign(process.env,localEnvironment());
const out=resolve(root,'docs/evidence/new-cycle-disabled');mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:4204',browser=await chromium.launch({headless:true}),commands=[],cases=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:950}});page.setDefaultTimeout(20000);
 const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
 await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
 page.on('request',r=>{if(r.url().endsWith('/cycleCommand'))commands.push(r.postDataJSON().data);});
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();await page.goto(base+'/ciclos');
 await page.getByRole('dialog').getByRole('button',{name:'Entendido'}).click();
 const button=page.getByRole('button',{name:'Nuevo ciclo',exact:true}),control=page.locator('.new-cycle-control'),tip=page.getByRole('tooltip');await expect(button).toBeDisabled();
 for(const width of [1280,768,390,320]){
  await page.setViewportSize({width,height:950});await control.scrollIntoViewIfNeeded();await control.hover();await expect(tip).toHaveText('Ya existe un ciclo operativo. Debes cerrarlo definitivamente para crear otro.');await expect(tip).toBeVisible();await page.mouse.move(0,0);await control.focus();await expect(tip).toBeVisible();await page.keyboard.press('Enter');await page.keyboard.press('Space');await expect(page.getByRole('dialog')).toHaveCount(0);
  const colors=await button.evaluate(b=>({background:getComputedStyle(b).backgroundColor,text:getComputedStyle(b.querySelector('span')).color}));assert.deepEqual(colors,{background:'rgb(248, 250, 252)',text:'rgb(148, 163, 184)'});
  assert.ok(await tip.evaluate(t=>{const r=t.getBoundingClientRect();return t.contains(document.elementFromPoint(r.x+r.width/2,r.bottom-4));}),'La ayuda completa no debe quedar recortada ni tapada');
  await page.screenshot({path:resolve(out,`bloqueado-${width}.png`)});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 // Loading regression: the old context is ready while its new collection is not.
 await page.evaluate(()=>{const c=window.ng.getComponent(document.querySelector('spai-cycles-page')),r=c.cyclesRepository;window.reviewRows=r.itemsSignal();r.stateSignal.set('loading');r.contextReady.set(true);window.ng.applyChanges(c);});await expect(button).toBeDisabled();await control.focus();await expect(tip).toContainText('Cargando');
 await page.evaluate(()=>{const c=window.ng.getComponent(document.querySelector('spai-cycles-page'));c.openForm();});await expect(page.getByRole('dialog')).toHaveCount(0);
 for(const state of ['Preparacion','Captura','Captura cerrada','Cerrado','multiple','error']){
  await page.evaluate(state=>{const c=window.ng.getComponent(document.querySelector('spai-cycles-page')),r=c.cyclesRepository,source=window.reviewRows.find(c=>c.status==='Captura');r.itemsSignal.set(state==='multiple'?[source,{...source,id:'fixture-2',code:'99-9'}]:[{...source,status:state==='error'?'Captura':state}]);r.stateSignal.set(state==='error'?'error':'ready');window.ng.applyChanges(c);},state);
  if(state!=='error')await page.waitForFunction(()=>window.ng.getComponent(document.querySelector('spai-cycles-page')).contextReady());
  if(state==='Cerrado'){await expect(button).toBeEnabled();await button.click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();}
  else {await expect(button).toBeDisabled();await page.evaluate(()=>window.ng.getComponent(document.querySelector('spai-cycles-page')).openForm());await expect(page.getByRole('dialog')).toHaveCount(0);}
  cases.push({state,status:'PASS',kind:'presentation in memory, no writes'});
 }
 // Restore the real read, then observe a genuine refresh until server context is ready.
 await page.evaluate(async()=>{const c=window.ng.getComponent(document.querySelector('spai-cycles-page'));window.enabledDuringRefresh=[];const b=document.querySelector('.new-cycle-control button');window.buttonObserver=new MutationObserver(()=>window.enabledDuringRefresh.push(!b.disabled));window.buttonObserver.observe(b,{attributes:true,attributeFilter:['disabled']});await c.cyclesRepository.refreshFromServer();});
 await page.waitForFunction(()=>window.ng.getComponent(document.querySelector('spai-cycles-page')).contextReady());await expect(button).toBeDisabled();assert.deepEqual(await page.evaluate(()=>{window.buttonObserver.disconnect();return window.enabledDuringRefresh.filter(Boolean);}),[]);await expect(page.getByRole('dialog')).toHaveCount(0);assert.deepEqual(commands,[]);
 writeFileSync(resolve(out,'ui.json'),JSON.stringify({at:new Date().toISOString(),status:'PASS',widths:[1280,768,390,320],cases,disabledAfterDismiss:true,noEnableDuringRealRefresh:true,keyboardAndHoverHelp:true,creationRequests:0},null,2));
}finally{await browser.close();}

// Real server service + emulator transactions in a new NAMED database, never (default).
const require=createRequire(resolve(root,'functions/package.json'));
const A=require('firebase-admin/app'),F=require('firebase-admin/firestore');
const app=A.initializeApp({projectId:config.projectId},randomUUID());
const databaseId='cycle-button-'+randomUUID().slice(0,8),db=F.getFirestore(app,databaseId);
assert.notEqual(databaseId,'(default)');const service=require('./cycles/service').createCycleService(db);
try {
 for(const id of ['operator-a','operator-b'])await db.doc('usuarios/'+id).set({id,authUid:id,name:'Persona ficticia '+id,email:id+'@example.invalid',status:'Activo',permissionSchemaVersion:2,baseRole:'ADMIN_GENERAL',revision:1});
 await db.doc('ciclos/historical').set({code:'98-1',status:'Cerrado',revision:1});
 const draft={action:'create',operationId:randomUUID(),payload:{code:'99-2',label:'Propuesta ficticia A'}};
 assert.equal((await service.inspect({uid:'operator-a'})).state,'NONE');
 const winner=await service.execute({uid:'operator-b'},{action:'create',operationId:randomUUID(),payload:{code:'99-1',label:'Creación ficticia B'}});assert.equal(winner.status,'Preparacion');
 const snapshot=async()=>Object.fromEntries(await Promise.all(['ciclos','ciclo_control','bitacora','eventos_ciclo','operaciones_ciclo'].map(async c=>[c,(await db.collection(c).orderBy('__name__').get()).docs.map(d=>[d.id,d.data()])])));
 const before=await snapshot();await assert.rejects(service.execute({uid:'operator-a'},draft),e=>e.code==='failed-precondition'&&e.message==='Ya existe un ciclo operativo.');assert.deepEqual(await snapshot(),before);
 writeFileSync(resolve(out,'server.json'),JSON.stringify({at:new Date().toISOString(),status:'PASS',project:config.projectId,host:process.env.FIRESTORE_EMULATOR_HOST,databaseId,realServerService:true,transport:'Admin SDK emulator transaction; not HTTP callable',otherActorCreatedBeforeConfirmation:true,rejection:'failed-precondition: Ya existe un ciclo operativo.',noPartialWrites:true,sharedDefaultDatabaseWritten:false},null,2));console.log('PASS: UI loading/states/tooltip; real concurrent-creation rejection in separate named emulator database.');
}finally{await A.deleteApp(app);}
