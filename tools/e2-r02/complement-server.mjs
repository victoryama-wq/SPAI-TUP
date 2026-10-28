import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {config,root,localEnvironment,verifyHub,complementTest} from '../local/config.mjs';
import {resolve} from 'node:path';
assert.equal(complementTest,true);assert.ok([28080,39080].includes(config.firestore));await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json'));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
const {createCycleService}=require('./cycles/service'),{COLLECTIONS}=require('./cycles/dependencies');
const app=initializeApp({projectId:config.projectId},'r02-complement');
const db=getFirestore(app,'complement-'+Date.now()),service=createCycleService(db),actor={uid:'admin'},results=[];
const general={id:'admin',authUid:'admin',name:'Administrador ficticio',status:'Activo',permissionSchemaVersion:2,baseRole:'ADMIN_GENERAL'};
const cycle=(id,code,status='Cerrado')=>({id,code,label:'Ciclo ficticio '+code,status,revision:1,specialsEnabled:false,createdAt:'2026-01-01T00:00:00Z',closedAt:status==='Cerrado'?'2026-02-01T00:00:00Z':null});
const old=cycle('old','26-3'),latest=cycle('latest','27-1');
const command=(action,c,extra={})=>({action,cycleId:c.id,expectedRevision:c.revision,operationId:randomUUID(),...extra});
const purge=(c=old)=>command('purge',c,{reason:'Depuración ficticia sin dependencias'});
async function snapshot(){const out={};for(const col of await db.listCollections())out[col.id]=(await col.get()).docs.map(d=>[d.id,d.data()]).sort((a,b)=>a[0].localeCompare(b[0]));return out;}
async function noChange(fn,code,pattern){const before=await snapshot();await assert.rejects(fn,e=>e.code===code&&(!pattern||pattern.test(e.message)));assert.deepEqual(await snapshot(),before);}
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
try {
 await db.doc('usuarios/admin').set(general);await db.doc('ciclos/old').set(old);await db.doc('ciclos/latest').set(latest);
 await check('Two historical cycles: context NONE; create cannot commit third',async()=>{
  assert.equal((await service.inspect(actor)).state,'NONE');
  await noChange(()=>service.execute(actor,{action:'create',operationId:randomUUID(),payload:{code:'27-2',label:'Nuevo ficticio'}}),'failed-precondition',/LIMITE_CICLOS/);
 });
 await check('Latest historical and operative cycles cannot be deleted',async()=>{
  await noChange(()=>service.execute(actor,purge(latest)),'failed-precondition',/último histórico/);
  for(const status of ['Preparacion','Captura','Captura cerrada']) {await db.doc('ciclos/old').update({status});await noChange(()=>service.execute(actor,purge()),'failed-precondition',/histórico Cerrado/);}
  await db.doc('ciclos/old').set(old);
 });
 await check('Permission, delegated scope, revocation, expiry, stale revision and reason reject atomically',async()=>{
  await db.doc('usuarios/aux').set({id:'aux',authUid:'aux',name:'Auxiliar ficticio',status:'Activo',permissionSchemaVersion:2,baseRole:'ADMIN_OPERATIVO',delegationId:'grant'});
  const grant={id:'grant',userId:'aux',status:'ACTIVE',permissions:{ciclos:'EDIT'},capabilities:['MANAGE_CYCLES'],scope:{cycles:['26-3']}};
  await db.doc('delegaciones/grant').set(grant);
  await noChange(()=>service.execute({uid:'aux'},purge()),'permission-denied');
  for(const delta of [{capabilities:['PURGE_CYCLE'],scope:{cycles:['27-1']}},{capabilities:['PURGE_CYCLE'],status:'REVOKED'},{capabilities:['PURGE_CYCLE'],expiresAtMillis:1}]){await db.doc('delegaciones/grant').set({...grant,...delta});await noChange(()=>service.execute({uid:'aux'},purge()),'permission-denied');}
  await noChange(()=>service.execute(actor,{...purge(),expectedRevision:0}),'aborted');
  await noChange(()=>service.execute(actor,{...purge(),reason:'   '}),'invalid-argument');
 });
 await check('All current mutable dependency collections and private agenda block deletion',async()=>{
  for(const collection of COLLECTIONS){const ref=db.doc(`${collection}/dependency-fixture`);await ref.set({cycle:'26-3'});await noChange(()=>service.execute(actor,purge()),'failed-precondition',/CICLO_CON_DEPENDENCIAS/);await ref.delete();}
  const ref=db.doc('agenda_operativa_privada/fixture/actividades/reference');await ref.set({cycleId:'old'});await noChange(()=>service.execute(actor,purge()),'failed-precondition',/CICLO_CON_DEPENDENCIAS/);await ref.delete();
  const child=db.doc('ciclos/old/legacy/child');await child.set({value:1});await noChange(()=>service.execute(actor,purge()),'failed-precondition',/subcolecciones/);await child.delete();
 });
 await check('Delegated PURGE_CYCLE scoped to older cycle succeeds; full audit and retry are atomic',async()=>{
  await db.doc('delegaciones/grant').set({id:'grant',userId:'aux',status:'ACTIVE',permissions:{ciclos:'EDIT'},capabilities:['PURGE_CYCLE'],scope:{cycles:['26-3']}});
  const request=purge(),[a,b]=await Promise.all([service.execute({uid:'aux'},request),service.execute({uid:'aux'},request)]);assert.deepEqual(a,b);
  const before=await snapshot();assert.deepEqual(await service.execute({uid:'aux'},request),a);assert.deepEqual(await snapshot(),before);
  assert.equal((await db.doc('ciclos/old').get()).exists,false);assert.deepEqual((await db.doc('ciclos/latest').get()).data(),latest);
  const audit=(await db.doc(`bitacora/ciclo_aux_${request.operationId}`).get()).data();assert.deepEqual(audit.previous,old);assert.equal(audit.reason,request.reason);assert.equal(audit.next,null);
  assert.equal((await db.collection('eventos_ciclo').get()).size,1);assert.equal((await db.collection('operaciones_ciclo').get()).size,1);
  await noChange(()=>service.execute({uid:'aux'},{...request,reason:'Otro motivo'}),'already-exists');
  await db.doc('delegaciones/grant').update({status:'REVOKED'});await noChange(()=>service.execute({uid:'aux'},request),'permission-denied');
 });
 await check('Concurrent creations after explicit deletion: only one commits and total stays two',async()=>{
  const create=code=>service.execute(actor,{action:'create',operationId:randomUUID(),payload:{code,label:'Ciclo siguiente ficticio'}});
  const r=await Promise.allSettled([create('27-2'),create('27-3')]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal((await db.collection('ciclos').get()).size,2);
  const current=(await db.collection('ciclos').get()).docs.map(d=>d.data()).find(c=>c.status==='Preparacion');
  for(const action of ['start','closeCapture']){const latestState=(await db.doc('ciclos/'+current.id).get()).data();await service.execute(actor,command(action,latestState));await noChange(()=>create('28-1'),'failed-precondition',/operativo/);}
  const closed=(await db.doc('ciclos/'+current.id).get()).data();await noChange(()=>service.execute(actor,command('reopen',closed,{reason:'  '})),'invalid-argument');
  await service.execute(actor,command('close',closed));await noChange(()=>create('28-1'),'failed-precondition',/LIMITE_CICLOS/);
 });
 await check('Existing violations remain visible and cannot be silently modified',async()=>{
  await db.doc('ciclos/extra').set(cycle('extra','29-1','Preparacion'));assert.equal((await service.inspect(actor)).state,'INCONSISTENT');
  await noChange(()=>service.execute(actor,command('start',cycle('extra','29-1','Preparacion'))),'failed-precondition',/LIMITE_CICLOS/);
  await db.doc('ciclos/another').set(cycle('another','29-2','Captura'));assert.equal((await service.inspect(actor)).state,'INCONSISTENT');
  await noChange(()=>service.execute(actor,command('closeCapture',cycle('another','29-2','Captura'))),'failed-precondition',/CICLO_INCONSISTENTE/);
 });
 mkdirSync(resolve(root,(process.env.SPAI_LOCAL_TEST_SLOT === 'preproduction' ? 'docs/evidence/r02-preproduction-20261028' : 'docs/evidence/r02-complement')),{recursive:true});writeFileSync(resolve(root,(process.env.SPAI_LOCAL_TEST_SLOT === 'preproduction' ? 'docs/evidence/r02-preproduction-20261028/server.json' : 'docs/evidence/r02-complement/server.json')),JSON.stringify({at:new Date().toISOString(),isolatedDatabase:db.databaseId,results,productionValidation:false},null,2));
}finally{await deleteApp(app);}
