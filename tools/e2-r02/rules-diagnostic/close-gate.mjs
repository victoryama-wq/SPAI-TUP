// Revalidate immutable exact-request evidence against the accepted current policy.
// Application/UI differences do not invalidate identical Rules, fixtures and claims.
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {classify,classifyAtomic} from './classifier.mjs';

export const expectedIds=[
 'CYCLE-WRITE-Preparacion','CYCLE-CREATE-Preparacion','CYCLE-WRITE-Captura cerrada','CYCLE-CREATE-Captura cerrada','CYCLE-WRITE-Cerrado','CYCLE-CREATE-Cerrado',
 'SPECIAL-DISABLED-BEFORE-COMMIT','AUTH-REVOKED-BEFORE-COMMIT','D1-LOADED-ENROLLMENT','D1-GROUP-WRITE','D1-TEACHER-WRITE','D1-BATCH',
 'SPECIAL-NOT-ORDINARY','SPECIAL-NOT-RECLASSIFY','SPECIAL-MODALITY-Escolarizado','SPECIAL-MODALITY-Ejecutivo','CUSTOM-FOREIGN-ENROLLMENT','CUSTOM-OUTSIDE-CYCLE','ACADEMIC-OUTSIDE-CYCLE','AUX-FOREIGN-ENROLLMENT','SPECIAL-FOREIGN-DELETE','SPECIAL-DISABLED-UPDATE','SPECIAL-FINAL-CLOSE','DELETION-OLD-TOKEN-READ','DELETION-REENTRY-BOOTSTRAP'];
const root=fileURLToPath(new URL('../../../',import.meta.url));
const evidence=path.join(root,'docs/evidence/r02-rules-20261028'),out=path.join(root,'docs/evidence/r02-rules-close-20261030');
const reference='86caef3a966db5ab5c26931ebddffa909289c2a6',candidate='819e80b3bbcef27279c69608b89f5de8f685ccd0';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p));
const git=(...args)=>execFileSync('git',args,{cwd:root});
const rules=fs.readFileSync(path.join(root,'firestore.rules'));

