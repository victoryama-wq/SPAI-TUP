import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {collection,doc,getDocsFromServer,getDocFromServer,query,where,orderBy,setDoc,updateDoc,deleteDoc,terminate} from 'firebase/firestore';
import {deleteApp} from 'firebase/app';
import {root,config,isolatedTest,localEnvironment,verifyHub,password} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
import {guardNetwork} from '../local/tests/network-guard.mjs';
import {accessFixture} from './access-fixture.mjs';
assert.equal(isolatedTest,true);guardNetwork();await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json'));const admin=require('firebase-admin/app').initializeApp({projectId:config.projectId},'access-tests');const db=require('firebase-admin/firestore').getFirestore(admin);
const aux=runtime.initializeFirebaseRuntime(localConfig,'access-aux'),general=runtime.initializeFirebaseRuntime(localConfig,'access-general');
const results=[];let fixture;const rules=readFileSync(resolve(root,'firestore.rules'),'utf8');
async function loadRules(content){const r=await fetch(`http://127.0.0.1:${config.firestore}/emulator/v1/projects/${config.projectId}:securityRules`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content}]}})});assert.ok(r.ok,await r.text());}
async function check(name,work){const detail=await work();results.push({name,status:'PASS',detail});console.log('ACCESS PASS '+name);}
async function denied(work,operation){await assert.rejects(work,e=>{if(e.code!=='permission-denied'||/Null value|maximum of|INTERNAL|UNAVAILABLE/i.test(e.message))return false;for(const m of e.message.matchAll(/evaluation error at L(\d+):\d+ for '(\w+)'/g))if((!operation || m[2] === operation) && !e.message.includes(`false for '${m[2]}' @ L${m[1]},`)&&!e.message.endsWith(`false for '${m[2]}' @ L${m[1]}`))return false;return true;});}
const read=p=>getDocFromServer(doc(aux.db,p));const list=p=>getDocsFromServer(query(collection(aux.db,p),orderBy('createdAt','desc')));
try{
 await signInWithEmailAndPassword(aux.auth,'demo.auxiliar@tecplayacar.edu.mx',password);await signInWithEmailAndPassword(general.auth,'demo.sistemas@tecplayacar.edu.mx',password);fixture=await accessFixture(db);
 await check('Caracterización base: auxiliar institucional falla por complejidad en Bitácora y Solicitudes',async()=>{
  await loadRules(execFileSync('git',['show','4c52777024b5f7ca7e3a2b9d91ee7e05b704caaa:firestore.rules'],{cwd:root,encoding:'utf8'}));
  const errors={};try{for(const p of ['bitacora','solicitudes_sistemas'])await assert.rejects(()=>list(p),e=>{errors[p]=e.message;return /maximum of 1000/.test(e.message);});}finally{await loadRules(rules);}return {expectedDefect:true,errors};
 });
 await check('VIEW institucional explícito lee registros positivos sin capacidad sensible implícita',async()=>{const rows={};for(const p of ['bitacora','solicitudes_sistemas']){rows[p]=(await list(p)).docs.map(d=>d.id);assert.ok(rows[p].some(id=>id.startsWith('access-')));}assert.ok((await getDocsFromServer(collection(aux.db,'programas'))).size>0);return rows;});
 await check('VIEW no crea, resuelve, elimina solicitudes ni altera bitácora verificada',async()=>{
  const own=(await db.doc('solicitudes_sistemas/access-own').get()).data();assert.equal((await db.doc('solicitudes_sistemas/access-forged').get()).exists,false);await denied(()=>setDoc(doc(aux.db,'solicitudes_sistemas/access-forged'),own),'create');assert.equal((await db.doc('solicitudes_sistemas/access-forged').get()).exists,false);await denied(()=>updateDoc(doc(aux.db,'solicitudes_sistemas/access-own'),{status:'ATENDIDA'}));await denied(()=>deleteDoc(doc(aux.db,'solicitudes_sistemas/access-own')));await denied(()=>updateDoc(doc(aux.db,'bitacora/access-event'),{description:'FORGED'}));await denied(()=>deleteDoc(doc(aux.db,'bitacora/access-event')));
 });
 await check('EDIT institucional mantiene operación existente; no modifica flujos R03',async()=>{await db.doc('delegaciones/aux-regression').update({permissions:{bitacora:'VIEW',solicitudes:'EDIT'}});await updateDoc(doc(aux.db,'solicitudes_sistemas/access-own'),{status:'EN_PROCESO'});assert.equal((await read('solicitudes_sistemas/access-own')).data().status,'EN_PROCESO');});
 await check('Ámbito limitado o vacío no concede Bitácora institucional; Solicitudes conserva solo lectura propia',async()=>{
  for(const programs of [['ADM'],[]]){await db.doc('delegaciones/aux-regression').update({scope:{...fixture.grant.scope,programs}});await denied(()=>list('bitacora'));await denied(()=>list('solicitudes_sistemas'));await denied(()=>read('solicitudes_sistemas/access-foreign'));const own=await getDocsFromServer(query(collection(aux.db,'solicitudes_sistemas'),where('requestedBy','==','demo-auxiliar')));assert.deepEqual(own.docs.map(d=>d.id),['access-own']);await denied(()=>updateDoc(doc(aux.db,'solicitudes_sistemas/access-foreign'),{status:'ATENDIDA'}));}
 });
 await check('Vacío confirmado autorizado y ausencia de módulo son distintos',async()=>{await db.doc('delegaciones/aux-regression').update({scope:fixture.grant.scope});const empty=await getDocsFromServer(query(collection(aux.db,'bitacora'),where('module','==','NO_EXISTE_FICTICIO')));assert.equal(empty.size,0);await db.doc('delegaciones/aux-regression').update({permissions:{bitacora:'NONE',solicitudes:'NONE'}});await denied(()=>read('bitacora/access-event'));await denied(()=>read('solicitudes_sistemas/access-own'));});
 await check('Revocación de grant bloquea lectura y siguiente escritura sin cambiar proyección',async()=>{await db.doc('delegaciones/aux-regression').set({...fixture.grant,status:'REVOKED'});await denied(()=>read('bitacora/access-event'));await denied(()=>read('solicitudes_sistemas/access-own'));await denied(()=>updateDoc(doc(aux.db,'solicitudes_sistemas/access-own'),{status:'ATENDIDA'}));});
 await check('Definiciones exclusivas AG y retiro en uso rechazado por callable',async()=>{
  await db.doc('delegaciones/aux-regression').set({...fixture.grant,capabilities:['MANAGE_CUSTOM_ROLES']});
  await fixture.put('roles_personalizados/access-role',{name:'ACCESS rol en uso',status:'ACTIVE',revision:1,permissions:{asignaciones:'VIEW'},scope:{programs:['ADM'],cycles:['27-1'],teachers:[],fields:[]},capabilities:[]});
  await fixture.put('asignaciones_roles/access-assignment',{userId:'demo-coord-a',roleId:'access-role',status:'ACTIVE',revision:1});
  const command={action:'deleteRole',targetId:'access-role',expectedRevision:1,reason:'Ensayo aislado retiro en uso'};
  await assert.rejects(()=>httpsCallable(aux.functions,'securityCommand')({...command,operationId:crypto.randomUUID()}),e=>e.code==='functions/permission-denied');
  await assert.rejects(()=>httpsCallable(general.functions,'securityCommand')({...command,operationId:crypto.randomUUID()}),e=>e.code==='functions/failed-precondition');assert.equal((await db.doc('roles_personalizados/access-role').get()).data().status,'ACTIVE');
 });
}finally{await loadRules(rules);await fixture?.restore();for(const c of [aux,general]){await terminate(c.db);await deleteApp(c.app);}await require('firebase-admin/app').deleteApp(admin);mkdirSync(resolve(root,'.local/access-review'),{recursive:true});writeFileSync(resolve(root,'.local/access-review/server-results.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));}
