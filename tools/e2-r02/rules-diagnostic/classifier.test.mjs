import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';import {classify,classifyAtomic} from './classifier.mjs';
const dir=new URL('../../../docs/evidence/r02-rules-20261028/',import.meta.url);
const minimal=JSON.parse(fs.readFileSync(new URL('minimal-48080.json',dir))).results;
let assertions=0;const check=(a,b)=>{assert.equal(a,b);assertions++};
for(const transport of ['REST_AUTH','RULES_UNIT_TESTING']){
 const cases=minimal.filter(c=>c.transport===transport),positive=classify({...cases.find(c=>c.id==='ALLOW-DYNAMIC'),expected:'allow',operation:'create'});check(positive.status,'PASS');
 for(const id of ['DENY-DYNAMIC','DENY-LITERAL'])check(classify({...cases.find(c=>c.id===id),expected:'deny',operation:'create',positive}).status,'PASS');
 for(const id of ['ERROR-MISSING-FIELD','ERROR-BATCH'])check(classify({...cases.find(c=>c.id===id),expected:'deny',operation:'create',positive}).status,'FAIL');
 const c=cases.find(c=>c.id==='DENY-DYNAMIC');
 check(classify({...c,expected:'deny',operation:'create'}).status,'INCONCLUSIVE_EVALUATOR');
 check(classify({...c,expected:'deny',operation:'create',positive,requestBound:false}).status,'INCONCLUSIVE_EVALUATOR');
 check(classify({...c,expected:'deny',operation:'create',positive,coverage:{}}).status,'INCONCLUSIVE_EVALUATOR');
 check(classify({...c,expected:'deny',operation:'update',positive}).status,'INCONCLUSIVE_EVALUATOR');
 check(classify({...c,expected:'deny',operation:'create',positive,response:{status:403,body:{error:{message:'UNAVAILABLE'}}}}).status,'FAIL');
 check(classify({...c,expected:'deny',operation:'create',positive,response:{status:200,body:{}}}).status,'FAIL');
}
const initial=JSON.parse(fs.readFileSync(new URL('full-results.json',dir))),batch=JSON.parse(fs.readFileSync(new URL('targeted-D1-BATCH.json',dir)));
const results=initial.results.map(r=>batch.results.find(b=>b.id===r.id)||r);
for(const r of results){const e=JSON.parse(gunzipSync(fs.readFileSync(new URL(r.evidence,dir))));const positive=classify({...e.positive,expected:'allow'});check(positive.status,'PASS');const fn=e.id==='D1-BATCH'?classifyAtomic:classify;check(fn({...e.negative,expected:'deny',positive}).status,'PASS');if(e.id==='D1-BATCH'){check(fn({...e.negative,expected:'deny',positive,components:[]}).status,'INCONCLUSIVE_EVALUATOR');const bad=structuredClone(e.negative);bad.components[0].request.body.writes[0].update.name+='-different';check(fn({...bad,expected:'deny',positive}).status,'INCONCLUSIVE_EVALUATOR');}}
fs.writeFileSync(new URL('classifier-tests.json',dir),JSON.stringify({at:new Date().toISOString(),assertions,status:'PASS',intentionalInvalidRules:'FAIL as required; never counted as accepted policy',fullCases:results.length},null,2));
fs.writeFileSync(new URL('conclusive-results.json',dir),JSON.stringify({at:new Date().toISOString(),rulesSha256:initial.rulesSha256,baseCommit:initial.baseCommit,executions:[{file:'full-results.json',at:initial.at},{file:'targeted-D1-BATCH.json',at:batch.at}],results},null,2));console.log(`${assertions} assertions PASS; ${results.length} unique exact cases reclassified from captured evidence`);
