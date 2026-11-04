// Reproducible acceptance scenarios. Destructive ONLY in the owned complement slot.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {config,root,accounts,password,complementTest,localEnvironment,verifyHub} from '../local/config.mjs';
import {control} from '../local/control.mjs';
import {fixtures,fixtureTime} from '../local/fixtures.mjs';
import {reviewFixtures,validateReviewFixtures} from './review-fixtures.mjs';
assert.equal(complementTest,true);assert.equal(config.firestore,28080);await verifyHub();
assert.ok(root.replaceAll('\\','/').endsWith('/.local/r02-complement-20261023/'));
const scenario=process.argv[2];
assert.ok(['preparation','renewal'].includes(scenario));
// Explicitly replaces only owned acceptance fixtures, never calls shared reset.
Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),A=require('firebase-admin/app');
const app=A.initializeApp({projectId:config.projectId},'final-prepare'),db=require('firebase-admin/firestore').getFirestore(app);
try {
 const reference=require('./cycles/dependencies').references;
 let docs=reviewFixtures().filter(d=>scenario!=='renewal' || d.path.startsWith('ciclos/') || !reference(d.data,{id:'demo-26-3',code:'26-3'}));
 if(scenario==='renewal') {
  // Fixture notifications/links to omitted historical records must be omitted too.
  // This is scenario construction, not a cascade against an existing application database.
  let previousLength;
  do {
   previousLength=docs.length;const paths=new Set(docs.map(d=>d.path));
   docs=docs.filter(({data:d})=>(!d.entity||!d.entityId||paths.has(`${d.entity}/${d.entityId}`)) && ['sourceAssignmentId','destinationAssignmentId'].every(k=>!d[k]||paths.has('asignaciones/'+d[k])));
  } while(docs.length!==previousLength);
 }
 docs.push({path:'grupos/27_1_ADM_11_C_A',data:{id:'27_1_ADM_11_C_A',fullGroup:'27-1 ADM 11 C.A',cycleCode:'27-1',programAbbreviation:'ADM',programName:'Administraci�n ficticia',section:'C.A',modality:'Virtual',status:'Activo'}});
 validateReviewFixtures(docs);
 const retained=new Set(docs.map(d=>d.path));const batch=db.batch();
 const existing=[];for(const c of await db.listCollections())for(const d of (await c.get()).docs){assert.equal((await d.ref.listCollections()).length,0,'Subcolecciones inesperadas: no se borra');existing.push(d);}
 assert.ok(existing.length+docs.length<480,'Escenario inesperadamente grande');
 for(const d of existing)if(!retained.has(d.ref.path))batch.delete(d.ref);
 const auth=require('firebase-admin/auth').getAuth(app);
 const old=await auth.listUsers(1000);assert.ok(!old.pageToken);
 assert.ok(old.users.every(u=>u.email?.startsWith('demo.')&&u.email?.endsWith('@tecplayacar.edu.mx')),'Identidad no ficticia: no se modifica');
 for(const u of old.users)if(!accounts.some(a=>a.uid===u.uid))await auth.deleteUser(u.uid);
 for(const a of accounts){const data={email:a.email,displayName:a.name,password,emailVerified:true,disabled:false};try{await auth.updateUser(a.uid,data);}catch(e){if(e.code!=='auth/user-not-found')throw e;await auth.createUser({uid:a.uid,...data});}}

 for(const d of docs)batch.set(db.doc(d.path),d.data);
 await batch.commit();
 const state={preparation:'Preparacion',capture:'Captura','closed-capture':'Captura cerrada',specials:'Captura cerrada',closed:'Cerrado',renewal:'Cerrado'}[scenario];
 await db.doc('ciclos/demo-27-1').update({status:state,specialsEnabled:scenario==='specials',createdAt:fixtureTime,captureStartedAt:state==='Preparacion'?null:fixtureTime,captureClosedAt:['Captura cerrada','Cerrado'].includes(state)?fixtureTime:null,closedAt:state==='Cerrado'?fixtureTime:null,tentativeCaptureCloseAt:null});
 // Renewal is generated without older academic fixture records; never applied to shared data.
 const context=await require('./cycles/service').createCycleService(db).inspect({uid:'demo-sistemas'});
 const cycles=(await db.collection('ciclos').get()).docs.map(d=>({id:d.id,...d.data()}));
 assert.equal(cycles.length,2);assert.ok(cycles.filter(c=>c.status!=='Cerrado').length<=1);
 const codes=new Set(cycles.map(c=>c.code));
 const groups=(await db.collection('grupos').get()).docs.map(d=>d.data());
 for(const group of groups)assert.ok(codes.has(group.cycleCode));
 for(const d of (await db.collection('asignaciones').get()).docs) {assert.ok(codes.has(d.data().cycle));assert.ok(groups.some(g=>g.fullGroup===d.data().group));}
 const dependencies=Object.fromEntries(require('./cycles/dependencies').COLLECTIONS.map(c=>[c,docs.filter(d=>d.path.startsWith(c+'/')&&reference(d.data,{id:'demo-26-3',code:'26-3'})).length]));
 assert.equal(Object.values(dependencies).some(n=>n>0),scenario==='preparation');
 const result={dependencies,at:new Date().toISOString(),scenario,context,cycles:cycles.map(c=>({code:c.code,status:c.status,specialsEnabled:c.specialsEnabled})),references:'VALID',environment:'synthetic acceptance 28080',evaluatedSha:'5ef70c31a44fdc9a11a3ca02b8925f7677b46c91',humanAcceptance:false};
 mkdirSync(resolve(root,'docs/evidence/r02-final-review'),{recursive:true});writeFileSync(resolve(root,`docs/evidence/r02-final-review/scenario-${scenario}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 const caption=scenario==='preparation'?'PREPARACIÓN':'RENOVACIÓN';
 const indexPath=resolve(root,'src/index.local.html');let html=readFileSync(indexPath,'utf8');
 html=html.replace(/<p role="status"[\s\S]*?<\/p>/,`<p role="status" style="margin:0;padding:.5rem;text-align:center;background:#fff2c6;color:#302500;font:600 14px system-ui">ACEPTACIÓN E2-R02 · ${caption} (escenario base) · AISLADO 4204 / 28080 · Datos ficticios · versión 5ef70c31a44f</p>`);
 writeFileSync(indexPath,html);
 mkdirSync(resolve(root,'public'),{recursive:true});writeFileSync(resolve(root,'public/acceptance-version.json'),JSON.stringify(result,null,2));

}finally{await A.deleteApp(app);}
