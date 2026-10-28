import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='docs/evidence/r02-preproduction-20261028';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const traces=read(dir+'/rules-traces.json'),logic=read('.local/test-results/stage1-logic.json');
const ids=['CYCLE-MULTIPLE-OPERATIVE','CYCLE-SELECTION-ORDER',...['Preparacion','Captura cerrada','Cerrado'].flatMap(state=>['CYCLE-WRITE-'+state,'CYCLE-CREATE-'+state])];
const historical=ids.map(id=>{
 const trace=traces.results.find(r=>r.id===id),unit=logic.cases.find(r=>r.id===id);
 assert(trace||unit,'Missing required evidence: '+id);
 return {id,status:trace?trace.strictStatus:unit.contractMatches===true?'PASS':'FAIL',evidence:trace?'rules-traces.json':'stage1-logic.json',...(trace?{httpStatus:trace.status,unchanged:trace.unchangedOnRejection,diagnostic:trace.diagnostic}:{actual:unit.actual,expected:unit.expected})};
});
const integration=read('.local/test-results/r02.json').cases.filter(c=>c.name!=='Strict Rules denial'&&c.status!=='OBSERVED');
const mandatory=[...historical,...integration,...read(dir+'/transactions.json').results,...read(dir+'/server.json').results,...read(dir+'/renewal-ui.json').results,...read(dir+'/ui.json').results];
const overall=mandatory.every(r=>r.status==='PASS')?'PASS':'BLOCKED';
const result={at:new Date().toISOString(),overall,scope:'R02 only; a 403 is never sufficient proof',historical,
 integrationSummary:Object.fromEntries(['PASS','FAIL','INCONCLUSIVE_EVALUATOR'].map(s=>[s,integration.filter(c=>c.status===s).length])),
 otherUnresolved:traces.results.filter(c=>!ids.includes(c.id)&&c.strictStatus!=='PASS').map(c=>({id:c.id,status:c.strictStatus})),
 R03:{status:'10 incumplimientos abiertos; sin implementar',evidence:'../r02-hallazgos-20261026/contract-gate-final.log',sourceUnchanged:true},
 rulesSha256:createHash('sha256').update(readFileSync('firestore.rules')).digest('hex'),humanAcceptance:'PENDIENTE',production:'BLOQUEADA'};
writeFileSync(dir+'/r02-gate.json',JSON.stringify(result,null,2));console.log(JSON.stringify({overall,historical:historical.map(({id,status})=>({id,status})),integration:result.integrationSummary},null,2));
if(overall!=='PASS')process.exitCode=1;
