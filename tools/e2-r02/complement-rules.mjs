import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync,mkdirSync} from 'node:fs';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {doc,setDoc,deleteDoc,terminate} from 'firebase/firestore';
import {deleteApp} from 'firebase/app';
import {httpsCallable} from 'firebase/functions';
import {config,root,localEnvironment,verifyHub,complementTest,password} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
assert.equal(complementTest,true);assert.equal(config.firestore,28080);await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),admin=require('firebase-admin/app'),fs=require('firebase-admin/firestore');
const app=admin.initializeApp({projectId:config.projectId},'complement-rules'),db=fs.getFirestore(app),service=require('./cycles/service').createCycleService(db),clients=[],results=[];
async function login(email){const c=runtime.initializeFirebaseRuntime(localConfig,email);clients.push(c);await signInWithEmailAndPassword(c.auth,email,password);return c;}
async function deny(promise){await assert.rejects(promise,e=>{assert.equal(e.code.replace('functions/',''),'permission-denied');if(/evaluation error|maximum of|Null value|UNAVAILABLE|INTERNAL/i.test(e.message)){results.push({name:'Strict Rules denial',status:'INCONCLUSIVE_EVALUATOR',error:e.message,creditedAsPolicyDenial:false});process.exitCode=1;}return true;});}
async function check(name,fn){const before=results.length;await fn();const status=results.slice(before).some(r=>r.status==='INCONCLUSIVE_EVALUATOR')?'INCONCLUSIVE_EVALUATOR':'PASS';results.push({name,status});console.log(status+' '+name);}
try{
 for(const collection of ['asignaciones','solicitudes_sistemas']) for(const row of (await db.collection(collection).get()).docs) if(row.id.startsWith('r02-complement-') || ['live-request','late-retired'].includes(row.id)) await row.ref.delete();
 const system=await login('demo.sistemas@tecplayacar.edu.mx'),ca=await login('demo.coordinacion.a@tecplayacar.edu.mx'),view=await login('demo.r01.consulta@tecplayacar.edu.mx');
 const cycle=db.doc('ciclos/demo-27-1');
 await db.doc('grupos/27_1_ADM_11_C_A').set({fullGroup:'27-1 ADM 11 C.A',cycleCode:'27-1',programAbbreviation:'ADM',section:'C.A',modality:'Virtual',status:'Activo'});
 const base={cycle:'27-1',program:'ADM',group:'27-1 ADM 11 01',subjectId:'FICTICIO',subjectName:'FICTICIO',teacherMoodleUser:'demo-docente-1',teacherName:'FICTICIO',status:'EN_CAPTURA',assignmentType:'REGULAR',special:false,createdBy:ca.auth.currentUser.uid,createdAt:'2026-10-23T00:00:00Z'};
 const payload=id=>({...base,moodleId:id,normalizedMoodleId:id});
 const special=id=>({...payload(id),group:'27-1 ADM 11 C.A',assignmentType:'ESPECIAL',special:true});
 await check('No direct cycle writes or purge for consultation actor through callable',async()=>{
  await deny(deleteDoc(doc(system.db,'ciclos/demo-26-3')));
  await deny(setDoc(doc(system.db,'ciclos/illegal'),{code:'27-3',status:'Preparacion'}));
  await deny(httpsCallable(view.functions,'cycleCommand')({action:'purge',cycleId:'demo-26-3',expectedRevision:1,reason:'Intento directo',operationId:crypto.randomUUID()}));
 });
 await check('Capture allowed; ordinary denied in closed capture; Specials denied disabled and allowed enabled',async()=>{
  await cycle.update({status:'Captura',specialsEnabled:false});await service.inspect({uid:'demo-sistemas'});
  await setDoc(doc(ca.db,'asignaciones/r02-complement-regular'),payload('r02-complement-regular'));
  await cycle.update({status:'Captura cerrada',specialsEnabled:false});await service.inspect({uid:'demo-sistemas'});
  await deny(setDoc(doc(ca.db,'asignaciones/r02-complement-ordinary-denied'),payload('r02-complement-ordinary-denied')));
  await deny(setDoc(doc(ca.db,'asignaciones/r02-complement-special-off'),special('r02-complement-special-off')));
  await cycle.update({specialsEnabled:true});await service.inspect({uid:'demo-sistemas'});
  await setDoc(doc(ca.db,'asignaciones/r02-complement-special-on'),special('r02-complement-special-on'));
 });
 await check('Specials: VIEW, wrong group, outside program, preparation and closed rejected without effects',async()=>{
  await deny(setDoc(doc(view.db,'asignaciones/r02-complement-view'),{...special('r02-complement-view'),createdBy:view.auth.currentUser.uid}));
  await deny(setDoc(doc(ca.db,'asignaciones/r02-complement-wrong-group'),{...special('r02-complement-wrong-group'),group:base.group}));
  await deny(setDoc(doc(ca.db,'asignaciones/r02-complement-foreign'),{...special('r02-complement-foreign'),program:'DER'}));
  for(const status of ['Preparacion','Cerrado']){await cycle.update({status,specialsEnabled:true});await service.inspect({uid:'demo-sistemas'});await deny(setDoc(doc(ca.db,'asignaciones/r02-complement-closed'),special('r02-complement-closed')));}
  for(const id of ['ordinary-denied','special-off','view','wrong-group','foreign','closed'])assert.equal((await db.doc('asignaciones/r02-complement-'+id).get()).exists,false);
 });
 await check('Retired cycle tombstone blocks late linked requests; ordinary active request still works',async()=>{
  await db.doc('ciclos_retirados/code_25-1').set({cycleId:'retired',code:'25-1'});
  const request={cycle:'25-1',requestedBy:system.auth.currentUser.uid,status:'PENDIENTE',type:'REABRIR_CAPTURA'};
  await deny(setDoc(doc(system.db,'solicitudes_sistemas/late-retired'),request));assert.equal((await db.doc('solicitudes_sistemas/late-retired').get()).exists,false);
  await setDoc(doc(system.db,'solicitudes_sistemas/live-request'),{...request,cycle:'27-1'});
  await deny(setDoc(doc(system.db,'ciclos_retirados/code_24-1'),{code:'24-1'}));
 });
 mkdirSync(resolve(root,'docs/evidence/r02-complement'),{recursive:true});writeFileSync(resolve(root,'docs/evidence/r02-complement/rules.json'),JSON.stringify({at:new Date().toISOString(),results,evaluatorErrorsCredited:false,environment:'isolated 28080'},null,2));
}finally{for(const c of clients){await terminate(c.db);await deleteApp(c.app);}await admin.deleteApp(app);}
