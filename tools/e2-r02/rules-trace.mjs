// Supplement the strict gate with raw per-request coverage. Never reinterpret
// "evaluation error" as a passing authorization denial.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {config,root,complementTest,verifyHub,localEnvironment,password} from '../local/config.mjs';
assert(complementTest);assert.equal(config.firestore,28080);await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),A=require('firebase-admin/app'),app=A.initializeApp({projectId:config.projectId},'rules-trace');
const db=require('firebase-admin/firestore').getFirestore(app),service=require('./cycles/service').createCycleService(db);
const rules=readFileSync(resolve(root,'firestore.rules'),'utf8'),endpoint='http://127.0.0.1:28080',base=endpoint+'/v1/projects/demo-spai-tup/databases/(default)/documents';
const out=resolve(root,'docs/evidence/r02-functional-20261026');mkdirSync(out,{recursive:true});const results=[];
const load=async content=>{const r=await fetch(endpoint+'/emulator/v1/projects/demo-spai-tup:securityRules',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content}]}})});assert.equal(r.status,200,await r.text());};
const encode=v=>v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:typeof v==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{stringValue:v};
const snapshot=async()=>Object.fromEntries(await Promise.all(['asignaciones','ciclos','ciclo_control','bitacora','eventos_ciclo','operaciones_ciclo'].map(async c=>[c,(await db.collection(c).orderBy('__name__').get()).docs.map(d=>[d.id,d.data()])])));
const auth=await fetch('http://127.0.0.1:29099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'demo.coordinacion.a@tecplayacar.edu.mx',password,returnSecureToken:true})}).then(r=>r.json());assert(auth.idToken);
const source=(await db.doc('asignaciones/demo-asignacion-a').get()).data();assert(source);
async function attempt(id,type,data,expectAllowed){
 await load(rules);const before=await snapshot(),path='asignaciones/'+(type==='update'?'demo-asignacion-a':'trace-'+results.length);
 const write={update:{name:`projects/demo-spai-tup/databases/(default)/documents/${path}`,fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]))},currentDocument:{exists:type==='update'},...(type==='update'?{updateMask:{fieldPaths:Object.keys(data)}}:{})};
 const response=await fetch(base+':commit',{method:'POST',headers:{authorization:'Bearer '+auth.idToken,'content-type':'application/json'},body:JSON.stringify({writes:[write]})}),body=await response.json();
 const coverage=await fetch(endpoint+'/emulator/v1/projects/demo-spai-tup:ruleCoverage').then(r=>r.json());
 const causes=[];function visit(node){for(const v of node.values||[])if(v.value?.undefined?.causeMessage)causes.push(v.value.undefined.causeMessage);for(const c of node.children||[])visit(c);}for(const n of coverage.report||[])visit(n);
 if(expectAllowed)assert.equal(response.status,200,JSON.stringify(body));else {assert.equal(response.status,403,JSON.stringify(body));assert.deepEqual(await snapshot(),before);}
 const diagnostic=body.error?.message||'',strictStatus=expectAllowed?'PASS':/evaluation error|maximum of|Null value|undefined/i.test(diagnostic)?'INCONCLUSIVE_EVALUATOR':'PASS';
 results.push({id,type,expected:expectAllowed?'allow':'deny',status:response.status,strictStatus,unchangedOnRejection:!expectAllowed,diagnostic,causes:[...new Set(causes)],coverage});
 console.log(id+': '+strictStatus);
}
try{
 for(const state of ['Preparacion','Captura cerrada','Cerrado']){
  await db.doc('ciclos/demo-27-1').update({status:state,specialsEnabled:false});await service.inspect({uid:'demo-sistemas'});
  await attempt('CYCLE-WRITE-'+state,'update',{teacherName:'CAMBIO FICTICIO PROHIBIDO'},false);
  const id='trace-'+results.length;await attempt('CYCLE-CREATE-'+state,'create',{...source,moodleId:id,normalizedMoodleId:id,createdBy:auth.localId},false);
 }
 await db.doc('ciclos/demo-27-1').update({status:'Captura',specialsEnabled:false});await service.inspect({uid:'demo-sistemas'});await attempt('CAPTURE-POSITIVE','update',{teacherName:'CAMBIO FICTICIO ADMITIDO'},true);
 await db.doc('ciclos/demo-27-1').update({status:'Captura cerrada',specialsEnabled:true});await service.inspect({uid:'demo-sistemas'});
 const id='trace-'+results.length,special={...source,assignmentType:'ESPECIAL',special:true,group:'27-1 ADM 11 C.A',sharedGroups:[],sharedPrograms:[],moodleId:id,normalizedMoodleId:id,createdBy:auth.localId,status:'EN_CAPTURA'};
 await attempt('SPECIAL-POSITIVE','create',special,true);
 await db.doc('ciclos/demo-27-1').update({specialsEnabled:false});await service.inspect({uid:'demo-sistemas'});
 await attempt('SPECIAL-DISABLED-BEFORE-COMMIT','create',{...special,moodleId:'trace-disabled',normalizedMoodleId:'trace-disabled'},false);
 await db.doc('usuarios/'+auth.localId).update({status:'Inactivo'});await db.doc('ciclos/demo-27-1').update({status:'Captura'});await service.inspect({uid:'demo-sistemas'});
 await attempt('AUTH-REVOKED-BEFORE-COMMIT','update',{teacherName:'CAMBIO TRAS REVOCACION'},false);
}finally{await load(rules);writeFileSync(resolve(out,'rules-traces.json'),JSON.stringify({at:new Date().toISOString(),results,expectationsUnchanged:true,environment:'isolated 28080',humanAcceptance:false},null,2));await A.deleteApp(app);}
if(results.some(result=>result.strictStatus!=='PASS'))process.exitCode=1;
