import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync,mkdirSync} from 'node:fs';
import {root,config,isolatedTest,localEnvironment,verifyHub,password} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
import {guardNetwork} from '../local/tests/network-guard.mjs';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {getDocFromServer,doc,updateDoc,terminate} from 'firebase/firestore';
import {deleteApp} from 'firebase/app';
assert.equal(isolatedTest,true);assert.equal(config.firestore,18080);guardNetwork();await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json'));
const admin=require('firebase-admin/app').initializeApp({projectId:config.projectId},'inheritance-tests');
const db=require('firebase-admin/firestore').getFirestore(admin);
const P=require('./security/policy'),{createSecurityService,hash}=require('./security/service');
const collections=['usuarios','roles_personalizados','delegaciones','asignaciones_roles','revisiones_roles','mapeos_permisos','previews_herencia','operaciones_seguridad','bitacora','eventos_seguridad','seguridad','avisos_seguridad'];
const snapshot=async()=>{ for(const event of (await db.collection('eventos_seguridad').get()).docs) await require('./security/service').processNotification(db,event.id,true); return Object.fromEntries(await Promise.all(collections.map(async c=>[c,Object.fromEntries((await db.collection(c).get()).docs.map(d=>[d.id,d.data()]))]))); };
const original=await snapshot();
async function restore(state){for(const c of collections){const current=await db.collection(c).get();for(const d of current.docs)if(!state[c]?.[d.id])await d.ref.delete();for(const [id,data] of Object.entries(state[c]??{}))await db.doc(c+'/'+id).set(data);}}
let now=Date.now(),seq=0;const service=createSecurityService(db,{nowMillis:()=>now});
const results=[];const scope=P.scope({programs:['ADM'],cycles:['27-1'],teachers:['demo-docente-1'],fields:['observations']});
const profile=(id,role='CUSTOM',permissions={},s=scope)=>({id,authUid:id,name:'Ficticio '+id,email:id+'@tecplayacar.edu.mx',area:'Sistemas',role:'Etiqueta',greetingGender:'Masculino',baseRole:role,status:'Activo',permissionSchemaVersion:2,revision:1,permissions:P.levels(permissions),basePermissions:P.levels(permissions),capabilities:[],baseCapabilities:[],scope:s,baseScope:s,assignedPrograms:s.programs});
const seed={usuarios:{'demo-sistemas':profile('demo-sistemas','ADMIN_GENERAL'),'inherit-admin2':profile('inherit-admin2','ADMIN_GENERAL'),'inherit-source':profile('inherit-source','CUSTOM',{asignaciones:'VIEW'}),'demo-inactivo':profile('demo-inactivo','CUSTOM',{},P.scope())},roles_personalizados:{},delegaciones:{},asignaciones_roles:{},revisiones_roles:{},mapeos_permisos:{},previews_herencia:{},operaciones_seguridad:{},bitacora:{},eventos_seguridad:{},seguridad:{}};
const command=(data,uid='demo-sistemas')=>service.execute({uid},{operationId:'inherit-test-'+(++seq),reason:'Ensayo sintético de herencia',...data});
const preview=(extra={})=>command({action:'previewInheritance',sourceId:'inherit-source',targetId:'demo-inactivo',...extra}).then(r=>r.inheritancePreview);
const apply=(p,extra={})=>command({action:'applyInheritance',targetId:p.targetId,previewId:p.previewId,...extra});
async function rejectedUnchanged(work,pattern){const before=await snapshot();await assert.rejects(work,e=>pattern.test(e.message));assert.equal(hash(await snapshot()),hash(before),'Rechazo con escrituras parciales');}
async function check(name,work){await restore(seed);now=Date.now();await work();results.push({name,status:'PASS'});console.log('HERENCIA PASS '+name);}
const client=runtime.initializeFirebaseRuntime(localConfig,'inheritance-client');
try {
await signInWithEmailAndPassword(client.auth,'demo.inactivo@tecplayacar.edu.mx',password);
await check('Perfil ordinario: fuente intacta, identidad/estado conservados, ámbitos y Rules',async()=>{
 const before=(await db.doc('usuarios/inherit-source').get()).data();const target=(await db.doc('usuarios/demo-inactivo').get()).data();
 const p=await preview();await apply(p);
 assert.deepEqual((await db.doc('usuarios/inherit-source').get()).data(),before);
 const after=(await db.doc('usuarios/demo-inactivo').get()).data();for(const k of ['authUid','name','email','status','greetingGender'])assert.equal(after[k],target[k]);assert.equal(after.permissions.asignaciones,'VIEW');assert.deepEqual(after.scope,scope);
 const positive=await getDocFromServer(doc(client.db,'asignaciones/demo-asignacion-a'));assert.ok(positive.exists());
 await assert.rejects(()=>getDocFromServer(doc(client.db,'asignaciones/demo-asignacion-b')),e=>e.code==='permission-denied'&&!/maximum of|Null value/.test(e.message));
 await assert.rejects(()=>updateDoc(doc(client.db,'asignaciones/demo-asignacion-a'),{observations:'no permitido'}),e=>e.code==='permission-denied');
});
async function customRole(){
 const r={id:'inherit-role',name:'Consulta ficticia',revision:1,status:'ACTIVE',approvedBy:'demo-sistemas',permissions:P.levels({docentes:'VIEW'}),capabilities:[],scope};
 await db.doc('roles_personalizados/inherit-role').set(r);
 await db.doc('asignaciones_roles/inherit-original').set({id:'inherit-original',userId:'inherit-source',roleId:r.id,roleRevision:1,status:'ACTIVE',reviewStatus:'NOT_REQUIRED',permissions:r.permissions,capabilities:[],scope,revision:1});
 await db.doc('usuarios/inherit-source').update({'permissions.docentes':'VIEW'});
}
await check('Rol personalizado: referencia compartida, asignación propia y denegaciones conservadas',async()=>{
 await customRole();await db.doc('usuarios/inherit-source').update({migrationDenials:['docentes'],'permissions.docentes':'NONE'});
 const before=await snapshot(),p=await preview(),r=await apply(p);assert.equal(r.assignmentIds.length,1);assert.notEqual(r.assignmentIds[0],'inherit-original');
 const a=(await db.doc('asignaciones_roles/'+r.assignmentIds[0]).get()).data();assert.equal(a.roleId,'inherit-role');assert.equal(a.provenance.sourceAssignmentId,'inherit-original');
 assert.deepEqual((await db.doc('asignaciones_roles/inherit-original').get()).data(),before.asignaciones_roles['inherit-original']);
 assert.equal((await db.doc('usuarios/demo-inactivo').get()).data().permissions.docentes,'NONE');
});
async function delegated(expiry=now+60000){
 const grant={id:'inherit-grant',userId:'inherit-source',status:'ACTIVE',revision:1,permissions:P.levels({asignaciones:'VIEW'}),capabilities:['MANAGE_CUSTOM_ROLES','VALIDATE_TEACHERS'],scope,expiresAtMillis:expiry};
 await db.doc('delegaciones/inherit-grant').set(grant);await db.doc('usuarios/inherit-source').update({baseRole:'ADMIN_OPERATIVO',delegationId:'inherit-grant',capabilities:grant.capabilities});return grant;
}
await check('Delegación: facultades/ámbitos/plazo idénticos, ID propio y caducidad posterior en Rules',async()=>{
 const g=await delegated();const p=await preview(),r=await apply(p);const copy=(await db.doc('delegaciones/'+r.delegationId).get()).data();assert.notEqual(r.delegationId,g.id);
 for(const k of ['capabilities','scope','expiresAtMillis','permissions'])assert.deepEqual(copy[k],g[k]);
 assert.ok((await getDocFromServer(doc(client.db,'asignaciones/demo-asignacion-a'))).exists());
 await db.doc('delegaciones/'+r.delegationId).update({expiresAtMillis:1});
 await assert.rejects(()=>getDocFromServer(doc(client.db,'asignaciones/demo-asignacion-a')),e=>e.code==='permission-denied'&&!/maximum of|Null value/.test(e.message));
 const u=(await db.doc('usuarios/demo-inactivo').get()).data();assert.equal(P.effective(u,{...copy,expiresAtMillis:1},{nowMillis:now}).active,false);
 await rejectedUnchanged(()=>command({action:'assignRole',targetId:'inherit-source',roleId:'missing'},'demo-inactivo'),/REVOCADO|autorizado/);
});
await check('Identidad propia, alias y autoescalamiento rechazados sin escrituras',async()=>{
 await rejectedUnchanged(()=>preview({targetId:'inherit-source'}),/misma identidad/);
 await db.doc('usuarios/inherit-alias').set({identityAliasOf:'inherit-source'});
 await rejectedUnchanged(()=>preview({targetId:'inherit-alias'}),/misma identidad/);
 await rejectedUnchanged(()=>preview({sourceId:'inherit-alias'}),/canónicas/);
 await rejectedUnchanged(()=>preview({targetId:'demo-sistemas',replace:true}),/propio operador/);
});
await check('Operador no autorizado: comando directo y callable',async()=>{
 await rejectedUnchanged(()=>command({action:'previewInheritance',sourceId:'inherit-source',targetId:'demo-inactivo'},'inherit-source'),/Permiso/);
 const before=hash(await snapshot());await assert.rejects(()=>httpsCallable(client.functions,'securityCommand')({action:'previewInheritance',sourceId:'inherit-source',targetId:'demo-inactivo',operationId:'remote-denied'}),e=>e.code==='functions/permission-denied');assert.equal(hash(await snapshot()),before);
});
await check('Cuenta inactiva/revocada requiere reemplazo; no reactivación ni unión, historial y revisiones intactos',async()=>{
 await db.doc('usuarios/demo-inactivo').update({status:'Inactivo',permissions:P.levels({docentes:'EDIT'}),basePermissions:P.levels({docentes:'EDIT'}),scope:P.scope({programs:['DER']}),baseScope:P.scope({programs:['DER']})});
 await db.doc('asignaciones_roles/old-assignment').set({userId:'demo-inactivo',status:'ACTIVE',roleId:'old-role',revision:1,reviewStatus:'REQUIERE_REVISION_ADMIN_GENERAL'});
 await db.doc('revisiones_roles/old-review').set({userId:'demo-inactivo',assignmentId:'old-assignment',status:'REQUIERE_REVISION_ADMIN_GENERAL',revision:1});
 await rejectedUnchanged(()=>preview(),/Reemplazar/);const p=await preview({replace:true});assert.equal(p.retire.assignments.length,1);await apply(p);
 const u=(await db.doc('usuarios/demo-inactivo').get()).data();assert.equal(u.status,'Inactivo');assert.equal(u.permissions.docentes,'NONE');assert.deepEqual(u.scope,scope);assert.equal((await db.doc('asignaciones_roles/old-assignment').get()).data().status,'REMOVED');assert.equal((await db.doc('revisiones_roles/old-review').get()).data().status,'REQUIERE_REVISION_ADMIN_GENERAL');
});
for(const change of ['source','target','role','delegation','revocation','expiry','preview expiry','operator']){
 await check('Preview obsoleta por '+change+'; ningún cambio parcial',async()=>{
  if(change==='role')await customRole();if(['delegation','revocation','expiry'].includes(change))await delegated();
  const p=await preview();
  if(change==='source')await db.doc('usuarios/inherit-source').update({revision:2});
  if(change==='target')await db.doc('usuarios/demo-inactivo').update({revision:2});
  if(change==='role')await db.doc('roles_personalizados/inherit-role').update({revision:2});
  if(change==='delegation')await db.doc('delegaciones/inherit-grant').update({revision:2});
  if(change==='revocation')await db.doc('delegaciones/inherit-grant').update({status:'REVOKED'});
  if(change==='expiry')now+=60001;
  if(change==='preview expiry')now+=300001;
  if(change==='operator')await db.doc('usuarios/demo-sistemas').update({status:'Inactivo'});
  await rejectedUnchanged(()=>apply(p),/OBSOLETA|vigente|cambió|autorizado|vigencia/);
 });
}
await check('Caducidad durante lectura de confirmación: se vuelve a consultar el reloj antes de escribir',async()=>{
 const p=await preview();let calls=0;
 const delayed=createSecurityService(db,{nowMillis:()=>++calls>=3 ? p.expiresAtMillis+1 : now});
 await rejectedUnchanged(()=>delayed.execute({uid:'demo-sistemas'},{action:'applyInheritance',targetId:p.targetId,previewId:p.previewId,operationId:'delayed-confirm',reason:'Confirmación ficticia demorada'}),/OBSOLETA/);
});
await check('Idempotencia: doble confirmación no duplica registros, auditoría ni evento',async()=>{
 await customRole();const p=await preview(),request={action:'applyInheritance',targetId:p.targetId,previewId:p.previewId,operationId:'inherit-idempotent',reason:'Confirmación ficticia'};
 const [a,b]=await Promise.all([service.execute({uid:'demo-sistemas'},request),service.execute({uid:'demo-sistemas'},request)]);assert.deepEqual(a,b);const before=await snapshot();assert.deepEqual(await service.execute({uid:'demo-sistemas'},request),a);assert.equal(hash(await snapshot()),hash(before));
 await rejectedUnchanged(()=>service.execute({uid:'demo-sistemas'},{...request,reason:'Otro motivo'}),/reutilizado/);
});
await check('Último administrador protegido',async()=>{
 // The operator cannot replace itself, so an active linked administrator remains.
 await db.doc('usuarios/inherit-admin2').delete();await rejectedUnchanged(()=>preview({targetId:'demo-sistemas',replace:true}),/propio operador/);
});
await check('Origen temporal, revocado o configuración inconsistente bloqueados',async()=>{
 await db.doc('usuarios/inherit-source').update({permissionSchemaVersion:1});await rejectedUnchanged(()=>preview(),/Regularizar/);
 await db.doc('usuarios/inherit-source').set({...seed.usuarios['inherit-source'],permissions:P.levels({asignaciones:'EDIT'})});await rejectedUnchanged(()=>preview(),/no coincide/);
});
await check('Reemplazar auxiliar conserva roles concedidos por su delegación y crea revisión',async()=>{
 await db.doc('usuarios/demo-inactivo').update({baseRole:'ADMIN_OPERATIVO',delegationId:'old-grant'});
 await db.doc('delegaciones/old-grant').set({id:'old-grant',userId:'demo-inactivo',status:'ACTIVE',revision:1,permissions:P.levels({docentes:'EDIT'}),scope,capabilities:['MANAGE_CUSTOM_ROLES']});
 await db.doc('asignaciones_roles/downstream').set({id:'downstream',userId:'inherit-admin2',roleId:'prior-role',assignedByDelegationId:'old-grant',status:'ACTIVE',revision:1,reviewStatus:'NOT_REQUIRED'});
 const p=await preview({replace:true});const result=await apply(p);assert.equal(result.reviewIds.length,1);
 assert.equal((await db.doc('delegaciones/old-grant').get()).data().status,'REVOKED');
 const a=(await db.doc('asignaciones_roles/downstream').get()).data();assert.equal(a.status,'ACTIVE');assert.equal(a.reviewStatus,'REQUIERE_REVISION_ADMIN_GENERAL');
 assert.equal((await db.doc('usuarios/demo-inactivo').get()).data().permissions.docentes,'NONE');
});
await check('Editar datos personales conserva permisos/capacidades de rol sin convertirlos en concesión base',async()=>{
 await customRole();await db.doc('roles_personalizados/inherit-role').update({capabilities:[P.REQUEST_CAPABILITY]});await db.doc('asignaciones_roles/inherit-original').update({capabilities:[P.REQUEST_CAPABILITY]});await db.doc('usuarios/inherit-source').update({capabilities:[P.REQUEST_CAPABILITY]});
 const u=(await db.doc('usuarios/inherit-source').get()).data();
 await command({action:'saveUser',targetId:u.id,expectedRevision:1,value:{...u,greetingGender:'Femenino'}});
 const edited=(await db.doc('usuarios/inherit-source').get()).data();assert.equal(edited.permissions.docentes,'VIEW');assert.equal(edited.basePermissions.docentes,'NONE');assert.deepEqual(edited.baseCapabilities,[]);assert.deepEqual(edited.capabilities,[P.REQUEST_CAPABILITY]);
 await command({action:'removeRole',targetId:'inherit-original',expectedRevision:1});
 const removed=(await db.doc('usuarios/inherit-source').get()).data();assert.equal(removed.permissions.docentes,'NONE');assert.deepEqual(removed.capabilities,[]);
});
await check('Límite 200: preview al umbral; creación excedente y lectura 201 rechazan atómicamente',async()=>{
 await customRole();
 let count=(await Promise.all(collections.slice(0,6).map(c=>db.collection(c).get()))).reduce((n,s)=>n+s.size,0);
 for(let i=count;i<200;i++)await db.doc('mapeos_permisos/filler-'+i).set({ficticio:true});
 const p=await preview();await rejectedUnchanged(()=>apply(p),/200 documentos/);
 await db.doc('mapeos_permisos/filler-extra').set({ficticio:true});await rejectedUnchanged(()=>preview(),/200 documentos/);
});
} finally {
 await restore(original);await terminate(client.db);await deleteApp(client.app);await require('firebase-admin/app').deleteApp(admin);
 mkdirSync(resolve(root,'.local/inheritance'),{recursive:true});writeFileSync(resolve(root,'.local/inheritance/server-results.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));
}
