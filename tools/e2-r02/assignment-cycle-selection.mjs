import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect as baseExpect} from '@playwright/test';
import {config,root,localEnvironment,verifyHub,complementTest} from '../local/config.mjs';
assert.equal(complementTest,true);assert.equal(config.firestore,28080);await verifyHub();Object.assign(process.env,localEnvironment());
const expect=baseExpect.configure({timeout:30000});
const require=createRequire(resolve(root,'functions/package.json')),A=require('firebase-admin/app'),F=require('firebase-admin/firestore');
const app=A.initializeApp({projectId:config.projectId},'assignment-cycle-selection'),db=F.getFirestore(app);
const out=resolve(root,'docs/evidence/assignment-cycle-selection');mkdirSync(out,{recursive:true});
const current=(await db.doc('ciclos/demo-27-1').get()).data(),history=(await db.doc('ciclos/demo-26-3').get()).data(),template=(await db.doc('asignaciones/demo-asignacion-a').get()).data();assert.ok(current&&history&&template);
const batch=db.batch();for(const row of (await db.collection('ciclos').get()).docs)batch.delete(row.ref);for(const row of (await db.collection('asignaciones').get()).docs)batch.delete(row.ref);
batch.set(db.doc('ciclos/demo-27-1'),{...current,status:'Captura',specialsEnabled:false});batch.set(db.doc('ciclos/demo-26-3'),{...history,status:'Cerrado'});
batch.set(db.doc('asignaciones/demo-asignacion-a'),{...template,subjectName:'INTRO ACTUAL',status:'EN_CAPTURA'});
batch.set(db.doc('asignaciones/selector-historical'),{...template,id:'selector-historical',cycle:'26-3',group:'26-3 ADM 11 01',subjectName:'INTRO HISTORICA',moodleId:'HISTORICA',normalizedMoodleId:'historica',status:'EN_REVISION'});await batch.commit();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:1000}}),base='http://127.0.0.1:4204',results=[];page.setDefaultTimeout(30000);
const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
const check=async(name,fn)=>{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);};
const selector=page.getByLabel('Ciclo de consulta',{exact:true}),create=page.getByRole('button',{name:'Asignacion',exact:true});
const ready=()=>page.waitForFunction(()=>{const host=document.querySelector('spai-assignments-page');return host && window.ng?.getComponent(host)?.assignmentsReady();});
try{
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();await page.goto(base+'/asignaciones');await ready();
 await check('One selector inside blue header filters; current and historical data, filters, counts and operative indicator',async()=>{
  await expect(selector).toHaveValue('demo-27-1');await expect(selector).toHaveCount(1);await expect(page.locator('.panel-title select')).toHaveCount(2);
  await expect(page.locator('tbody')).toContainText('INTRO ACTUAL');await page.getByLabel('Estado',{exact:true}).selectOption('EN_CAPTURA');await page.getByLabel('Buscar asignaciones').fill('INTRO');
  await selector.selectOption('demo-26-3');await ready();await expect(page.locator('tbody')).toContainText('INTRO HISTORICA');await expect(page.locator('tbody')).not.toContainText('INTRO ACTUAL');await expect(page.getByLabel('Estado',{exact:true})).toHaveValue('TODOS');await expect(page.getByLabel('Buscar asignaciones')).toHaveValue('INTRO');
  await expect(page.locator('.cycle-chip')).toContainText('Ciclo operativo');await expect(page.locator('.cycle-chip')).toContainText('27-1');await expect(page.locator('.tracking-card')).toContainText('Consulta histórica');
  assert.deepEqual(await page.evaluate(()=>{const c=window.ng.getComponent(document.querySelector('spai-assignments-page'));return [c.captureCount(),c.reviewCount()];}),[0,1]);await expect(create).toBeDisabled();for(const b of await page.locator('tbody button').all())await expect(b).toBeDisabled();
 });
 await check('A same-session profile refresh preserves an authorized historical selection',async()=>{
  const profile=db.doc('usuarios/demo-sistemas'),before=(await profile.get()).data(),stamp='Selector '+Date.now();await profile.update({area:stamp});
  await page.waitForFunction(stamp=>window.ng.getComponent(document.querySelector('spai-assignments-page')).session()?.appUser?.area===stamp,stamp);await ready();await expect(selector).toHaveValue('demo-26-3');await profile.update({area:before.area??''});
 });
 await check('Rapid switches clear old rows synchronously; latest selection wins',async()=>{
  const immediate=await page.evaluate(()=>{const c=window.ng.getComponent(document.querySelector('spai-assignments-page'));c.selectCycle({target:{value:'demo-27-1'}});return {rows:c.assignments().length,ready:c.assignmentsReady()};});assert.deepEqual(immediate,{rows:0,ready:false});
  for(const id of ['demo-26-3','demo-27-1','demo-26-3'])await selector.selectOption(id);await ready();await expect(page.locator('tbody')).toContainText('INTRO HISTORICA');await expect(page.locator('tbody')).not.toContainText('INTRO ACTUAL');
 });
 await check('Open draft closes on cycle change; closed capture and Specials restrictions preserved',async()=>{
  await selector.selectOption('demo-27-1');await ready();await expect(create).toBeEnabled();await create.click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(()=>window.ng.getComponent(document.querySelector('spai-assignments-page')).selectCycle({target:{value:'demo-26-3'}}));await expect(page.getByRole('dialog')).toHaveCount(0);await ready();await expect(create).toBeDisabled();
  await db.doc('ciclos/demo-27-1').update({status:'Captura cerrada',specialsEnabled:false});await selector.selectOption('demo-27-1');await ready();await expect(create).toBeDisabled();await page.locator('.mode-tabs').getByRole('button',{name:'Especiales',exact:true}).click();await expect(create).toBeDisabled();await page.locator('.mode-tabs').getByRole('button',{name:'Escolarizado',exact:true}).click();
 });
 await check('Desktop, tablet and mobile selector inside blue header filters without overflow',async()=>{
  await selector.selectOption('demo-26-3');await ready();for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:1000});await selector.scrollIntoViewIfNeeded();const bounds=await page.evaluate(()=>{const bar=document.querySelector('.cycle-selection'),header=document.querySelector('.panel-title .filters');return {adjacent:bar.parentElement===header,overflow:bar.scrollWidth>bar.clientWidth,right:bar.getBoundingClientRect().right,width:innerWidth};});assert.equal(bounds.adjacent,true);assert.equal(bounds.overflow,false);assert.ok(bounds.right<=width);await page.screenshot({path:resolve(out,`selector-${width}.png`)});}
 });
 await check('Loading, empty and query error are distinct presentation states; not zero-confirmed',async()=>{
  for(const state of ['loading','error']){await page.evaluate(state=>{const c=window.ng.getComponent(document.querySelector('spai-assignments-page'));c.cyclesRepository.stateSignal.set(state);},state);await expect(selector).toBeDisabled();await expect(page.locator('.status-summary-list')).not.toContainText('0');await expect(page.locator('tbody')).not.toContainText('INTRO HISTORICA');if(state==='error'){await expect(page.getByRole('button',{name:'Reintentar ciclos'})).toBeVisible();await page.screenshot({path:resolve(out,'error-ciclos.png')});}}
  await page.evaluate(()=>{const r=window.ng.getComponent(document.querySelector('spai-assignments-page')).cyclesRepository;r.itemsSignal.set([]);r.stateSignal.set('ready');});await expect(page.locator('.cycle-selection')).toContainText('No hay ciclos consultables');await expect(selector).toBeDisabled();
 });
 await check('Restricted real session sees only its authorized cycle; unavailable IDs cannot be selected',async()=>{
  const other=await browser.newPage();await other.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());await other.goto(base);await other.getByLabel('Cuenta ficticia del emulador').selectOption('demo.r01.consulta@tecplayacar.edu.mx');await other.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(other.locator('nav')).toBeVisible();await other.goto(base+'/asignaciones');await expect(other.getByLabel('Ciclo de consulta',{exact:true})).toHaveValue('demo-27-1');await expect(other.locator('#assignment-consultation-cycle option')).toHaveCount(1);
  assert.equal(await other.evaluate(()=>{const r=window.ng.getComponent(document.querySelector('spai-assignments-page')).assignmentsRepository;r.selectCycle('demo-26-3');return r.selectedCycle()?.code;}),'27-1');await other.close();
 });
 writeFileSync(resolve(out,'ui.json'),JSON.stringify({at:new Date().toISOString(),results,environment:'isolated 28080 / 4204',presentationFaultInjection:'loading/error/empty only; real session and selection otherwise',humanAcceptance:false},null,2));
}catch(e){await page.screenshot({path:resolve(out,'failure.png')});throw e;}finally{await browser.close();await A.deleteApp(app);}
