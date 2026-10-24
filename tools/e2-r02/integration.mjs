import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {doc,setDoc,updateDoc,deleteDoc,getDocFromServer,writeBatch,terminate} from 'firebase/firestore';
import {deleteApp} from 'firebase/app';
import {root,config,isolatedTest,localEnvironment,verifyHub,password,accounts} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
import {fixtures} from '../local/fixtures.mjs';
import {guardNetwork} from '../local/tests/network-guard.mjs';
assert.equal(isolatedTest,true,'Only isolated synthetic emulators');
const network=guardNetwork(); await verifyHub(); Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json'));
const adminApp=require('firebase-admin/app'); const adminFs=require('firebase-admin/firestore');
const app=adminApp.initializeApp({projectId:config.projectId},'r02-tests'); const db=adminFs.getFirestore(app);
const service=require('./cycles/service.js').createCycleService(db);
const clients=[]; const cases=[];
async function client(uid) {const a=accounts.find(a=>a.uid===uid); const c=runtime.initializeFirebaseRuntime(localConfig,`r02-${uid}-${randomUUID()}`);clients.push(c);await signInWithEmailAndPassword(c.auth,a.email,password);return c;}
const system=await client('demo-sistemas'); const ca=await client(accounts[2].uid);
const command=async(action,cycle,extra={},who=system)=> (await httpsCallable(who.functions,'cycleCommand')({action,operationId:randomUUID(),...(cycle?{cycleId:cycle.id,expectedRevision:cycle.revision??0}:{}),...extra})).data;
const inspect=()=>httpsCallable(system.functions,'cycleContext')({});
async function check(name,body) {
  const before=cases.length;
  try { await body(); const unresolved=cases.slice(before).some(c=>c.status==='INCONCLUSIVE_EVALUATOR'); cases.push({name,status:unresolved?'INCONCLUSIVE_EVALUATOR':'PASS'}); console.log(unresolved?'INCONCLUSIVE':'PASS',name); }
  catch(e) {cases.push({name,status:'FAIL',error:e.message});console.error('FAIL',name,e.message);process.exitCode=1;}
}
async function denied(promise,code='permission-denied') {
  await assert.rejects(promise,e=>{
    assert.equal(e.code.replace('functions/',''),code);
    try { assert.doesNotMatch(e.message,/evaluation error|maximum of|Null value|UNAVAILABLE|INTERNAL/i); }
    catch(error) { cases.push({name:'Strict Rules denial',status:'INCONCLUSIVE_EVALUATOR',error:e.message,creditedAsPolicyDenial:false});process.exitCode=1; }
    return true;
  });
}
// Reset only the isolated cycle test fixture, never the shared demo.
for(const d of (await db.collection('ciclos').get()).docs) await d.ref.delete();
for(const d of fixtures().filter(d=>d.path.startsWith('ciclos/'))) await db.doc(d.path).set(d.data);
for(const id of ['r02-a','r02-new','r02-special','r02-preparation']) await db.doc(`asignaciones/${id}`).delete();
const cyclesBackup=(await db.collection('ciclos').get()).docs.map(d=>[d.id,d.data()]);
const get=async id=>({id,...(await db.doc(`ciclos/${id}`).get()).data()});
const create=()=>command('create',null,{payload:{code:'28-1',label:'Ciclo R02 ficticio',notes:'Aislado'}});
async function snapshot(){return Object.fromEntries(await Promise.all(['ciclos','bitacora','eventos_ciclo','operaciones_ciclo'].map(async c=>[c,(await db.collection(c).get()).docs.map(d=>[d.id,d.data()]).sort()])));}
let cycle;
try {
  await check('Multiple existing operative cycles: no selection or mutation',async()=>{
    const before=await db.collection('ciclos').get(); assert.equal((await inspect()).data.state,'INCONSISTENT');
    await denied(create(),'failed-precondition'); assert.deepEqual((await db.collection('ciclos').get()).docs.map(d=>d.data()),before.docs.map(d=>d.data()));
  });
  // The approved two-cycle limit replaces the former multi-history setup.
  // Clear only academic fixtures in this guarded isolated suite, then retain one empty history.
  for(const col of ['ciclos','grupos','asignaciones','solicitudes_compartidas','solicitudes_sistemas','ligas_meet','notificaciones','agenda_operativa_equipo'])for(const d of (await db.collection(col).get()).docs)await d.ref.delete();
  await db.doc('ciclos/r02-history').set({id:'r02-history',code:'27-1',label:'Histórico ficticio',status:'Cerrado',revision:1,specialsEnabled:false});
  await check('No operative cycle / concurrent creation / unique code',async()=>{
    assert.equal((await inspect()).data.state,'NONE');
    const results=await Promise.allSettled([create(),create()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const id=results.find(r=>r.status==='fulfilled').value.cycleId;cycle=await get(id);assert.equal(cycle.status,'Preparacion');
  });
  await check('No direct cycle write or forged control, no module-only management',async()=>{
    await denied(updateDoc(doc(system.db,'ciclos',cycle.id),{status:'Captura'}));
    await denied(setDoc(doc(system.db,'ciclo_control/operativo'),{state:'READY',cycleId:cycle.id}));
    await denied(command('start',cycle,{},ca));
  });
  await check('No create in preparation / forbidden jumps',async()=>{
    await denied(create(),'failed-precondition');
    for(const action of ['closeCapture','close','reopen','specials']) await denied(command(action,cycle,{enabled:true,reason:'Ensayo ficticio'}),'failed-precondition');
  });
  await check('Start capture; idempotent replay and version conflict',async()=>{
    const data={action:'start',cycleId:cycle.id,expectedRevision:cycle.revision,operationId:randomUUID()};
    const fn=httpsCallable(system.functions,'cycleCommand');const replies=await Promise.all([fn(data),fn(data)]); assert.deepEqual(replies[0].data,replies[1].data); const result=replies[0]; const before=await snapshot();
    assert.deepEqual((await fn(data)).data,result.data); assert.deepEqual(await snapshot(),before);
    await denied(command('closeCapture',cycle),'aborted');cycle=await get(cycle.id);
    await denied(create(),'failed-precondition');await denied(command('close',cycle),'failed-precondition');
  });
  await check('Code and dates: invalid calendar or previous date has no effects',async()=>{
    const before=await snapshot();
    for(const date of ['2026-02-30','2026-01-01','not-a-date']) await denied(command('schedule',cycle,{date}),'invalid-argument');
    assert.deepEqual(await snapshot(),before);
  });
  const assignment={cycle:'28-1',program:'ADM',group:'28-1 ADM 11 01',subjectId:'TEST',subjectName:'FICTICIO',moodleId:'r02-a',normalizedMoodleId:'r02-a',teacherMoodleUser:'demo-docente-1',teacherName:'FICTICIO',status:'EN_CAPTURA',assignmentType:'REGULAR',special:false,createdBy:ca.auth.currentUser.uid,createdAt:'2026-10-21T00:00:00Z',studentEnrollments:'001'};
  await db.doc('grupos/28_1_ADM_11_01').set({fullGroup:assignment.group,cycleCode:'28-1',programAbbreviation:'ADM',section:'01',modality:'Escolarizado',status:'Activo'});
  await check('Capture positive: create and edit',async()=>{await setDoc(doc(ca.db,'asignaciones/r02-a'),assignment);await updateDoc(doc(ca.db,'asignaciones/r02-a'),{teacherName:'FICTICIO DOS'});await updateDoc(doc(system.db,'grupos/28_1_ADM_11_01'),{programName:'CAPTURA'});});
  await check('Two commands on same version: exactly one commits',async()=>{
    const results=await Promise.allSettled([command('closeCapture',cycle),command('closeCapture',cycle)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/CONFLICTO_VERSION/);cycle=await get(cycle.id);
  });
  await check('D1: prepared write rejected after closure; loaded assignments too',async()=>{
    await denied(create(),'failed-precondition');
    await denied(updateDoc(doc(ca.db,'asignaciones/r02-a'),{teacherName:'TARDE'}));
    await db.doc('asignaciones/r02-a').update({status:'CARGADO_MOODLE'});
    await denied(updateDoc(doc(ca.db,'asignaciones/r02-a'),{studentEnrollments:'002'}));
    await denied(setDoc(doc(ca.db,'asignaciones/r02-new'),{...assignment,moodleId:'r02-new',normalizedMoodleId:'r02-new'}));
    await denied(updateDoc(doc(system.db,'grupos/28_1_ADM_11_01'),{programName:'TARDE'}));
    await denied(updateDoc(doc(ca.db,'docentes/demo-docente-1'),{fullName:'TARDE'}));
    const refs=['grupos/28_1_ADM_11_01','docentes/demo-docente-1','asignaciones/r02-a'];
    const before=await Promise.all(refs.map(async p=>(await db.doc(p).get()).data()));
    const batch=writeBatch(system.db);batch.update(doc(system.db,refs[0]),{programName:'BATCH'});batch.update(doc(system.db,refs[1]),{fullName:'BATCH'});batch.update(doc(system.db,refs[2]),{studentEnrollments:'BATCH'});
    await denied(batch.commit());assert.deepEqual(await Promise.all(refs.map(async p=>(await db.doc(p).get()).data())),before);
  });
  await check('Request for reopening and cancellation are not academic capture',async()=>{
    const request={requestType:'REABRIR_CAPTURA',cycle:'28-1',sourceProgram:'ADM',destinationProgram:'ADM',requestedBy:ca.auth.currentUser.uid,status:'PENDIENTE'};
    await setDoc(doc(ca.db,'solicitudes_compartidas/r02-reopen-request'),request);
    await updateDoc(doc(ca.db,'solicitudes_compartidas/r02-reopen-request'),{status:'CANCELADA',respondedBy:ca.auth.currentUser.uid});
    assert.equal((await db.doc('solicitudes_compartidas/r02-reopen-request').get()).data().status,'CANCELADA');
    assert.equal((await get(cycle.id)).status,'Captura cerrada');
  });
  await check('Reopen requires reason; reopening and concurrent close/write',async()=>{
    await denied(command('reopen',cycle),'invalid-argument');await command('reopen',cycle,{reason:'RevisiÃ³n ficticia'});cycle=await get(cycle.id);
    // One atomic server request holds a transaction read of the cycle before closing.
    const results=await Promise.allSettled([command('closeCapture',cycle),updateDoc(doc(ca.db,'asignaciones/r02-a'),{studentEnrollments:'003'})]);
    assert.equal(results[0].status,'fulfilled');cycle=await get(cycle.id);
    await denied(updateDoc(doc(ca.db,'asignaciones/r02-a'),{studentEnrollments:'POST CIERRE'}));
    cases.push({name:'Concurrent write ordering',status:'OBSERVED',write:results[1].status,note:'Successful writes may serialize before close; all subsequent writes denied'});
  });
  await check('Specials: disabled denied, enabled admitted group allowed',async()=>{
    await db.doc('grupos/28_1_ADM_11_C_A').set({fullGroup:'28-1 ADM 11 C.A',cycleCode:'28-1',programAbbreviation:'ADM',section:'C.A',modality:'Virtual',status:'Activo'});
    const special={...assignment,moodleId:'r02-special',normalizedMoodleId:'r02-special',group:'28-1 ADM 11 C.A',assignmentType:'ESPECIAL',special:true};
    await denied(setDoc(doc(ca.db,'asignaciones/r02-special'),special));
    await command('specials',cycle,{enabled:true});cycle=await get(cycle.id);
    await setDoc(doc(ca.db,'asignaciones/r02-special'),special);
    await updateDoc(doc(ca.db,'asignaciones/r02-special'),{studentEnrollments:'003'});
  });
  await check('Specials does not permit ordinary/reclassification/Escolarizado/Ejecutivo',async()=>{
    await denied(updateDoc(doc(ca.db,'asignaciones/r02-a'),{studentEnrollments:'BAD'}));
    await denied(updateDoc(doc(system.db,'asignaciones/r02-a'),{assignmentType:'ESPECIAL',special:true,group:'28-1 ADM 11 C.A'}));
    for(const modality of ['Escolarizado','Ejecutivo']) {await db.doc('grupos/28_1_ADM_11_C_A').update({modality});await inspect();await denied(updateDoc(doc(ca.db,'asignaciones/r02-special'),{studentEnrollments:modality}));}
    await db.doc('grupos/28_1_ADM_11_C_A').update({modality:'Virtual'});await inspect();
  });
  await check('Specials actors: academic foreign enrollment, CUSTOM and delegated scope',async()=>{
    const foreign={...(await db.doc('asignaciones/r02-special').get()).data(),program:'DER',group:'28-1 DER 11 C.A',moodleId:'r02-foreign-special',normalizedMoodleId:'r02-foreign-special'};
    await db.doc('grupos/28_1_DER_11_C_A').set({fullGroup:foreign.group,cycleCode:'28-1',programAbbreviation:'DER',section:'C.A',modality:'Virtual',status:'Activo'});
    await db.doc('asignaciones/r02-foreign-special').set(foreign);await inspect();
    await updateDoc(doc(ca.db,'asignaciones/r02-foreign-special'),{studentEnrollments:'CA-ADM-LEGITIMO'});
    const adminAuth=require('firebase-admin/auth').getAuth(app);const uid='r02-custom';
    try {await adminAuth.createUser({uid,email:'r02-custom@example.invalid',password});}catch(e){if(e.code!=='auth/uid-already-exists')throw e;}
    const template=(await db.doc(`usuarios/${ca.auth.currentUser.uid}`).get()).data();
    await db.doc(`usuarios/${uid}`).set({...template,id:uid,email:'r02-custom@example.invalid',baseRole:'CUSTOM',permissionSchemaVersion:2,permissions:{asignaciones:'EDIT',ciclos:'EDIT'},capabilities:[],scope:{programs:['ADM'],cycles:['28-1'],teachers:[],fields:[]}});
    const custom=runtime.initializeFirebaseRuntime(localConfig,uid);clients.push(custom);await signInWithEmailAndPassword(custom.auth,'r02-custom@example.invalid',password);
    await updateDoc(doc(custom.db,'asignaciones/r02-special'),{studentEnrollments:'CUSTOM-ADM'});
    await denied(updateDoc(doc(custom.db,'asignaciones/r02-foreign-special'),{studentEnrollments:'CUSTOM-DER'}));
    await denied(command('specials',cycle,{enabled:false},custom));
    await db.doc('asignaciones/r02-outside-cycle').set({...foreign,cycle:'99-9'});
    await denied(getDocFromServer(doc(custom.db,'asignaciones/r02-outside-cycle')));
    const caRef=db.doc(`usuarios/${ca.auth.currentUser.uid}`);const caSaved=(await caRef.get()).data();
    try {await caRef.update({'scope.cycles':['28-1']});await denied(getDocFromServer(doc(ca.db,'asignaciones/r02-outside-cycle')));}
    finally {await caRef.set(caSaved);}
    const before=(await db.doc('asignaciones/r02-foreign-special').get()).data();assert.equal(before.studentEnrollments,'CA-ADM-LEGITIMO');
    const user=db.doc('usuarios/demo-auxiliar');const saved=(await user.get()).data();
    const grant={id:'r02-academic-grant',userId:'demo-auxiliar',status:'ACTIVE',permissions:{asignaciones:'EDIT'},capabilities:[],scope:{programs:['ADM'],cycles:['28-1'],teachers:[],fields:['studentEnrollments']}};
    await db.doc(`delegaciones/${grant.id}`).set(grant);await user.update({delegationId:grant.id});
    const aux=await client('demo-auxiliar');
    try {await updateDoc(doc(aux.db,'asignaciones/r02-special'),{studentEnrollments:'AUX-ADM'});await denied(updateDoc(doc(aux.db,'asignaciones/r02-foreign-special'),{studentEnrollments:'AUX-DER'}));}
    finally {await user.set(saved);await db.doc(`delegaciones/${grant.id}`).delete();}
    assert.deepEqual((await db.doc('asignaciones/r02-foreign-special').get()).data(),before);
  });
  await check('Specials own deletion is allowed; outside scope remains denied',async()=>{
    const special=(await db.doc('asignaciones/r02-special').get()).data();
    await db.doc('asignaciones/r02-delete-special').set(special);
    await deleteDoc(doc(ca.db,'asignaciones/r02-delete-special'));assert.equal((await db.doc('asignaciones/r02-delete-special').get()).exists,false);
    await denied(deleteDoc(doc(ca.db,'asignaciones/r02-foreign-special')));
  });
  await check('Disable Specials: open-form confirmation denied',async()=>{const race=await Promise.allSettled([command('specials',cycle,{enabled:false}),updateDoc(doc(ca.db,'asignaciones/r02-special'),{studentEnrollments:'RACE'})]);assert.equal(race[0].status,'fulfilled');cycle=await get(cycle.id);await denied(updateDoc(doc(ca.db,'asignaciones/r02-special'),{studentEnrollments:'TARDE'}));});
  await check('Atomic rejection on audit and event collision',async()=>{
    for(const collection of ['bitacora','eventos_ciclo']) {
      const operationId=randomUUID();const id=`${collection==='bitacora'?'ciclo_':''}demo-sistemas_${operationId}`;
      await db.doc(`${collection}/${id}`).set({test:'collision'});const before=await snapshot();
      await assert.rejects(command('reopen',cycle,{reason:'Prueba colisiÃ³n',operationId}));assert.deepEqual(await snapshot(),before);
    }
  });
  await check('Delegated cycle management: scope, capability, revocation and expiry',async()=>{
    const userRef=db.doc('usuarios/demo-auxiliar');const saved=(await userRef.get()).data();
    const grantRef=db.doc('delegaciones/r02-cycle-grant');
    const grant={id:'r02-cycle-grant',userId:'demo-auxiliar',status:'ACTIVE',permissions:{ciclos:'EDIT'},capabilities:['MANAGE_CYCLES'],scope:{programs:[],cycles:['28-1'],teachers:[],fields:['*']}};
    await grantRef.set(grant);await userRef.update({delegationId:grant.id});
    const aux=await client('demo-auxiliar');
    try {
      await command('reopen',cycle,{reason:'DelegaciÃ³n ficticia'},aux);cycle=await get(cycle.id);
      await grantRef.update({'scope.cycles':['99-9']});await denied(command('closeCapture',cycle,{},aux));
      await grantRef.set({...grant,capabilities:[]});await denied(command('closeCapture',cycle,{},aux));
      await grantRef.set({...grant,status:'REVOKED'});await denied(command('closeCapture',cycle,{},aux));
      await grantRef.set({...grant,expiresAtMillis:1000});await denied(command('closeCapture',cycle,{},aux));
      await grantRef.set({...grant,expiresAtMillis:2000});let calls=0;
      const timed=require('./cycles/service.js').createCycleService(db,{nowMillis:()=>++calls<4?1999:2001});
      const before=await snapshot();await denied(timed.execute({uid:'demo-auxiliar'},{action:'closeCapture',operationId:randomUUID(),cycleId:cycle.id,expectedRevision:cycle.revision}));assert.deepEqual(await snapshot(),before);
      await command('closeCapture',cycle);cycle=await get(cycle.id);
    } finally {await userRef.set(saved);await grantRef.delete();}
  });
  await check('Final close / residual Specials / no transition from historical / next preparation',async()=>{
    await command('close',cycle);cycle=await get(cycle.id);await db.doc(`ciclos/${cycle.id}`).update({specialsEnabled:true});
    await denied(updateDoc(doc(ca.db,'asignaciones/r02-special'),{studentEnrollments:'CERRADO'}));
    for(const action of ['start','closeCapture','reopen','close','specials']) await denied(command(action,cycle,{enabled:true,reason:'Ensayo'}),'failed-precondition');
    await denied(create(),'failed-precondition'); // Two histories: capacity checked before code uniqueness.
    const history=await get('r02-history');await command('purge',history,{reason:'Histórico ficticio vacío, renovación aislada'});
    await denied(create(),'already-exists'); // Once capacity exists, duplicate code remains forbidden.
    const next=await command('create',null,{payload:{code:'28-2',label:'Siguiente ficticio'}});assert.equal(next.status,'Preparacion');
    await denied(setDoc(doc(ca.db,'asignaciones/r02-preparation'),{...assignment,cycle:'28-2'}));
  });
} finally {
  mkdirSync(resolve(root,'.local/test-results'),{recursive:true});writeFileSync(resolve(root,'.local/test-results/r02.json'),JSON.stringify({date:new Date().toISOString(),cases},null,2));
  for(const c of clients){await terminate(c.db);await deleteApp(c.app);}await adminApp.deleteApp(app);network.restore?.();
}
