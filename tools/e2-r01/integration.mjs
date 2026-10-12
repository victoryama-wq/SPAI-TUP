import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { deleteApp } from 'firebase/app';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, collection, getDocFromServer, getDocsFromServer, query, where, setDoc, updateDoc, deleteField, terminate } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { root, config, password, localEnvironment, verifyHub } from '../local/config.mjs';
import { runtime, localConfig } from '../local/tests/runtime.mjs';
import { guardNetwork } from '../local/tests/network-guard.mjs';
if (process.env.SPAI_LOCAL_SYNTHETIC !== 'true') throw new Error('Solo fixtures sintéticos mediante test:r01.');
const network=guardNetwork(); await verifyHub(); Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json'));
const {initializeApp,deleteApp:deleteAdmin}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore'); const {getAuth}=require('firebase-admin/auth');
const P=require('./security/policy'); const {createSecurityService,processNotification}=require('./security/service');
const app=initializeApp({projectId:config.projectId},'r01-setup'); const db=getFirestore(app); const service=createSecurityService(db);
const clients=new Map(); const results=[]; let sequence=0; let completed=false;
const timestamp='2026-10-12T00:00:00.000Z';
const profile=(key,baseRole='CUSTOM',permissions={},programs=['ADM'])=>({id:key,authUid:key,area:key==='r01-admin2'?'Jefatura Académica':'Sistemas',name:`Ficticio ${key}`,email:`${key}@tecplayacar.edu.mx`,role:'Etiqueta sin autoridad',baseRole,permissionSchemaVersion:2,status:'Activo',revision:1,permissions:P.levels(permissions),basePermissions:P.levels(permissions),scope:P.scope({programs,cycles:['27-1']}),baseScope:P.scope({programs,cycles:['27-1']}),assignedPrograms:programs,access:Object.fromEntries(P.MODULES.map(k=>[k,(permissions[k]??'NONE')!=='NONE'])),createdAt:timestamp,updatedAt:timestamp});
const read=async path=>(await db.doc(path).get()).data();
const rev=async path=>(await read(path)).revision??0;
const ref=(who,path)=>doc(clients.get(who).db,path);
async function check(name,operation){await operation();results.push({name,status:'PASS'});console.log(`R01 PASS ${name}`);}
async function denied(operation,code='permission-denied',message,kind){await assert.rejects(operation,e=> {
  if (/maximum of|INTERNAL|UNAVAILABLE/i.test(e.message)) return false;
  // The emulator reports both pre-evaluation and evaluation with the resource.
  // Every expression initially reported as an error must also have an explicit
  // false result at that SAME allow line; catch-all false alone is insufficient.
  for (const match of e.message.matchAll(/evaluation error at L(\d+):\d+ for '(\w+)'/g)) {
    // setDoc first checks create AND update before knowing document existence.
    // For a verified nonexistent document only the final create evaluation counts.
    if (kind === 'create' && match[2] === 'update') continue;
    if (!e.message.includes(`false for '${match[2]}' @ L${match[1]},`) && !e.message.endsWith(`false for '${match[2]}' @ L${match[1]}`)) return false;
  }
  return (e.code===code||e.code===`functions/${code}`) && (!message||e.message.includes(message));
});}
async function command(who,data){return (await httpsCallable(clients.get(who).functions,'securityCommand')({operationId:`r01-op-${++sequence}`,reason:'Prueba sintética R01',...data})).data;}
const scope=P.scope({programs:['ADM']});
try {
 for(const [key,baseRole,permissions,programs] of [
  ['r01-admin','ADMIN_GENERAL',{},[]],['r01-admin2','ADMIN_GENERAL',{},[]],['r01-aux','ADMIN_OPERATIVO',{},['ADM']],
  ['r01-person','CUSTOM',{},['ADM']],['r01-person2','CUSTOM',{},['ADM']],['r01-foreign','CUSTOM',{},['DER']],
  ['r01-view','CUSTOM',{grupos:'VIEW'},['ADM']],['r01-edit','CUSTOM',{docentes:'EDIT',asignaciones:'EDIT',solicitudes:'EDIT'},['ADM']],
  ['r01-academic','COORDINACION_ACADEMICA',{docentes:'EDIT',asignaciones:'EDIT',solicitudes:'EDIT',grupos:'VIEW'},['ADM']],
  ['r01-inactive','ADMIN_GENERAL',{},[]],['r01-legacy','CUSTOM',{},['ADM']],
 ]){
  await getAuth(app).createUser({uid:key,email:`${key}@tecplayacar.edu.mx`,password,emailVerified:true});
  const p=profile(key,baseRole,permissions,programs);if(key==='r01-inactive')p.status='Inactivo';if(key==='r01-legacy'){delete p.permissionSchemaVersion;delete p.baseRole;p.access.docentes=true;delete p.permissions;}
  await db.doc(`usuarios/${key}`).set(p);
  const client=runtime.initializeFirebaseRuntime(localConfig,key);clients.set(key,client);await signInWithEmailAndPassword(client.auth,`${key}@tecplayacar.edu.mx`,password);
 }
 clients.set('anonymous',runtime.initializeFirebaseRuntime(localConfig,'r01-anonymous'));
 const assignment={cycle:'27-1',program:'ADM',group:'27-1 ADM 11 01',createdBy:'r01-academic',createdAt:timestamp,updatedAt:timestamp,moodleId:'synthetic',normalizedMoodleId:'synthetic',subjectId:'DEMO101',subjectName:'Ficticia',teacherMoodleUser:'demo-docente-1',status:'EN_CAPTURA',studentEnrollments:''};
 await db.doc('asignaciones/r01-own').set(assignment);await db.doc('asignaciones/r01-foreign').set({...assignment,program:'DER'});
 await db.doc('docentes/r01-own').set({normalizedMoodleUser:'r01-own',moodleUser:'r01-own',email:'r01-own@example.invalid',status:'PENDIENTE',origin:'MANUAL',createdBy:'r01-edit',assignedCoordinatorIds:[],fullName:'FICTICIO',createdAt:timestamp});
 await db.doc('docentes/r01-other').set({normalizedMoodleUser:'r01-other',moodleUser:'r01-other',status:'PENDIENTE',origin:'MANUAL',createdBy:'r01-foreign',assignedCoordinatorIds:[],fullName:'FICTICIO',createdAt:timestamp});
 for(const who of ['anonymous','r01-inactive','r01-legacy','r01-person']) await check(`Lectura denegada ${who}`,()=>denied(()=>getDocFromServer(ref(who,'grupos/27_1_ADM_11_01'))));
 await check('Directorio callable exige Auth y Administración',async()=>{await denied(()=>httpsCallable(clients.get('anonymous').functions,'securityDirectory')({}),'unauthenticated');await denied(()=>httpsCallable(clients.get('r01-academic').functions,'securityDirectory')({}));await denied(()=>getDocsFromServer(collection(clients.get('r01-academic').db,'usuarios')));});
 await check('VIEW consulta ámbito propio y rechaza ámbito ajeno/escritura',async()=>{
  assert.equal((await getDocFromServer(ref('r01-view','grupos/27_1_ADM_11_01'))).exists(),true);
  assert.ok((await getDocsFromServer(query(collection(clients.get('r01-view').db,'grupos'),where('programAbbreviation','==','ADM')))).size>0);
  await denied(()=>getDocFromServer(ref('r01-view','grupos/27_1_DER_11_01')));
  await denied(()=>updateDoc(ref('r01-view','grupos/27_1_ADM_11_01'),{programName:'NO'}));
 });
 await check('EDIT ficha propia sin identidad ni ajenas',async()=>{
  await updateDoc(ref('r01-edit','docentes/r01-own'),{fullName:'FICTICIO EDITADO'});
  await denied(()=>updateDoc(ref('r01-edit','docentes/r01-other'),{fullName:'NO'}));
  for(const change of [{moodleUser:'otra'},{email:'otra@example.invalid'},{status:'VALIDADO'},{createdBy:'r01-edit'},{assignedCoordinatorIds:['r01-edit']}]) await denied(()=>updateDoc(ref('r01-edit','docentes/r01-other'),change));
  await denied(()=>updateDoc(ref('r01-edit','docentes/r01-own'),{email:'otra@example.invalid'}));
 });
 await check('Asignaciones propias y excepción global de matrículas sin complejidad',async()=>{
  await updateDoc(ref('r01-edit','asignaciones/r01-own'),{teacherName:'FICTICIO'});
  await denied(()=>updateDoc(ref('r01-edit','asignaciones/r01-foreign'),{teacherName:'NO'}));
  await updateDoc(ref('r01-academic','asignaciones/r01-foreign'),{studentEnrollments:'sintetico-0001'});
  assert.equal((await db.doc('asignaciones/r01-forged').get()).exists,false);
  await denied(()=>setDoc(ref('r01-academic','asignaciones/r01-forged'),{...assignment,program:'DER',createdByPrograms:['DER']}),'permission-denied',undefined,'create');
 });
 await check('Identidad de asignación Moodle protegida incluso para administrador',async()=>{
  await db.doc('asignaciones/r01-own').update({status:'CARGADO_MOODLE'});
  await denied(()=>updateDoc(ref('r01-admin','asignaciones/r01-own'),{subjectId:'NO'}));
 });
 await check('Autoservicio no permite modificar, añadir o eliminar privilegios',async()=>{
  for(const change of [{role:'Coordinación de Sistemas'},{baseRole:'ADMIN_GENERAL'},{status:'Activo',permissions:P.levels({usuarios:'EDIT'})},{assignedPrograms:['*']},{delegationId:'false'},{authUid:'other'},{baseRole:deleteField()},{access:deleteField()}]) await denied(()=>updateDoc(ref('r01-person','usuarios/r01-person'),change));
  await db.doc('usuarios/r01-person').update({authUid:null});
  await denied(()=>updateDoc(ref('r01-person','usuarios/r01-person'),{authUid:'r01-person',newPrivilegedField:true}));
  await updateDoc(ref('r01-person','usuarios/r01-person'),{authUid:'r01-person',updatedAt:timestamp});
 });
 await check('Perfil inactivo conserva vinculación sin activarse',async()=>{
  const synced=await httpsCallable(clients.get('r01-inactive').functions,'syncUserProfileByEmail')({});assert.equal(synced.data.synced,true);assert.equal((await read('usuarios/r01-inactive')).status,'Inactivo');
 });
 await check('Cliente no fabrica roles, delegaciones, auditoría ni eventos',async()=>{
  for(const path of ['roles_personalizados/fake','delegaciones/fake','asignaciones_roles/fake','eventos_seguridad/fake']) await denied(()=>setDoc(ref('r01-admin',path),{status:'ACTIVE'}));
  await denied(()=>setDoc(ref('r01-admin','bitacora/fake'),{integrity:'VERIFICADO_SERVIDOR',source:'SERVER'}));
 });
 await check('Administrador crea rol y delegación explícita',async()=>{
  await command('r01-admin',{action:'saveRole',targetId:'r01-role',expectedRevision:0,value:{name:'Consulta de grupos',permissions:{grupos:'VIEW'},scope}});
  const granted=await command('r01-admin',{action:'grantDelegation',targetId:'r01-aux',expectedRevision:1,value:{permissions:{grupos:'VIEW'},capabilities:['MANAGE_CUSTOM_ROLES'],scope}});
  assert.ok(granted.delegationId);
 });
 let assigned;
 await check('Auxiliar asigna preaprobado con procedencia y destinatarios filtrados',async()=>{
  assigned=await command('r01-aux',{action:'assignRole',targetId:'r01-person',expectedRevision:1,roleId:'r01-role',roleRevision:1});
  const stored=await read(`asignaciones_roles/${assigned.assignmentId}`);assert.equal(stored.assignedByDelegationId,(await read('usuarios/r01-aux')).delegationId);
  assert.deepEqual((await read('usuarios/r01-person')).scope,scope,'Un ámbito base sin permisos no amplía el rol asignado');
  assert.equal((await getDocFromServer(ref('r01-person','grupos/27_1_ADM_11_01'))).exists(),true);
  const list=(await httpsCallable(clients.get('r01-aux').functions,'securityDirectory')({})).data;
  assert.ok(!list.usuarios.some(u=>['r01-admin','r01-admin2','r01-foreign'].includes(u.id)));
 });
 await check('Auxiliar no administra definiciones, usuarios, delegaciones ni terceros superiores',async()=>{
  for(const action of ['saveRole','saveUser','grantDelegation','revokeDelegation','approveMapping']) await denied(()=>command('r01-aux',{action,targetId:'r01-person'}));
  for(const targetId of ['r01-aux','r01-admin','r01-foreign']) { const expectedRevision=await rev(`usuarios/${targetId}`); await denied(()=>command('r01-aux',{action:'assignRole',targetId,expectedRevision,roleId:'r01-role',roleRevision:1})); }
 });

 await check('Rol de nombre inocuo no permite superar capacidades ni ámbito',async()=>{
  await command('r01-admin',{action:'saveRole',targetId:'r01-high',expectedRevision:0,value:{name:'Solo consulta aparente',permissions:{docentes:'EDIT'},scope:{programs:['*']}}});
  await denied(()=>command('r01-aux',{action:'assignRole',targetId:'r01-person2',expectedRevision:1,roleId:'r01-high',roleRevision:1}));
 });
 await check('Reintento devuelve mismo resultado sin duplicar auditoría/evento',async()=>{
  const payload={operationId:'r01-same-operation',reason:'Prueba de reintento',action:'assignRole',targetId:'r01-person2',expectedRevision:1,roleId:'r01-role',roleRevision:1};
  const first=await command('r01-aux',payload);const again=await command('r01-aux',payload);assert.deepEqual(again,first);
  assert.equal((await db.collection('asignaciones_roles').where('userId','==','r01-person2').get()).size,1);
  await command('r01-aux',{action:'removeRole',targetId:first.assignmentId,expectedRevision:1});
 });
 let grantId; let reviewId;
 await check('Revocar conserva roles activos, ignora retirados y notifica a todos los administradores',async()=>{
  grantId=(await read('usuarios/r01-aux')).delegationId;
  const result=await command('r01-admin',{action:'revokeDelegation',targetId:grantId,expectedRevision:1});
  assert.equal(result.reviewIds.length,1);reviewId=result.reviewIds[0];
  assert.equal((await read('asignaciones_roles/'+assigned.assignmentId)).status,'ACTIVE');
  assert.equal((await read('asignaciones_roles/'+assigned.assignmentId)).reviewStatus,'REQUIERE_REVISION_ADMIN_GENERAL');
  assert.equal((await getDocFromServer(ref('r01-person','grupos/27_1_ADM_11_01'))).exists(),true);
  const events=await db.collection('eventos_seguridad').where('action','==','revokeDelegation').get();
  assert.ok(events.docs[0].data().recipients.includes('r01-admin2'));
  await getDocFromServer(ref('r01-admin2','revisiones_roles/'+reviewId));
 });
 await check('Sesión abierta revocada pierde acceso directo y operaciones preparadas',async()=>{
  await denied(()=>getDocFromServer(ref('r01-aux','grupos/27_1_ADM_11_01')));
  await denied(()=>command('r01-aux',{action:'assignRole',targetId:'r01-person2',expectedRevision:3,roleId:'r01-role',roleRevision:1}),'permission-denied','PERMISO_REVOCADO');
  await denied(()=>httpsCallable(clients.get('r01-aux').functions,'securityDirectory')({}),'permission-denied','PERMISO_REVOCADO');
 });
 await check('Nueva delegación no reutiliza identidad ni resuelve revisión anterior',async()=>{
  const revision=await rev('usuarios/r01-aux');
  const newGrant=await command('r01-admin2',{action:'grantDelegation',targetId:'r01-aux',expectedRevision:revision,value:{permissions:{grupos:'VIEW'},capabilities:['MANAGE_CUSTOM_ROLES'],scope}});
  assert.notEqual(newGrant.delegationId,grantId);assert.equal((await read('revisiones_roles/'+reviewId)).status,'REQUIERE_REVISION_ADMIN_GENERAL');
 });
 await check('Dos administradores no sobrescriben resolución de revisión',async()=>{
  const common={action:'resolveReview',targetId:reviewId,expectedRevision:1,reason:'Revisión sintética concurrente'};
  const outcomes=await Promise.allSettled([command('r01-admin',{...common,decision:'KEEP'}),command('r01-admin2',{...common,decision:'REMOVE'})]);
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  assert.ok(outcomes.find(o=>o.status==='rejected').reason.code.endsWith('aborted'));
  const review=await read('revisiones_roles/'+reviewId);assert.equal(review.status,'RESOLVED');
  assert.ok(['r01-admin','r01-admin2'].includes(review.resolvedBy));
 });
 await check('Asignación concurrente con revocación nunca queda sin seguimiento',async()=>{
  const grant=(await read('usuarios/r01-aux')).delegationId;
  const personRevision=await rev('usuarios/r01-person2');
  const outcomes=await Promise.allSettled([
   command('r01-aux',{action:'assignRole',targetId:'r01-person2',expectedRevision:personRevision,roleId:'r01-role',roleRevision:1}),
   command('r01-admin',{action:'revokeDelegation',targetId:grant,expectedRevision:1}),
  ]);
  assert.equal(outcomes[1].status,'fulfilled');
  const assignments=await db.collection('asignaciones_roles').where('assignedByDelegationId','==',grant).get();
  for(const item of assignments.docs) {assert.equal(item.data().reviewStatus,'REQUIERE_REVISION_ADMIN_GENERAL');assert.ok((await read('revisiones_roles/'+grant+'_'+item.id)));}
  if(outcomes[0].status==='rejected') assert.ok(outcomes[0].reason.code.endsWith('permission-denied'));
 });
 await check('Migración muestra ausencias y preserva revocaciones explícitas',async()=>{
  await db.doc('usuarios/r01-legacy').update({permissions:{docentes:'NONE'},access:{docentes:true,grupos:false,asignaturas:true}});
  await command('r01-admin',{action:'approveMapping',targetId:'r01-legacy',expectedRevision:1,baseRole:'COORDINACION_ACADEMICA'});
  assert.ok((await getDocsFromServer(collection(clients.get('r01-legacy').db,'asignaturas'))).size > 0, 'Correspondencia temporal verificada conserva consulta legítima antes de migrar');
  await denied(()=>getDocFromServer(ref('r01-legacy','docentes/r01-own')));
  const result=await command('r01-admin',{action:'previewMigration',targetId:'r01-legacy'});
  assert.equal(result.preview.proposed.permissions.docentes,'NONE');assert.equal(result.preview.proposed.permissions.grupos,'NONE');
  assert.equal(result.preview.proposed.status,'LEGACY_UNRESOLVED');
  await command('r01-admin',{action:'applyMigration',targetId:'r01-legacy',previewId:result.preview.previewId});
  assert.equal((await read('usuarios/r01-legacy')).permissions.docentes,'NONE');
 });
 await check('Vista previa obsoleta no restaura permisos ni produce efectos',async()=>{
  const preview=(await command('r01-admin',{action:'previewMigration',targetId:'r01-legacy'})).preview;
  const current=await read('usuarios/r01-legacy');
  await command('r01-admin2',{action:'saveUser',targetId:'r01-legacy',expectedRevision:current.revision,value:{...current,status:'Inactivo',permissions:P.levels()}});
  const before=await read('usuarios/r01-legacy');const auditCount=(await db.collection('bitacora').get()).size;
  await denied(()=>command('r01-admin',{action:'applyMigration',targetId:'r01-legacy',previewId:preview.previewId}),'aborted','MIGRATION_PREVIEW_OBSOLETE');
  assert.deepEqual(await read('usuarios/r01-legacy'),before);assert.equal((await db.collection('bitacora').get()).size,auditCount);
 });
 await check('Identidad técnica vincula UID sin activar ni copiar autoridad de duplicados',async()=>{
  await db.doc('usuarios/r01-inactive').update({authUid:null});
  await httpsCallable(clients.get('r01-inactive').functions,'syncUserProfileByEmail')({});
  assert.equal((await read('usuarios/r01-inactive')).authUid,'r01-inactive');
  assert.equal((await read('usuarios/r01-inactive')).status,'Inactivo');
  const before=await read('usuarios/r01-person');
  await db.doc('usuarios/r01-duplicate').set({...before,id:'r01-duplicate',authUid:null,baseRole:'ADMIN_GENERAL'});
  await httpsCallable(clients.get('r01-person').functions,'syncUserProfileByEmail')({});
  assert.deepEqual(await read('usuarios/r01-person'),before);
  await db.doc('usuarios/r01-duplicate').delete();
 });
 await check('Alta de Docentes consulta catálogo y edita solo ficha propia',async()=>{
  await db.doc('usuarios/r01-foreign').update({baseRole:'ALTA_DOCENTES',permissions:P.levels({docentes:'EDIT'})});
  assert.ok((await getDocsFromServer(collection(clients.get('r01-foreign').db,'docentes'))).size>0);
  await updateDoc(ref('r01-foreign','docentes/r01-other'),{fullName:'ALTA PROPIA'});
  await db.doc('docentes/r01-own').update({assignedCoordinatorIds:['r01-foreign']});
  await denied(()=>updateDoc(ref('r01-foreign','docentes/r01-own'),{fullName:'NO ES MI ALTA'}));
  await denied(()=>updateDoc(ref('r01-foreign','docentes/r01-other'),{status:'VALIDADO'}));
  await denied(()=>updateDoc(ref('r01-foreign','docentes/r01-other'),{moodleUser:'IDENTIDAD AJENA'}));
 });
 await check('Capacidad sensible y ámbitos de ciclo, docente y campos se exigen por separado',async()=>{
  const grantValue={permissions:{ciclos:'EDIT',docentes:'EDIT',asignaciones:'EDIT'},scope:{programs:['ADM'],cycles:['27-1'],teachers:['r01-own'],fields:['notes','fullName','status','teacherName']},capabilities:[]};
  let result=await command('r01-admin',{action:'grantDelegation',targetId:'r01-aux',expectedRevision:await rev('usuarios/r01-aux'),value:grantValue});
  await denied(()=>updateDoc(ref('r01-aux','ciclos/demo-27-1'),{notes:'Sin capacidad'}));
  await updateDoc(ref('r01-aux','docentes/r01-own'),{fullName:'FICHA EN ÁMBITO'});
  await denied(()=>updateDoc(ref('r01-aux','asignaciones/r01-own'),{teacherName:'SIN CAPACIDAD EXTRAORDINARIA'}));
  await denied(()=>updateDoc(ref('r01-aux','docentes/r01-other'),{fullName:'FUERA DE ÁMBITO'}));
  await denied(()=>updateDoc(ref('r01-aux','docentes/r01-own'),{status:'VALIDADO'}));
  await command('r01-admin',{action:'revokeDelegation',targetId:result.delegationId,expectedRevision:1});
  result=await command('r01-admin',{action:'grantDelegation',targetId:'r01-aux',expectedRevision:await rev('usuarios/r01-aux'),value:{...grantValue,capabilities:['MANAGE_CYCLES','VALIDATE_TEACHERS','OPERATE_EXCEPTIONAL_CHANGE']}});
  await updateDoc(ref('r01-aux','ciclos/demo-27-1'),{notes:'AUTORIZADO'});
  await updateDoc(ref('r01-aux','asignaciones/r01-own'),{teacherName:'CORRECCIÓN DELEGADA'});
  await denied(()=>getDocFromServer(ref('r01-aux','asignaciones/demo-asignacion-cerrada')));
  await denied(()=>updateDoc(ref('r01-aux','asignaciones/r01-own'),{subjectName:'IDENTIDAD PROTEGIDA'}));
  await denied(()=>updateDoc(ref('r01-aux','ciclos/demo-26-3'),{notes:'FUERA DE CICLO'}));
  await denied(()=>updateDoc(ref('r01-aux','ciclos/demo-27-1'),{label:'FUERA DE CAMPOS'}));
  await updateDoc(ref('r01-aux','docentes/r01-own'),{status:'VALIDADO'});
  await denied(()=>updateDoc(ref('r01-aux','docentes/r01-own'),{email:'sin-autorizacion@example.invalid'}));
  await command('r01-admin',{action:'revokeDelegation',targetId:result.delegationId,expectedRevision:1});
  await denied(async()=>command('r01-admin2',{operationId:result.delegationId,action:'grantDelegation',targetId:'r01-aux',expectedRevision:await rev('usuarios/r01-aux'),value:grantValue}),'already-exists');
  assert.equal((await read('delegaciones/'+result.delegationId)).status,'REVOKED');
  for(const capability of P.NON_DELEGABLE) await denied(async()=>command('r01-admin',{action:'grantDelegation',targetId:'r01-aux',expectedRevision:await rev('usuarios/r01-aux'),value:{...grantValue,capabilities:[capability]}}));
 });
 await check('Sustitución revisada no reactiva retirados ni mezcla ámbitos',async()=>{
  await db.doc('usuarios/r01-review-person').set(profile('r01-review-person'));
  const granted=await command('r01-admin',{action:'grantDelegation',targetId:'r01-aux',expectedRevision:await rev('usuarios/r01-aux'),value:{permissions:{grupos:'VIEW'},capabilities:['MANAGE_CUSTOM_ROLES'],scope}});
  const assigned=await command('r01-aux',{action:'assignRole',targetId:'r01-review-person',expectedRevision:1,roleId:'r01-role',roleRevision:1});
  const revoked=await command('r01-admin',{action:'revokeDelegation',targetId:granted.delegationId,expectedRevision:1});
  await command('r01-admin',{action:'saveRole',targetId:'r01-replacement',expectedRevision:0,value:{name:'Consulta revisada',permissions:{grupos:'VIEW',asignaturas:'VIEW'},scope}});
  await command('r01-admin2',{action:'resolveReview',targetId:revoked.reviewIds[0],expectedRevision:1,decision:'REPLACE',roleId:'r01-replacement',roleRevision:1});
  assert.equal((await read('asignaciones_roles/'+assigned.assignmentId)).status,'REMOVED');
  const replacements=await db.collection('asignaciones_roles').where('replaces','==',assigned.assignmentId).get();
  assert.equal(replacements.size,1);assert.equal(replacements.docs[0].data().assignedByDelegationId,null);
  assert.equal((await read('usuarios/r01-review-person')).permissions.asignaturas,'VIEW');
  // A removed assignment may still await review; KEEP must preserve REMOVED.
  await db.doc('revisiones_roles/r01-retired-review').set({assignmentId:assigned.assignmentId,userId:'r01-review-person',status:'REQUIERE_REVISION_ADMIN_GENERAL',revision:1});
  await denied(()=>command('r01-admin',{action:'resolveReview',targetId:'r01-retired-review',expectedRevision:1,decision:'REPLACE',roleId:'r01-replacement',roleRevision:1}),'failed-precondition');
  await command('r01-admin',{action:'resolveReview',targetId:'r01-retired-review',expectedRevision:1,decision:'KEEP'});
  assert.equal((await read('asignaciones_roles/'+assigned.assignmentId)).status,'REMOVED');
 });
 await check('Fallo de persistencia de auditoría revierte también cambio y evento',async()=>{
  // Deliberate storage collision tests atomicity, never counts as permission denial.
  const operationId='r01-storage-collision';const eventId='r01-admin_'+operationId;
  await db.doc('bitacora/'+eventId).set({syntheticFault:true});
  const before=await read('seguridad/control');
  await assert.rejects(()=>command('r01-admin',{operationId,action:'saveRole',targetId:'r01-not-committed',expectedRevision:0,value:{name:'No se confirma',permissions:{grupos:'VIEW'},scope}}));
  assert.equal((await db.doc('roles_personalizados/r01-not-committed').get()).exists,false);
  assert.equal((await db.doc('eventos_seguridad/'+eventId).get()).exists,false);
  assert.equal((await db.doc('operaciones_seguridad/'+eventId).get()).exists,false);
  assert.deepEqual(await read('seguridad/control'),before);
  await db.doc('bitacora/'+eventId).delete();
 });
 await check('Cambio, bitácora y evento tienen actor real y efecto idempotente',async()=>{
  const events=await db.collection('eventos_seguridad').get();
  for(const snapshot of events.docs){const event=snapshot.data();const audit=await read('bitacora/'+snapshot.id);assert.equal(audit.integrity,'VERIFICADO_SERVIDOR');assert.deepEqual(audit.actor,event.actor);assert.equal(event.actor.area,(await read('usuarios/'+event.actor.uid)).area);}
  const eventId=events.docs[0].id;
  await Promise.all([processNotification(db,eventId,true),processNotification(db,eventId,true)]);
  const event=await read('eventos_seguridad/'+eventId);assert.equal(event.state,'SIMULADO_LOCAL');assert.equal(event.attempts,1);
  const notices=await db.collection('avisos_seguridad').where('eventId','==',eventId).get();assert.equal(notices.size,event.recipients.length);
  await notices.docs[0].ref.update({read:true});await processNotification(db,eventId,true);
  assert.equal((await notices.docs[0].ref.get()).data().read,true);
 });
 await check('Dos desactivaciones concurrentes conservan al menos un administrador',async()=>{
  // Remove only the synthetic seed administrator for this isolated race.
  await db.doc('usuarios/demo-sistemas').update({status:'Inactivo'});
  const outcomes=await Promise.allSettled([
   command('r01-admin',{action:'deleteUser',targetId:'r01-admin2',expectedRevision:1}),
   command('r01-admin2',{action:'deleteUser',targetId:'r01-admin',expectedRevision:1}),
  ]);
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  assert.equal((await db.collection('usuarios').get()).docs.map(d=>d.data()).filter(P.isGeneral).length,1);
  const rejected=outcomes.find(o=>o.status==='rejected');assert.ok(['functions/permission-denied','functions/failed-precondition'].includes(rejected.reason.code));
 });
 await check('Todas las conexiones observadas permanecen en loopback',async()=>assert.ok((network.attempted ?? network).every(host=>['127.0.0.1','localhost','::1'].includes(host))));
 completed=true;
} finally {
 const coverage = await fetch(`http://${config.host}:${config.firestore}/emulator/v1/projects/${config.projectId}:ruleCoverage`).then(r=>r.json());
 writeFileSync(resolve(root,'.local/test-results/r01-rule-coverage.json'),JSON.stringify(coverage));
 for(const client of clients.values()){await terminate(client.db);await deleteApp(client.app);} await deleteAdmin(app);
 writeFileSync(resolve(root,'.local/test-results/e2-r01.json'),JSON.stringify({testedAt:new Date().toISOString(),completed,passed:results.length,cases:results},null,2));
}
