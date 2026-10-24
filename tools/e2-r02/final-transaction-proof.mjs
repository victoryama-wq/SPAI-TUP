import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,config,complementTest,verifyHub,localEnvironment} from '../local/config.mjs';
assert.equal(complementTest,true);assert.equal(config.firestore,28080);await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),A=require('firebase-admin/app');
const app=A.initializeApp({projectId:config.projectId},randomUUID()),db=require('firebase-admin/firestore').getFirestore(app,'r02-final-'+Date.now());
const service=require('./cycles/service').createCycleService(db),actor={uid:'proof-admin'},results=[];
const collections=['ciclos','ciclo_control','operaciones_ciclo','bitacora','eventos_ciclo','ciclos_retirados'];
async function snapshot(){const out={};for(const c of collections)out[c]=(await db.collection(c).get()).docs.map(d=>[d.id,d.data()]);return out;}
async function commit(action,id,extra={}){
 const before=await snapshot(),previous=id?(await db.doc('ciclos/'+id).get()).data():null;
 const request={action,operationId:randomUUID(),...(id?{cycleId:id,expectedRevision:previous.revision}:{}),...extra};
 const result=await service.execute(actor,request),key=actor.uid+'_'+request.operationId;
 const op=(await db.doc('operaciones_ciclo/'+key).get()).data(),audit=(await db.doc('bitacora/ciclo_'+key).get()).data(),event=(await db.doc('eventos_ciclo/'+key).get()).data();
 assert.deepEqual(op.result,result);assert.equal(audit.operationId,request.operationId);assert.equal(event.operationId,request.operationId);
 assert.equal(audit.actorId,actor.uid);assert.equal(event.actorId,actor.uid);assert.equal(op.createdAt,audit.createdAt);assert.equal(audit.createdAt,event.createdAt);assert.ok(Number.isFinite(Date.parse(audit.createdAt)));
 assert.equal(audit.action,action);assert.equal(event.action,action);assert.deepEqual(audit.previous,previous);assert.deepEqual(audit.next,event.next);assert.equal(audit.reason,extra.reason||'');assert.equal(event.delivery,'SIMULATED_ONLY');
 const cycle=await db.doc('ciclos/'+result.cycleId).get();assert.equal(cycle.exists,action!=='purge');if(cycle.exists)assert.deepEqual(cycle.data(),audit.next);
 const after=await snapshot();for(const c of ['operaciones_ciclo','bitacora','eventos_ciclo'])assert.equal(after[c].length,before[c].length+1);
 assert.ok(after.ciclos.length<=2);assert.ok(after.ciclos.filter(([,c])=>c.status!=='Cerrado').length<=1);
 assert.deepEqual(await service.execute(actor,request),result);assert.deepEqual(await snapshot(),after);
 results.push({action,code:audit.cycle,status:'PASS',operationId:request.operationId,previous:previous?.status??null,next:audit.next?.status??null,atomicRecords:3,replayUnchanged:true});return result;
}
try{
 await db.doc('usuarios/'+actor.uid).set({id:actor.uid,authUid:actor.uid,name:'Administrador ficticio de prueba',baseRole:'ADMIN_GENERAL',status:'Activo',permissionSchemaVersion:2});
 await db.doc('ciclos/history').set({id:'history',code:'26-3',label:'Histórico ficticio',status:'Cerrado',revision:1});
 const created=await commit('create',null,{payload:{code:'27-1',label:'Ciclo ficticio de prueba'}}),id=created.cycleId;
 await commit('start',id);await commit('closeCapture',id);await commit('specials',id,{enabled:true});await commit('specials',id,{enabled:false});
 await commit('reopen',id,{reason:'Revisión ficticia autorizada'});await commit('closeCapture',id);await commit('close',id);
 const historyBefore=(await db.doc('ciclos/'+id).get()).data();await commit('purge','history',{reason:'Histórico anterior ficticio sin dependencias'});await commit('create',null,{payload:{code:'27-2',label:'Siguiente ciclo ficticio'}});
 assert.deepEqual((await db.doc('ciclos/'+id).get()).data(),historyBefore);
 mkdirSync(resolve(root,'docs/evidence/r02-final-review'),{recursive:true});writeFileSync(resolve(root,'docs/evidence/r02-final-review/transactions.json'),JSON.stringify({at:new Date().toISOString(),environment:'named isolated database '+db.databaseId,results,humanAcceptance:false},null,2));console.log('PASS '+results.length+' operaciones con ciclo, operación, bitácora y evento coherentes; reintentos sin efectos');
}finally{await A.deleteApp(app);}
