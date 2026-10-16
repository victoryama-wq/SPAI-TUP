import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as fsdk from 'firebase/firestore';
import {deleteApp} from 'firebase/app';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {root,config,isolatedTest,verifyHub,localEnvironment,password} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
import {guardNetwork} from '../local/tests/network-guard.mjs';
import {auxiliaryFixture} from './auxiliary-fixture.mjs';
assert.equal(isolatedTest,true);guardNetwork();await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json'));const {initializeApp,deleteApp:deleteAdmin}=require('firebase-admin/app');const {getFirestore}=require('firebase-admin/firestore');
const app=initializeApp({projectId:config.projectId},'aux-regression');const db=getFirestore(app);
const out=resolve(root,'.local/aux-review');mkdirSync(out,{recursive:true});
function compile(file,deps){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(resolve(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText,{exports,require:deps});return exports;}
const permissions=compile('src/app/features/users/data/module-permission.service.ts',()=>({Injectable:()=>c=>c}));
const {authorizedQuery}=compile('src/app/core/data/authorized-query.ts',id=>id==='firebase/firestore'?fsdk:permissions);
const c=runtime.initializeFirebaseRuntime(localConfig,'aux-server');const adminClient=runtime.initializeFirebaseRuntime(localConfig,'aux-admin');const results=[];let fixture;
async function check(name,fn){const detail=await fn();results.push({name,status:'PASS',detail});console.log('AUX PASS '+name);}
async function denied(action){await assert.rejects(action,e=>{if(e.code!=='permission-denied'||/Null value|maximum of|INTERNAL|UNAVAILABLE/i.test(e.message))return false;for(const m of e.message.matchAll(/evaluation error at L(\d+):\d+ for '(\w+)'/g))if(!e.message.includes(`false for '${m[2]}' @ L${m[1]},`)&&!e.message.endsWith(`false for '${m[2]}' @ L${m[1]}`))return false;return true;});}
const get=path=>fsdk.getDocFromServer(fsdk.doc(c.db,path));const update=(path,data)=>fsdk.updateDoc(fsdk.doc(c.db,path),data);
try{
 await signInWithEmailAndPassword(c.auth,'demo.auxiliar@tecplayacar.edu.mx',password);await signInWithEmailAndPassword(adminClient.auth,'demo.sistemas@tecplayacar.edu.mx',password);
 fixture=await auxiliaryFixture(db);
 const user={...fixture.grant,id:'demo-auxiliar',authUid:'demo-auxiliar',status:'Activo',permissionSchemaVersion:2,baseRole:'ADMIN_OPERATIVO'};
 await check('Consultas reales del repositorio recuperan positivos solo en el ámbito',async()=>{
  const rows={};for(const [path,sort] of [['docentes','fullName'],['asignaciones','updatedAt'],['moodle_categorias','categoryNumber'],['moodle_plantillas','name']]){const q=authorizedQuery(c.db,path,[fsdk.orderBy(sort)],user);assert.ok(q);const docs=(await fsdk.getDocsFromServer(q)).docs;assert.ok(docs.length>0,path);rows[path]=docs.map(d=>d.id);if(path==='docentes')assert.deepEqual(rows[path],['demo-docente-1']);else for(const d of docs)assert.equal(d.data()[path==='asignaciones'?'program':'programCode'],'ADM');}return rows;
 });
 await check('Fuera del programa/ciclo/docente: lectura y escritura denegadas',async()=>{for(const p of ['docentes/demo-docente-2','asignaciones/demo-asignacion-b','asignaciones/demo-asignacion-cerrada','moodle_categorias/aux-DER','moodle_plantillas/aux-DER']){await denied(()=>get(p));await denied(()=>update(p,{updatedAt:'OUTSIDE'}));}for(const p of ['docentes','asignaciones','moodle_categorias','moodle_plantillas'])await denied(()=>fsdk.getDocsFromServer(fsdk.collection(c.db,p)));});
 await check('EDIT ordinario permitido; identidad y capacidades sensibles no inferidas',async()=>{
  const foreign=(await db.doc('docentes/demo-docente-2').get()).data();
  await fixture.put('docentes/demo-docente-2',{...foreign,createdBy:'demo-auxiliar',status:'PENDIENTE',lifecycleStatus:'NUEVO'});
  await denied(()=>fsdk.deleteDoc(fsdk.doc(c.db,'docentes/demo-docente-2')));
  assert.ok((await db.doc('docentes/demo-docente-2').get()).exists,'No se elimina una ficha propia fuera de la delegación');
  const before=(await db.doc('docentes/demo-docente-1').get()).data();await fixture.put('docentes/demo-docente-1',before);
  await update('docentes/demo-docente-1',{phone:'5550100'});await denied(()=>update('docentes/demo-docente-1',{email:'no@example.invalid'}));await denied(()=>update('docentes/demo-docente-1',{status:'INACTIVO'}));
  await denied(()=>update('moodle_categorias/aux-ADM',{programName:'NO'}));await denied(()=>update('moodle_plantillas/aux-ADM',{name:'NO'}));
 });
 await check('Capacidad plantillas no concede confirmación y respeta campos',async()=>{
  await db.doc('delegaciones/aux-regression').update({capabilities:['MANAGE_MOODLE_TEMPLATES'],scope:{...fixture.scope,fields:['programName','name']}});
  await update('moodle_categorias/aux-ADM',{programName:'CAMBIO FICTICIO'});await update('moodle_plantillas/aux-ADM',{name:'CAMBIO FICTICIO'});
  await denied(()=>update('moodle_categorias/aux-ADM',{categoryNumber:'NO'}));await denied(()=>update('asignaciones/demo-asignacion-a',{status:'CARGADO_MOODLE'}));
 });
 await check('VIEW rechaza escritura aunque el perfil conserve EDIT/capacidades',async()=>{
  await db.doc('delegaciones/aux-regression').update({permissions:{docentes:'VIEW',asignaciones:'VIEW',moodle:'VIEW'}});
  assert.ok((await get('docentes/demo-docente-1')).exists());for(const p of ['docentes/demo-docente-1','asignaciones/demo-asignacion-a','moodle_categorias/aux-ADM','moodle_plantillas/aux-ADM'])await denied(()=>update(p,{updatedAt:'VIEW'}));
 });
 await check('Consulta exitosa vacía se distingue de acceso fuera de ámbito',async()=>{
  await db.doc('delegaciones/aux-regression').update({scope:{...fixture.scope,programs:['VACIO']}});
  assert.equal((await fsdk.getDocsFromServer(fsdk.query(fsdk.collection(c.db,'asignaciones'),fsdk.where('program','==','VACIO'),fsdk.where('cycle','==','27-1')))).size,0);
  await denied(()=>get('asignaciones/demo-asignacion-a'));
 });
 await check('Opcionales ausentes/nulos y ámbito vacío: cierre seguro sin Null value',async()=>{
  await db.doc('delegaciones/aux-regression').set({userId:'demo-auxiliar',status:'ACTIVE',permissions:null,scope:null,capabilities:null});
  for(const p of ['docentes/demo-docente-1','asignaciones/demo-asignacion-a','moodle_categorias/aux-ADM','moodle_plantillas/aux-ADM'])await denied(()=>get(p));
  await db.doc('delegaciones/aux-regression').set({...fixture.grant,scope:{programs:null,cycles:null,teachers:null,fields:null}});
  for(const p of ['docentes/demo-docente-1','asignaciones/demo-asignacion-a','moodle_categorias/aux-ADM','moodle_plantillas/aux-ADM'])await denied(()=>get(p));
  for(const path of ['docentes','asignaciones','moodle_categorias','moodle_plantillas'])assert.equal(authorizedQuery(c.db,path,[],{...user,scope:{programs:[],cycles:['*'],teachers:[],fields:[]}}),null);
 });
 await check('Revocación de grant sin cambiar proyección impide siguientes lecturas/escrituras',async()=>{
  await db.doc('delegaciones/aux-regression').set({...fixture.grant,status:'REVOKED'});
  for(const p of ['docentes/demo-docente-1','asignaciones/demo-asignacion-a','moodle_categorias/aux-ADM','moodle_plantillas/aux-ADM']){await denied(()=>get(p));await denied(()=>update(p,{updatedAt:'REVOKED'}));}
 });
 await check('Sistemas mantiene las asignaciones ADM y DER del ciclo',async()=>{const docs=(await fsdk.getDocsFromServer(fsdk.query(fsdk.collection(adminClient.db,'asignaciones'),fsdk.where('cycle','==','27-1')))).docs;assert.ok(docs.some(d=>d.data().program==='ADM'));assert.ok(docs.some(d=>d.data().program==='DER'));return docs.map(d=>d.id);});
}finally{await fixture?.restore();for(const x of [c,adminClient]){await fsdk.terminate(x.db);await deleteApp(x.app);}await deleteAdmin(app);writeFileSync(resolve(out,'server-results.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));}
