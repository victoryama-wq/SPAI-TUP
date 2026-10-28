// Reproducible acceptance scenarios. Destructive ONLY in the owned complement slot.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {config,root,complementTest,acceptanceSlot,localEnvironment,verifyHub} from '../local/config.mjs';
import {control} from '../local/control.mjs';
import {fixtures,fixtureTime} from '../local/fixtures.mjs';
import {reviewFixtures,validateReviewFixtures} from './review-fixtures.mjs';
if(acceptanceSlot && existsSync(resolve(root,'.local/FROZEN.json')))throw Error('Instancia entregada: fixtures congelados.');
assert.equal(complementTest,true);assert.ok([28080,39080,51080,52080].includes(config.firestore));await verifyHub();
const scenario=process.argv[2]||'capture';
assert.ok(['preparation','capture','closed-capture','specials','closed','renewal'].includes(scenario));
await control('reset');Object.assign(process.env,localEnvironment());
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
 docs.push({path:'grupos/27_1_ADM_11_C_A',data:{id:'27_1_ADM_11_C_A',fullGroup:'27-1 ADM 11 C.A',cycleCode:'27-1',programAbbreviation:'ADM',programName:'Administración ficticia',section:'C.A',modality:'Virtual',status:'Activo'}});
 validateReviewFixtures(docs);
 const retained=new Set(docs.map(d=>d.path));const batch=db.batch();
 for(const d of fixtures())if(!retained.has(d.path))batch.delete(db.doc(d.path));
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
 const result={at:new Date().toISOString(),scenario,context,cycles:cycles.map(c=>({code:c.code,status:c.status,specialsEnabled:c.specialsEnabled})),references:'VALID',environment:`synthetic ${config.firestore}`,humanAcceptance:false};
 mkdirSync(resolve(root,(process.env.SPAI_LOCAL_TEST_SLOT === 'preproduction' ? 'docs/evidence/r02-preproduction-20261028' : 'docs/evidence/r02-final-review')),{recursive:true});writeFileSync(resolve(root,process.env.SPAI_LOCAL_TEST_SLOT === 'preproduction' ? 'docs/evidence/r02-preproduction-20261028' : 'docs/evidence/r02-final-review',`scenario-${scenario}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await A.deleteApp(app);}
