import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {config,preproductionTest,verifyHub} from '../local/config.mjs';
assert(preproductionTest);assert.equal(config.firestore,39080);await verifyHub();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:950}}),base='http://127.0.0.1:4207',results=[];
const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());page.setDefaultTimeout(30000);const check=expect.configure({timeout:30000});
try{
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await check(page.locator('nav')).toBeVisible();
 for(const [route,host,repo] of [['grupos','spai-groups-page','groupsRepository'],['nomenclaturas','spai-nomenclatures-page','nomenclaturesRepository'],['asignaturas','spai-subjects-page','subjectsRepository']]){
  await page.goto(base+'/'+route);await page.waitForFunction(host=>{const el=document.querySelector(host);return el && window.ng.getComponent(el).directoryReady();},host);
  for(const state of ['loading','error','denied','restricted']){
   await page.evaluate(({host,repo,state})=>window.ng.getComponent(document.querySelector(host))[repo].stateSignal.set(state),{host,repo,state});
   await check(page.locator(host)).toContainText(({loading:'Cargando datos autorizados',error:'No se pudo completar',denied:'Acceso denegado',restricted:'Sin ámbito'})[state]);await check(page.locator(host+' .summary-grid')).toHaveCount(0);
  }
  await page.evaluate(({host,repo})=>{const r=window.ng.getComponent(document.querySelector(host))[repo];r.itemsSignal.set([]);r.stateSignal.set('ready');},{host,repo});
  await check(page.locator(host+' .summary-grid strong').first()).toHaveText('0');
  await page.reload();await page.waitForFunction(host=>{const el=document.querySelector(host);return el && window.ng.getComponent(el).directoryReady();},host);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`docs/evidence/r02-preproduction-20261028/${route}-390.png`,fullPage:true});await page.setViewportSize({width:1280,height:950});
  results.push({module:route,status:'PASS',checks:['loading','error','denied','restricted','confirmedEmpty','confirmedPopulated','mobile']});
 }
}finally{writeFileSync('docs/evidence/r02-preproduction-20261028/catalog-loading.json',JSON.stringify({at:new Date().toISOString(),results,faultInjection:'Repository presentation state only; no new backend authorization result',humanAcceptance:false},null,2));await browser.close();}
