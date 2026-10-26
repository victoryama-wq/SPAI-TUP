// Complete product confirmation flows, only on the dedicated synthetic slot.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {deleteApp} from 'firebase/app';
import {terminate} from 'firebase/firestore';
import {config,root,complementTest,verifyHub,localEnvironment,password} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
assert(complementTest);assert.equal(config.firestore,28080);await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),A=require('firebase-admin/app'),app=A.initializeApp({projectId:config.projectId},randomUUID());
const db=require('firebase-admin/firestore').getFirestore(app),auth=require('firebase-admin/auth').getAuth(app),P=require('./security/policy');
const out=resolve(root,'docs/evidence/r02-functional-20261026');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:950}}),clients=[];
const base='http://127.0.0.1:4204',allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());page.setDefaultTimeout(30000);const check=expect.configure({timeout:30000});
const results=[],requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/cycleCommand'))requests.push(r.postDataJSON().data);});
const getCycle=async()=>(await db.doc('ciclos/demo-27-1').get()).data();
const row=()=>page.locator('tbody tr').filter({has:page.locator('.cycle-code',{hasText:'27-1'})});
const dialog=()=>page.getByRole('dialog');
const snapshot=async()=>Object.fromEntries(await Promise.all(['ciclos','operaciones_ciclo','bitacora','eventos_ciclo','ciclos_retirados'].map(async c=>[c,(await db.collection(c).orderBy('__name__').get()).docs.map(d=>[d.id,d.data()])])));
async function transition(label,action,state,extra={}){
 const before=await getCycle(),count=requests.length;await row().getByRole('button',{name:label,exact:true}).click();await check(dialog()).toBeVisible();
 if(action==='closeCapture')await check(dialog()).toContainText('Al cerrar la captura, se bloquearán las operaciones académicas ordinarias del ciclo.');
 await dialog().getByRole('button',{name:label,exact:true}).click();await check.poll(async()=>(await getCycle()).revision).toBe(before.revision+1);
 await check(dialog()).not.toBeVisible();await check(row().locator('.status-badge')).toHaveText(state);
 assert.equal(requests.length,count+1);const command=requests.at(-1);assert.equal(command.action,action);assert.equal(command.expectedRevision,before.revision);
 const key='demo-sistemas_'+command.operationId,after=await getCycle(),audit=(await db.doc('bitacora/ciclo_'+key).get()).data(),event=(await db.doc('eventos_ciclo/'+key).get()).data();
 assert.equal(audit.actorId,'demo-sistemas');assert.equal(audit.actorName,'Sistemas DEMO');assert.deepEqual(audit.previous,{...before,id:'demo-27-1'});assert.deepEqual(audit.next,after);assert.equal(audit.createdAt,event.createdAt);
 for(const [k,v] of Object.entries(extra))assert.equal(after[k],v);
 assert.equal((await db.doc('operaciones_ciclo/'+key).get()).data().result.revision,after.revision);
 results.push({name:'Confirmación UI '+action,status:'PASS',operationId:command.operationId,state});
}
async function createUser(id,name,role='CUSTOM'){
 await auth.createUser({uid:id,email:`demo.${id}@tecplayacar.edu.mx`,password,emailVerified:true});
 await db.doc('usuarios/'+id).set({authUid:id,email:`demo.${id}@tecplayacar.edu.mx`,name,role:role==='ADMIN_GENERAL'?'Administración de Sistemas':'Consulta',baseRole:role,status:'Activo',revision:1,permissionSchemaVersion:2,permissions:P.levels({asignaciones:'VIEW'}),scope:P.scope({programs:['ADM'],cycles:['27-1']}),capabilities:[]});
}
try{
 assert.equal((await getCycle()).status,'Preparacion','Prepare the isolated preparation scenario first');
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await check(page.locator('nav')).toBeVisible();await page.goto(base+'/ciclos');
 await transition('Iniciar captura','start','Captura');
 // A different authenticated actor produces a real event; deleting their account
 // afterwards must not turn the current viewer into the historical actor.
 const actor='historical-'+randomUUID().slice(0,8),actorName='Actor histórico de prueba '+actor;
 await createUser(actor,actorName,'ADMIN_GENERAL');const client=runtime.initializeFirebaseRuntime(localConfig,actor);clients.push(client);await signInWithEmailAndPassword(client.auth,`demo.${actor}@tecplayacar.edu.mx`,password);
 const operationId=randomUUID();await httpsCallable(client.functions,'cycleCommand')({action:'schedule',cycleId:'demo-27-1',expectedRevision:(await getCycle()).revision,date:null,operationId,actorId:'forged',actorName:'Sistemas DEMO'});
 const auditRef=db.doc('bitacora/ciclo_'+actor+'_'+operationId),historical=(await auditRef.get()).data();assert.equal(historical.actorId,actor);assert.equal(historical.actorName,actorName);
 await db.doc('usuarios/'+actor).update({status:'Inactivo'});await auth.deleteUser(actor);await db.doc('usuarios/'+actor).delete();assert.deepEqual((await auditRef.get()).data(),historical);
 await page.goto(base+'/bitacora');await page.getByPlaceholder('Modulo, accion, usuario, descripcion o folio').fill(actorName);const card=page.locator('.audit-entry').filter({hasText:actorName});await check(card).toHaveCount(1);await check(card).not.toContainText('Sistemas DEMO');await page.screenshot({path:resolve(out,'actor-historico.png'),fullPage:true});
 results.push({name:'Actor autenticado distinto del consultante; snapshot conservado tras baja Auth/perfil',status:'PASS',operationId,actorId:actor});
 await page.getByPlaceholder('Modulo, accion, usuario, descripcion o folio').fill('start');await check(page.locator('.audit-entry').first()).toContainText('Sistemas DEMO');
 // Explicit legacy duplicate fixture, never a rewrite of history.
 await db.doc('bitacora/functional-legacy-duplicate').set({actorName:'Sistemas DEMO',actorArea:'Sistemas DEMO',module:'Ciclos',action:'schedule',description:'Identidad duplicada ficticia para presentación',createdAt:new Date().toISOString(),source:'SERVIDOR'});
 await page.getByPlaceholder('Modulo, accion, usuario, descripcion o folio').fill('Identidad duplicada ficticia');await check(page.locator('.audit-entry')).toHaveCount(1);
 assert.equal(((await page.locator('.audit-entry').innerText()).match(/Sistemas DEMO/g)||[]).length,1);assert.equal((await db.doc('bitacora/functional-legacy-duplicate').get()).data().actorArea,'Sistemas DEMO');await page.screenshot({path:resolve(out,'actor-sin-duplicacion.png'),fullPage:true});
 results.push({name:'Duplicación visual eliminada sin modificar snapshot',status:'PASS'});
 await page.goto(base+'/ciclos');await check(dialog()).toContainText('Ciclo 27-1');await dialog().getByRole('button',{name:'Entendido',exact:true}).click();
 await transition('Cerrar captura','closeCapture','Captura cerrada');await check(page.getByRole('button',{name:'Nuevo ciclo',exact:true})).toBeDisabled();
 await transition('Habilitar Especiales','specials','Captura cerrada',{specialsEnabled:true});await transition('Deshabilitar Especiales','specials','Captura cerrada',{specialsEnabled:false});
 await row().getByLabel('Motivo para reabrir').fill('Reapertura ficticia confirmada por interfaz');await transition('Reabrir captura','reopen','Captura');
 await transition('Cerrar captura','closeCapture','Captura cerrada');await transition('Cerrar ciclo','close','Cerrado');
 await check(page.getByRole('button',{name:'Nuevo ciclo',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Nuevo ciclo',exact:true}).click();await check(page.getByRole('button',{name:'Guardar ciclo',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 const before=await snapshot();await page.locator('tbody tr').filter({has:page.locator('.cycle-code',{hasText:'26-3'})}).getByRole('button',{name:'Eliminar ciclo histórico',exact:true}).click();await dialog().getByLabel('Motivo de eliminación',{exact:false}).fill('Rechazo ficticio de histórico con dependencias');await dialog().getByRole('button',{name:'Eliminar ciclo',exact:true}).click();await check(page.getByRole('alert')).toContainText(/dependencias|asociados/i);assert.deepEqual(await snapshot(),before);
 results.push({name:'Confirmación UI de histórico con dependencias rechazada sin cambios',status:'PASS'});
 // Fresh account created by this run, never a shared DEMO identity.
 const target='functional-delete-'+randomUUID().slice(0,8);await createUser(target,'Cuenta ficticia para confirmar baja');
 await page.goto(base+'/usuarios');const targetRow=page.locator('tbody tr').filter({hasText:`demo.${target}@tecplayacar.edu.mx`});await targetRow.getByRole('button',{name:'Eliminar usuario',exact:true}).click();await check(dialog().getByLabel('Motivo de la baja')).toBeEnabled();await dialog().getByLabel('Motivo de la baja').fill('Baja ficticia autorizada para verificación funcional');await dialog().getByRole('button',{name:'Eliminar usuario',exact:true}).click();await check(targetRow).toHaveCount(0);await assert.rejects(auth.getUser(target),e=>e.code==='auth/user-not-found');assert.ok((await db.doc('usuarios/'+target).get()).data().deletedAt);
 results.push({name:'Baja confirmada por modal: cuenta ficticia retirada de Auth y perfil histórico conservado',status:'PASS',target});
 assert.deepEqual(errors,[]);
}catch(e){await page.screenshot({path:resolve(out,'functional-failure.png'),fullPage:true});throw e;}
finally{writeFileSync(resolve(out,'confirmations.json'),JSON.stringify({at:new Date().toISOString(),results,errors,environment:'isolated 28080/4204',humanAcceptance:false},null,2));await browser.close();for(const c of clients){await terminate(c.db);await deleteApp(c.app);}await A.deleteApp(app);}
console.log('PASS '+results.length+' comprobaciones de confirmaciones reales y actor histórico');
