import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {root,config,isolatedTest,testOffset,accounts,password,localEnvironment,verifyHub} from '../local/config.mjs';
import {reviewFixtures,validateReviewFixtures} from './review-fixtures.mjs';
import {prepareReview} from './prepare-review.mjs';
assert.ok(isolatedTest && testOffset===10000);await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),A=require('firebase-admin/app'),F=require('firebase-admin/firestore');
const app=A.initializeApp({projectId:config.projectId},randomUUID()),db=F.getFirestore(app);
const out=resolve(root,'docs/evidence/r02-two-cycles');mkdirSync(out,{recursive:true});
const cases=[],check=async(name,kind,fn)=>{await fn();cases.push({name,kind,status:'PASS'});console.log('PASS',name);};
const snapshot=async d=>Object.fromEntries(await Promise.all(['ciclos','bitacora','eventos_ciclo','operaciones_ciclo'].map(async c=>[c,(await d.collection(c).orderBy('__name__').get()).docs.map(x=>[x.id,x.data()])])));
async function token(uid){const account=accounts.find(a=>a.uid===uid);const r=await fetch(`http://127.0.0.1:${config.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:account.email,password,returnSecureToken:true})});assert.ok(r.ok);return (await r.json()).idToken;}
async function callable(idToken,data){const r=await fetch(`http://127.0.0.1:${config.functions}/${config.projectId}/us-central1/cycleCommand`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${idToken}`},body:JSON.stringify({data})});return {status:r.status,body:await r.json()};}
const current=async()=>({id:'demo-27-1',...(await db.doc('ciclos/demo-27-1').get()).data()});
let browser;
try {
 await check('Preparation rerun verifies without modifying existing data','real isolated Firestore',async()=>{const before=await snapshot(db);await prepareReview();assert.deepEqual(await snapshot(db),before);});
 const sysToken=await token('demo-sistemas'),caToken=await token(accounts[2].uid);
 await check('HTTP rejects caller without cycle management, no partial writes','real callable',async()=>{const c=await current(),before=await snapshot(db);const r=await callable(caToken,{action:'closeCapture',cycleId:c.id,expectedRevision:c.revision,operationId:randomUUID()});assert.equal(r.body.error.status,'PERMISSION_DENIED');assert.doesNotMatch(r.body.error.message,/evaluation error|maximum of|Null value/i);assert.deepEqual(await snapshot(db),before);});
 // Complete lifecycle and concurrency in a separate named DB, never the review DB.
 const databaseId='r02-two-'+randomUUID().slice(0,8),isolated=F.getFirestore(app,databaseId),service=require('./cycles/service').createCycleService(isolated);
 const batch=isolated.batch();for(const d of reviewFixtures())batch.create(isolated.doc(d.path),d.data);await batch.commit();
 const cycle=async()=>({id:'demo-27-1',...(await isolated.doc('ciclos/demo-27-1').get()).data()});
 const act=async(action,c,extra={})=>service.execute({uid:'demo-sistemas'},{action,operationId:randomUUID(),...(c?{cycleId:c.id,expectedRevision:c.revision}:{}),...extra});
 const create=()=>act('create',null,{payload:{code:'28-1',label:'Nuevo ciclo ficticio'}});
 const rejected=async(fn,code,pattern)=>{const before=await snapshot(isolated);await assert.rejects(fn(),e=>e.code===code&&pattern.test(e.message));assert.deepEqual(await snapshot(isolated),before);};
 await check('Captura and Captura cerrada block creation; definitive close enables it; concurrent creation only one succeeds','real server service / named emulator DB',async()=>{
  assert.equal((await service.inspect({uid:'demo-sistemas'})).state,'READY');
  await rejected(create,'failed-precondition',/Ya existe/);
  await act('closeCapture',await cycle());assert.equal((await cycle()).status,'Captura cerrada');await rejected(create,'failed-precondition',/Ya existe/);
  await act('reopen',await cycle(),{reason:'Prueba aislada de reapertura'});await act('closeCapture',await cycle());await act('close',await cycle());
  assert.equal((await service.inspect({uid:'demo-sistemas'})).state,'NONE');
  const results=await Promise.allSettled([create(),create()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/Ya existe/);
  const created=results.find(r=>r.status==='fulfilled').value;assert.equal(created.status,'Preparacion');
  await rejected(create,'failed-precondition',/Ya existe/);await act('start',{id:created.cycleId,revision:created.revision});
 });
 await check('Real multiple-operative inconsistency blocks commands without partial writes','real server service / named emulator DB',async()=>{
  await isolated.doc('ciclos/negative-extra').create({code:'99-1',status:'Preparacion',revision:1});
  assert.equal((await service.inspect({uid:'demo-sistemas'})).state,'INCONSISTENT');
  await rejected(create,'failed-precondition',/CICLO_INCONSISTENTE/);
 });
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:950}});page.setDefaultTimeout(20000);
 const base='http://127.0.0.1:4202',allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
 await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();
 const dialog=page.getByRole('dialog'),row=page.getByRole('row').filter({has:page.locator('.cycle-code',{hasText:'27-1'})}),button=page.getByRole('button',{name:'Nuevo ciclo',exact:true});
 const ready=()=>page.waitForFunction(()=>window.ng?.getComponent(document.querySelector('spai-cycles-page'))?.contextReady());
 await check('Valid scenario, modal once per visit, Enter/close/Escape, table action after dismiss, responsive screenshots','real browser / isolated review',async()=>{
  for(const [i,width] of [1280,768,390,320].entries()){
   await page.setViewportSize({width,height:950});await page.goto(base+'/ciclos');await expect(dialog).toBeVisible();await expect(dialog).toContainText('Ciclo 27-1');await expect(dialog).toContainText('Captura');await expect(dialog).toContainText('30 sep 2026');
   await expect(page.getByText('Inconsistencia: hay varios ciclos operativos.',{exact:false})).toHaveCount(0);
   assert.equal(await page.locator('tbody tr').count(),2);await expect(button).toBeDisabled();
   await page.screenshot({path:resolve(out,`modal-${width}.png`)});const before=await snapshot(db);
   if(i===1) await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();else if(i===2)await page.keyboard.press('Escape');else await dialog.getByRole('button',{name:'Entendido',exact:true}).click();
   await expect(dialog).toHaveCount(0);await expect(row.getByRole('button',{name:'Cerrar captura',exact:true})).toBeEnabled();await expect(button).toBeDisabled();
   await page.evaluate(async()=>{await window.ng.getComponent(document.querySelector('spai-cycles-page')).cyclesRepository.refreshFromServer();});await ready();await expect(dialog).toHaveCount(0);assert.deepEqual(await snapshot(db),before);
   await page.screenshot({path:resolve(out,`tabla-${width}.png`)});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
 });
 await page.setViewportSize({width:1280,height:950});
 await check('Cancel confirmation preserves state; close via row blocks new cycle and keeps reopen/final-close actions; reopen returns Captura','real browser + HTTP callable',async()=>{
  const before=await snapshot(db);await row.getByRole('button',{name:'Cerrar captura',exact:true}).click();await expect(dialog).toContainText('Al cerrar la captura, se bloquearán las operaciones académicas ordinarias del ciclo.');await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.deepEqual(await snapshot(db),before);
  await row.getByRole('button',{name:'Cerrar captura',exact:true}).click();await dialog.getByRole('button',{name:'Cerrar captura',exact:true}).click();await expect(row.locator('.status-badge')).toHaveText('Captura cerrada');await ready();await expect(button).toBeDisabled();await expect(row.getByRole('button',{name:'Cerrar ciclo',exact:true})).toBeEnabled();
  await row.getByLabel('Motivo para reabrir').fill('Revisión técnica aislada; conservar Captura para demostración');await row.getByRole('button',{name:'Reabrir captura',exact:true}).click();await dialog.getByRole('button',{name:'Reabrir captura',exact:true}).click();await expect(row.locator('.status-badge')).toHaveText('Captura');await ready();
 });
 await check('Prepared confirmation rejected after server revision change; contextual error, no false success','real browser + HTTP callable',async()=>{
  await row.getByRole('button',{name:'Cerrar captura',exact:true}).click();const c=await current();
  const update=await callable(sysToken,{action:'schedule',cycleId:c.id,expectedRevision:c.revision,operationId:randomUUID(),date:c.tentativeCaptureCloseAt});assert.ok(update.body.result);
  const before=await snapshot(db);await dialog.getByRole('button',{name:'Cerrar captura',exact:true}).click();await expect(page.getByRole('alert')).toContainText('CONFLICTO_VERSION');await expect(row.locator('.status-badge')).toHaveText('Captura');assert.deepEqual(await snapshot(db),before);
 });
 await check('Loading, failure, Prep, closed capture, historical-only, multiple: correct creation gate without opening permanent card','presentation-only in memory / server cases above',async()=>{
  await page.evaluate(()=>{const c=window.ng.getComponent(document.querySelector('spai-cycles-page'));window.originalCycles=c.cyclesRepository.itemsSignal();});
  for(const state of ['loading','error','Preparacion','Captura cerrada','Cerrado','multiple']){
   await page.evaluate(state=>{const c=window.ng.getComponent(document.querySelector('spai-cycles-page')),r=c.cyclesRepository,source=window.originalCycles.find(x=>x.code==='27-1');r.itemsSignal.set(state==='multiple'?[source,{...source,id:'extra',code:'99-1'}]:[{...source,status:['loading','error'].includes(state)?'Captura':state}]);r.stateSignal.set(['loading','error'].includes(state)?state:'ready');window.ng.applyChanges(c);},state);
   if(!['loading','error'].includes(state))await ready();
   if(state==='Cerrado')await expect(button).toBeEnabled();else await expect(button).toBeDisabled();
   if(state==='Preparacion')await expect(page.getByRole('button',{name:'Iniciar captura',exact:true})).toBeEnabled();
   if(state==='multiple')await expect(page.getByText('Inconsistencia: hay varios ciclos operativos.',{exact:false})).toBeVisible();
  }
  await page.evaluate(async()=>{await window.ng.getComponent(document.querySelector('spai-cycles-page')).cyclesRepository.refreshFromServer();});await ready();await expect(button).toBeDisabled();await expect(dialog).toHaveCount(0);
 });
 await check('No date: accurate modal fallback on module entry','real browser + isolated callable',async()=>{
  const original=await current();
  try {
   const result=await callable(sysToken,{action:'schedule',cycleId:original.id,expectedRevision:original.revision,operationId:randomUUID(),date:null});assert.ok(result.body.result);
   await page.goto(base+'/ciclos');await expect(dialog).toBeVisible();await expect(dialog).toContainText('Sin fecha definida');await page.keyboard.press('Escape');
  } finally {
   const c=await current(),result=await callable(sysToken,{action:'schedule',cycleId:c.id,expectedRevision:c.revision,operationId:randomUUID(),date:original.tentativeCaptureCloseAt});assert.ok(result.body.result);
  }
 });
 await page.goto(base+'/ciclos');await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Entendido',exact:true}).click();
 const docs=[];for(const collection of await db.listCollections())for(const doc of (await collection.get()).docs)docs.push({path:doc.ref.path,data:doc.data()});
 const final=validateReviewFixtures(docs);assert.equal(final.cycles.find(c=>c.code==='27-1').date,'2026-09-30');
 writeFileSync(resolve(out,'results.json'),JSON.stringify({at:new Date().toISOString(),base:'16671e2b5b9021fa2069e2b0587e595338f7fb29 + local changes',status:'PASS',url:base+'/ciclos',project:config.projectId,firestore:config.firestore,namedDatabase:databaseId,cases,final,scope:'Demo scenario correction, NOT full R02 validation or owner acceptance'},null,2));
} finally {await browser?.close();await A.deleteApp(app);}
