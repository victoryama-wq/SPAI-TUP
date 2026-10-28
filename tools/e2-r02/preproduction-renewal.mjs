// Run after final-prepare renewal. Only synthetic preproduction 39080.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {config,root,preproductionTest,verifyHub,localEnvironment} from '../local/config.mjs';
assert(preproductionTest);assert.equal(config.firestore,39080);await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),A=require('firebase-admin/app'),app=A.initializeApp({projectId:config.projectId},'renewal-ui');
const db=require('firebase-admin/firestore').getFirestore(app),svc=require('./cycles/service').createCycleService(db),out=resolve(root,'docs/evidence/r02-preproduction-20261028');
assert.equal((await db.collection('ciclos').get()).size,2);
await db.doc('ciclos/demo-27-1').update({status:'Captura cerrada',closedAt:null});await svc.inspect({uid:'demo-sistemas'});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:950}}),base='http://127.0.0.1:4207',results=[],commands=[];
const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());page.on('request',r=>{if(r.url().endsWith('/cycleCommand'))commands.push(r.postDataJSON().data);});page.setDefaultTimeout(30000);const check=expect.configure({timeout:30000});
const row=code=>page.locator('tbody tr').filter({has:page.locator('.cycle-code',{hasText:code})});
const snapshot=async()=>Object.fromEntries(await Promise.all(['ciclos','bitacora','eventos_ciclo','operaciones_ciclo','ciclos_retirados'].map(async c=>[c,(await db.collection(c).orderBy('__name__').get()).docs.map(d=>[d.id,d.data()])])));
try {
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await check(page.locator('nav')).toBeVisible();await page.goto(base+'/ciclos');
 await check(page.getByRole('button',{name:'Nuevo ciclo',exact:true})).toBeDisabled();await check(row('27-1').getByRole('button',{name:'Cerrar ciclo',exact:true})).toBeEnabled();
 await row('27-1').getByRole('button',{name:'Cerrar ciclo',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cerrar ciclo',exact:true}).click();await check(row('27-1').locator('.status-badge')).toHaveText('Cerrado');
 await check(page.getByRole('button',{name:'Nuevo ciclo',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Nuevo ciclo',exact:true}).click();await check(page.getByRole('button',{name:'Guardar ciclo',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Cancelar',exact:true}).click();results.push({name:'CAPTURA_CERRADA → CERRADO; two histories allow form but prevent third confirmation',status:'PASS'});
 const before=await snapshot();await row('26-3').getByRole('button',{name:'Eliminar ciclo histórico',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();assert.deepEqual(await snapshot(),before);results.push({name:'Cancel deletion leaves cycles, operations, audit and events unchanged',status:'PASS'});
 await row('26-3').getByRole('button',{name:'Eliminar ciclo histórico',exact:true}).click();await page.getByRole('dialog').getByLabel('Motivo de eliminación',{exact:false}).fill('Renovación aislada: histórico vacío elegible');await page.getByRole('dialog').getByRole('button',{name:'Eliminar ciclo',exact:true}).click();await check(row('26-3')).toHaveCount(0);
 await page.getByRole('button',{name:'Nuevo ciclo',exact:true}).click();await page.getByLabel('Código de ciclo',{exact:true}).fill('27-2');await page.getByLabel('Nombre visible',{exact:true}).fill('Ciclo siguiente ficticio');await page.getByRole('button',{name:'Guardar ciclo',exact:true}).click();await check(row('27-2').locator('.status-badge')).toHaveText('Preparacion');await check(page.getByRole('button',{name:'Nuevo ciclo',exact:true})).toBeDisabled();
 const cycles=(await db.collection('ciclos').get()).docs.map(d=>d.data());assert.equal(cycles.length,2);assert.equal(cycles.filter(c=>c.status!=='Cerrado').length,1);assert(cycles.some(c=>c.code==='27-1'&&c.status==='Cerrado'));
 assert.deepEqual(commands.map(c=>c.action),['close','purge','create']);
 for(const command of commands){const key='demo-sistemas_'+command.operationId;const op=(await db.doc('operaciones_ciclo/'+key).get()).data(),audit=(await db.doc('bitacora/ciclo_'+key).get()).data(),event=(await db.doc('eventos_ciclo/'+key).get()).data();assert(op&&audit&&event);assert.equal(audit.action,command.action);assert.equal(audit.createdAt,event.createdAt);assert.equal(audit.operationId,command.operationId);assert.equal(audit.actorId,'demo-sistemas');}
 results.push({name:'Explicit empty-history deletion and next PREPARACIÓN through product confirmations; atomic records',status:'PASS',operationIds:commands.map(c=>c.operationId)});await page.screenshot({path:resolve(out,'renewal-completed-1280.png'),fullPage:true});
}catch(e){await page.screenshot({path:resolve(out,'renewal-failure.png'),fullPage:true});throw e;}
finally{writeFileSync(resolve(out,'renewal-ui.json'),JSON.stringify({at:new Date().toISOString(),environment:'39080/4207',results,humanAcceptance:false},null,2));await browser.close();await A.deleteApp(app);}