export function verifyTrace(trace,policyHash) {
 assert.equal(trace.coverage.rules.files.length,1);
 assert.equal(hash(trace.coverage.rules.files[0].content),policyHash,'Coverage is from different Rules');
 assert(trace.coverage.report.length>0,'Missing evaluated trace');
 const url=new URL(trace.request.url);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'48080');
 assert(url.pathname.startsWith('/v1/projects/demo-spai-tup/databases/(default)/documents'));
 assert.equal(trace.request.authorization,'ephemeral synthetic token omitted');
 assert(trace.request.identity.uid && trace.request.identity.email_verified);
 assert.equal(trace.request.identity.aud,'demo-spai-tup');
 const method=trace.operation==='get'?'GET':'POST';assert.equal(trace.request.method,method);
 if(method==='POST') {
  const writes=trace.request.body.writes;assert(writes.length>0);
  for(const w of writes){const name=w.delete||w.update?.name;assert(name?.startsWith('projects/demo-spai-tup/databases/(default)/documents/'));const key=name.split('/documents/')[1];assert(Object.hasOwn(trace.before,key));assert(Object.hasOwn(trace.after,key));
   if(trace.operation==='create')assert.equal(w.currentDocument?.exists,false);
   if(trace.operation==='update')assert.equal(w.currentDocument?.exists,true);
   if(trace.operation==='delete')assert(w.delete);
  }
 } else assert(Object.hasOwn(trace.before,url.pathname.split('/documents/')[1]));
 return true;
}
export function evaluateEvidence(e,policyHash) {
 verifyTrace(e.positive,policyHash);verifyTrace(e.negative,policyHash);
 assert.deepEqual(e.positive.request.identity,e.negative.request.identity,'Controls must use the same identity');
 if(e.controlReason)assert.equal(e.id,'SPECIAL-NOT-RECLASSIFY');
 else {assert.equal(e.positive.operation,e.negative.operation);assert.equal(e.positive.request.url,e.negative.request.url);assert.deepEqual(e.positive.request.body,e.negative.request.body);}
 assert.deepEqual(e.negative.before,e.negative.after,'Denied operation changed data');
 assert.equal(e.negative.unchanged,true);
 for(const c of e.negative.components||[]){verifyTrace(c,policyHash);assert.deepEqual(c.request.identity,e.negative.request.identity);assert.deepEqual(c.before,c.after);}
 const positive=classify({...e.positive,expected:'allow',requestBound:true});
 const fn=e.id==='D1-BATCH'?classifyAtomic:classify;
 return {positive,negative:fn({...e.negative,expected:'deny',positive,requestBound:true})};
}
export function runGate() {
 fs.mkdirSync(out,{recursive:true});
 assert.equal(rules.toString().replace(/\r\n/g,'\n'),git('show',candidate+':firestore.rules').toString().replace(/\r\n/g,'\n'));
 assert.equal(rules.toString().replace(/\r\n/g,'\n'),git('show',reference+':firestore.rules').toString().replace(/\r\n/g,'\n'));
 const old=read(evidence+'/conclusive-results.json');assert.equal(hash(rules),old.rulesSha256);
 assert.deepEqual([...old.results.map(r=>r.id)].sort(),[...expectedIds].sort(),'Inventory must not shrink or duplicate');
 // No policy or application change in this checkout relative to the accepted candidate.
 assert.equal(git('diff',candidate,'--name-only','--','src','functions','firestore.rules','storage.rules').toString().trim(),'');
 const results=old.results.map(r=>{
  const fresh=fs.existsSync(out+'/targeted-'+r.id+'.json');
  if(fresh){const summary=read(out+'/targeted-'+r.id+'.json');assert.equal(summary.rulesSha256,hash(rules));assert.equal(summary.results.length,1);assert.equal(summary.results[0].id,r.id);}
  const source=fresh?out:evidence;
  const bytes=fs.readFileSync(source+'/'+r.evidence),e=JSON.parse(gunzipSync(bytes));assert.equal(e.id,r.id);
  assert.equal(e.scope,r.scope);
  let verdict;try{verdict=evaluateEvidence(e,hash(rules));}catch(error){verdict={positive:{status:'INCONCLUSIVE_EVALUATOR'},negative:{status:'INCONCLUSIVE_EVALUATOR',reason:error.message}};}
  return {id:r.id,scope:r.scope,requirement:r.scope==='USER_DELETION'?'Complemento Eliminar usuario: bloqueo posterior y no recreación':r.id.includes('FOREIGN')||r.id.includes('OUTSIDE')?'E2-C01 / E2-C02 / E2-C03: ámbito autorizado':r.id.startsWith('AUTH-')?'E2-C01: revocación efectiva':'E2-C02 / E2-C03 / D1: captura y Especiales',suite:r.origin,actor:e.negative.request.identity,operation:e.negative.operation,request:e.negative.request,conditions:e.fixture.filter(d=>d.path==='ciclo_control/operativo'||d.path==='usuarios/'+e.negative.request.identity.uid||d.path.startsWith('delegaciones/')),expected:'deny',historical:r.before,previous:r.after,final:verdict.positive.status==='PASS'?verdict.negative.status:'INCONCLUSIVE_EVALUATOR',cause:verdict.negative.reason,positive:verdict.positive.status,evidence:(fresh?'':'../r02-rules-20261028/')+r.evidence,sha256:hash(bytes),reproduce:`$env:RULES_CASE='${r.id}'; node tools/e2-r02/rules-diagnostic/full-cases.mjs`,reused:!fresh};
 });
 const minimal=read(out+'/minimal-48080.json');assert.equal(minimal.results.length,14);
 const diagnostics=[];
 for(const transport of ['REST_AUTH','RULES_UNIT_TESTING']){
  const cases=minimal.results.filter(c=>c.transport===transport),positive=classify({...cases.find(c=>c.id==='ALLOW-DYNAMIC'),expected:'allow',operation:'create'});
  for(const c of cases){const expected=c.id.startsWith('ERROR')?'FAIL':c.id==='DENY-BATCH'?'INCONCLUSIVE_EVALUATOR':'PASS';const actual=classify({...c,operation:'create',expected:c.expected===200?'allow':'deny',positive});
   diagnostics.push({id:c.id,transport,expected,actual:actual.status,pass:actual.status===expected,note:c.id==='DENY-BATCH'?'Single classifier intentionally remains inconclusive for deferred roots; exact full-policy D1-BATCH requires all constituent controls/traces.':undefined});
  }
 }
 const counts=scope=>{const group=results.filter(r=>r.scope===scope);return {total:group.length,PASS:group.filter(r=>r.final==='PASS').length,FAIL:group.filter(r=>r.final==='FAIL').length,INCONCLUSIVE_EVALUATOR:group.filter(r=>r.final==='INCONCLUSIVE_EVALUATOR').length};};
 const r02=counts('R02'),deletion=counts('USER_DELETION'),controls=diagnostics.every(d=>d.pass);
 const final={at:new Date().toISOString(),candidate,branch:git('branch','--show-current').toString().trim(),reference,rulesSha256:hash(rules),policyUnchanged:true,applicationUnchanged:true,unique:{R02:23,USER_DELETION:2,total:25,observations:30,duplicates:5},R02:{...r02,overall:r02.PASS===23&&controls?'PASS':'BLOCKED'},userDeletion:{...deletion,overall:deletion.PASS===2&&controls?'PASS':'BLOCKED',separate:true},diagnostics,results,humanAcceptance:'APROBADA_2026-10-30; previa A/B conservada',production:'PENDIENTE',R03Open:10};
 fs.writeFileSync(out+'/gate.json',JSON.stringify(final,null,2));
 const scope=process.argv.includes('--user-deletion')?'userDeletion':'R02',exitCode=final[scope].overall==='PASS'?0:1;
 console.log(JSON.stringify({scope,...final[scope],candidate,rulesSha256:final.rulesSha256,exitCode}));return {final,exitCode};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=runGate().exitCode;}catch(e){console.error(e);process.exitCode=1;}}
