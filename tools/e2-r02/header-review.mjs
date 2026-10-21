import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {root,config,isolatedTest,verifyHub,complementTest} from '../local/config.mjs';
assert.equal(isolatedTest,true);await verifyHub();
assert.equal(complementTest,true);
const base='http://127.0.0.1:4204';
const output=resolve(root,'docs/evidence/e2-r02/header-simplified');mkdirSync(output,{recursive:true});
const readCycles=async()=>{const r=await fetch(`http://127.0.0.1:${config.firestore}/v1/projects/demo-spai-tup/databases/(default)/documents/ciclos`,{headers:{authorization:'Bearer owner'}});assert.equal(r.status,200);return await r.json();};
const before=await readCycles();const browser=await chromium.launch({headless:true});const commands=[];const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(20000);
 const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
 await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
 await page.route('**/cycleCommand',r=>{const body=r.request().postDataJSON();assert.equal(body.data.action,'closeCapture');body.data.expectedRevision=-1;commands.push({action:body.data.action,expectedRevision:-1});return r.continue({postData:JSON.stringify(body)});});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();await page.goto(base+'/ciclos');
 const card=page.getByRole('region',{name:'Operaciones del ciclo'});const close=card.getByRole('button',{name:'Cerrar captura',exact:true});const dialog=page.getByRole('dialog');
 await expect(close).toBeEnabled();await expect(card.getByRole('heading',{name:'Captura',exact:true})).toBeVisible();await expect(card).not.toContainText('La captura académica está habilitada para el ciclo activo.');await expect(card.locator('p')).toHaveCount(0);await expect(card).not.toContainText('Las acciones se confirman');
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:900});await card.scrollIntoViewIfNeeded();await card.screenshot({path:resolve(output,`tarjeta-${width}.png`)});
  const bounds=await card.boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width+1);
  await close.click();await expect(dialog).toContainText('Al cerrar la captura, se bloquearán las operaciones académicas ordinarias del ciclo.');await dialog.screenshot({path:resolve(output,`cerrar-captura-${width}.png`)});
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(close).toBeEnabled();assert.equal(commands.length,0);
 }
 assert.deepEqual(await readCycles(),before,'Cancelar no debe cambiar ciclos');
 await close.click();const response=page.waitForResponse(r=>r.url().endsWith('/cycleCommand'));await dialog.getByRole('button',{name:'Cerrar captura',exact:true}).click();const reply=await response;assert.equal(reply.status(),409);
 await expect(page.getByRole('alert')).toContainText('el ciclo cambió');await expect(card.getByRole('heading',{name:'Captura',exact:true})).toBeVisible();await expect(close).toBeEnabled();assert.deepEqual(await readCycles(),before,'Un rechazo no debe cambiar ciclos');
 await page.getByRole('alert').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(output,'rechazo-320.png'),fullPage:true});
 // Presentation only: render the real Angular template with other states, without writing Firestore.
 const states=await page.evaluate(()=>{const el=document.querySelector('spai-cycles-page'),cmp=window.ng.getComponent(el);const original=cmp.activeCycle;const cycle=original();const result=[];try{for(const status of ['Preparacion','Captura cerrada','Cerrado']){cmp.activeCycle=()=>({...cycle,status,specialsEnabled:false});window.ng.applyChanges(cmp);result.push({status,enabledText:el.querySelector('.operative-control').textContent.includes('La captura académica está habilitada')});}}finally{cmp.activeCycle=original;window.ng.applyChanges(cmp);}return result;});
 assert.ok(states.every(s=>!s.enabledText));assert.deepEqual(errors,[]);
 writeFileSync(resolve(output,'resultados.json'),JSON.stringify({at:new Date().toISOString(),status:'PASS',widths:[1280,390,320],cancelCommands:0,serverRejection:409,forcedExpectedRevision:-1,cyclesUnchanged:true,otherStatesPresentationOnly:states,commands,errors,physicalSecondComputer:false},null,2));
 console.log('PASS: tarjeta/modal 1280/390/320; cancelación sin comandos; conflicto real 409 sin cambio; otros estados sin mensaje de captura.');
} finally {await browser.close();}
