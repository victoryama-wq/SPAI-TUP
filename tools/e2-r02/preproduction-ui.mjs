import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {config,root,preproductionTest,verifyHub,localEnvironment} from '../local/config.mjs';
assert(preproductionTest);assert.equal(config.firestore,39080);await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),A=require('firebase-admin/app'),app=A.initializeApp({projectId:config.projectId},'preproduction-ui');
const db=require('firebase-admin/firestore').getFirestore(app),out=resolve(root,'docs/evidence/r02-preproduction-20261028');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:950}}),base='http://127.0.0.1:4207',results=[];
const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());page.setDefaultTimeout(30000);const check=expect.configure({timeout:30000});
const shot=name=>page.screenshot({path:resolve(out,name+'.png'),fullPage:true});
async function record(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
try {
 await db.doc('roles_personalizados/preprod-legacy').set({name:'Definición heredada ficticia',status:'Activo',permissions:{dashboard:'view'}});
 await db.doc('roles_personalizados/preprod-retired').set({name:'Retirada ficticia',status:'RETIRED',permissions:{dashboard:'VIEW'}});
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await check(page.locator('nav')).toBeVisible();
 await record('UI01: active canonical definitions counted; legacy/retired distinguished without granting access',async()=>{
  await page.goto(base+'/usuarios');await check(page.locator('.users-metrics article').filter({hasText:'Roles disponibles'}).locator('strong')).toHaveText('1');
  await check(page.getByText(/1 definición\(es\) con formato heredado/)).toBeVisible();await shot('users-1280');
  await page.getByRole('button',{name:'Roles personalizados',exact:true}).click();const legacy=page.getByRole('dialog').locator('article').filter({hasText:'Definición heredada ficticia'});await check(legacy).toContainText('Formato heredado: requiere revisión');await check(legacy.getByRole('button')).toHaveCount(0);await shot('roles-1280');await page.keyboard.press('Escape');
 });
 await record('U01: completed deletion displays recorded requester, target, result and reason',async()=>{
  await page.goto(base+'/bitacora');await page.getByPlaceholder('Modulo, accion, usuario, descripcion o folio').fill('BAJA_AUTH_COMPLETADA');
  const entry=page.locator('.audit-entry').first();await check(entry).toContainText('Sistemas DEMO');await check(entry).toContainText('Cuenta ficticia para confirmar baja');await check(entry).toContainText('ausencia de la cuenta confirmada');await check(entry).not.toContainText('Usuario no identificado');await entry.locator('summary').click();await check(entry).toContainText('Baja ficticia autorizada para verificación funcional');await check(entry).toContainText('Proceso de servidor');await shot('auth-completed-1280');
 });
 await record('UI02: Cycles loading/error/denied/empty are distinct; loading never renders zero',async()=>{
  await page.goto(base+'/ciclos');await page.waitForFunction(()=>{const el=document.querySelector('spai-cycles-page');return el && window.ng.getComponent(el)?.cyclesReady();});
  for(const state of ['loading','error','denied','restricted']) {
   await page.evaluate(state=>{const c=window.ng.getComponent(document.querySelector('spai-cycles-page'));c.cyclesRepository.stateSignal.set(state);},state);
   await check(page.locator('.cycle-summary strong')).toHaveText(['—','—','—','—']);await check(page.getByRole('button',{name:'Nuevo ciclo',exact:true})).toBeDisabled();
   await check(page.locator('tbody')).toContainText(({loading:'Cargando datos autorizados',error:'No se pudo completar',denied:'Acceso denegado',restricted:'Sin ámbito'})[state]);
   if(state==='loading')await shot('cycles-loading-1280');
  }
  await page.evaluate(()=>{const r=window.ng.getComponent(document.querySelector('spai-cycles-page')).cyclesRepository;r.itemsSignal.set([]);r.stateSignal.set('ready');});
  await check(page.locator('.cycle-summary strong')).toHaveText(['0','0','0','0']);await check(page.locator('tbody')).toContainText('No hay ciclos en la consulta autorizada.');await page.reload();
 });
 await record('UI02: Dashboard metrics do not expose provisional totals',async()=>{
  await page.goto(base+'/dashboard');await page.waitForFunction(()=>{const el=document.querySelector('spai-dashboard-page');return el && window.ng.getComponent(el)?.usersRepository.ready();});
  await page.evaluate(()=>{const c=window.ng.getComponent(document.querySelector('spai-dashboard-page'));for(const key of ['usersRepository','cyclesRepository','teachersRepository','assignmentsRepository','customRolesRepository','groupsRepository','subjectsRepository','sharedRequestsRepository','nomenclaturesRepository'])c[key].stateSignal.set('loading');});
  await check(page.getByText('Cargando datos autorizados…').first()).toBeVisible();
  const cards=await page.evaluate(()=>{const c=window.ng.getComponent(document.querySelector('spai-dashboard-page'));return c.metrics();});assert(cards.every(c=>c.value==='—'));await shot('dashboard-loading-1280');
 });
 await record('Mobile layout retains readable metrics and full authorized directory',async()=>{
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/usuarios');await check(page.locator('.users-metrics article').filter({hasText:'Roles disponibles'}).locator('strong')).toHaveText('1');await shot('users-390');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.goto(base+'/ciclos');await page.waitForFunction(()=>{const el=document.querySelector('spai-cycles-page');return el && window.ng.getComponent(el)?.cyclesReady();});await shot('cycles-390');
 });
}catch(e){await shot('preproduction-ui-failure');throw e;}
finally {writeFileSync(resolve(out,'presentation.json'),JSON.stringify({at:new Date().toISOString(),results,environment:'127.0.0.1:4207 / 39080',faultInjection:'Repository read state only for loading/error/denied/empty presentation; no policy assertion inferred',humanAcceptance:false},null,2));await browser.close();await A.deleteApp(app);}
