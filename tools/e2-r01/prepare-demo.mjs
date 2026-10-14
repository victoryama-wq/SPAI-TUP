import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { deleteApp } from 'firebase/app';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { terminate } from 'firebase/firestore';
import { config, root, password, sessionFile, localEnvironment, verifyHub } from '../local/config.mjs';
import { runtime, localConfig } from '../local/tests/runtime.mjs';
import { guardNetwork } from '../local/tests/network-guard.mjs';

guardNetwork(); await verifyHub();
assert.equal(JSON.parse(readFileSync(sessionFile,'utf8')).synthetic,true,'Solo una sesion DEMO sintetica');
Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json'));
const {initializeApp,deleteApp:deleteAdmin}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore'); const {getAuth}=require('firebase-admin/auth');
const P=require('./security/policy');
const admin=initializeApp({projectId:config.projectId},'r01-demo-auth');
const db=getFirestore(admin); const auth=getAuth(admin);
const client=runtime.initializeFirebaseRuntime(localConfig,'r01-demo-preparation');
const account=JSON.parse(readFileSync(resolve(root,'src/environments/local-review-accounts.json'),'utf8'))[0];
const changes=[];
try {
 await signInWithEmailAndPassword(client.auth,'demo.sistemas@tecplayacar.edu.mx',password);
 const command=async data=>(await httpsCallable(client.functions,'securityCommand')({operationId:crypto.randomUUID(),reason:'Preparación explícita de identidad ficticia de aceptación R01: ADM / 27-1 / VIEW',...data})).data;
 const roles=await db.collection('roles_personalizados').where('name','==','PRUEBA-R01-Consulta').get();
 assert.ok(roles.size<=1,'Nombre ambiguo: revisar el rol antes de preparar');
 let role=roles.docs[0]; const roleId=role?.id??'demo-r01-role-consulta';
 if(role){
  const r=role.data(); assert.equal(r.status,'ACTIVE'); assert.equal(r.permissions.asignaciones,'VIEW');
  assert.ok(Object.entries(r.permissions).every(([k,v])=>k==='asignaciones'||v==='NONE'));
  assert.deepEqual(r.scope.programs,['ADM']); assert.deepEqual(r.capabilities,[]);
  assert.ok(r.scope.cycles.length===0||JSON.stringify(r.scope.cycles)==='["27-1"]','No se sustituye un ámbito de prueba diferente');
 }
 if(!role||role.data().scope.cycles.length===0){
  await command({action:'saveRole',targetId:roleId,expectedRevision:role?.data().revision??0,value:{name:'PRUEBA-R01-Consulta',permissions:{asignaciones:'VIEW'},capabilities:[],scope:P.scope({programs:['ADM'],cycles:['27-1']})}});
  changes.push('Rol limitado explicitamente a ADM / 27-1');
 }
 role=await db.doc(`roles_personalizados/${roleId}`).get();
 let profile=await db.doc(`usuarios/${account.uid}`).get();
 if(!profile.exists){
  await command({action:'saveUser',targetId:account.uid,expectedRevision:0,value:{name:account.name,email:account.email,area:'Aceptación ficticia R01',role:'Acceso personalizado',baseRole:'CUSTOM',status:'Activo',greetingGender:'Femenino',permissions:{},scope:P.scope({programs:['ADM'],cycles:['27-1']}),assignedPrograms:['ADM']}});
  changes.push('Perfil CUSTOM ficticio creado sin permisos base');
 } else {
  assert.equal(profile.data().email,account.email);assert.equal(profile.data().baseRole,'CUSTOM');assert.equal(profile.data().status,'Activo','No reactivar perfiles retirados');
 }
 profile=await db.doc(`usuarios/${account.uid}`).get();
 const assignments=await db.collection('asignaciones_roles').where('userId','==',account.uid).get();
 const active=assignments.docs.filter(d=>d.data().status==='ACTIVE');
 if(active.length===0){
  assert.equal(assignments.size,0,'No restaurar una asignacion retirada sin revisión');
  await command({action:'assignRole',targetId:account.uid,expectedRevision:profile.data().revision,roleId,roleRevision:role.data().revision});
  changes.push('Rol preaprobado asignado mediante callable auditado');
 } else { assert.equal(active.length,1); assert.equal(active[0].data().roleId,roleId); }
 try { const existing=await auth.getUser(account.uid);assert.equal(existing.email,account.email); }
 catch(error){if(error.code!=='auth/user-not-found')throw error;await auth.createUser({uid:account.uid,email:account.email,displayName:account.name,password,emailVerified:true});changes.push('Identidad creada solo en Authentication Emulator');}
 await signInWithEmailAndPassword(client.auth,account.email,password);
 await httpsCallable(client.functions,'syncUserProfileByEmail')({});
 const final=(await db.doc(`usuarios/${account.uid}`).get()).data();
 assert.equal(final.authUid,account.uid); assert.equal(final.permissions.asignaciones,'VIEW');
 if(process.argv.includes('--capture-fixture')){
  const ref=db.doc('ciclos/demo-27-1'); const cycle=(await ref.get()).data();
  assert.equal(cycle?.code,'27-1');assert.equal(cycle?.label,'Ciclo DEMO 27-1');
  if(cycle.status!=='Captura'){
   mkdirSync(resolve(root,'.local/acceptance'),{recursive:true});
   writeFileSync(resolve(root,`.local/acceptance/capture-fixture-before-${Date.now()}.json`),JSON.stringify(cycle,null,2));
   // Explicit synthetic scenario preparation, not an implementation of reopening.
   await ref.update({status:'Captura',closedAt:null,captureClosedAt:null});
   changes.push('Fixture 27-1 preparado expresamente en Captura; estado anterior conservado localmente');
  }
 }
 const result={time:new Date().toISOString(),project:config.projectId,account,roleId,scope:final.scope,permissions:final.permissions,changes};
 mkdirSync(resolve(root,'.local/acceptance'),{recursive:true});writeFileSync(resolve(root,'.local/acceptance/demo-identity.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}finally{await terminate(client.db);await deleteApp(client.app);await deleteAdmin(admin);}
