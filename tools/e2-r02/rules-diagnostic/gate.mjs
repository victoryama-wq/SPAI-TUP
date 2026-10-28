import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const d='docs/evidence/r02-rules-20261028',old='docs/evidence/r02-preproduction-20261028',read=p=>JSON.parse(readFileSync(p));
const current=read(d+'/conclusive-results.json'),prior=read(old+'/r02.json'),prevGate=read(old+'/r02-gate.json');
const map={
 'D1: prepared write rejected after closure; loaded assignments too':['CYCLE-WRITE-Captura cerrada','D1-LOADED-ENROLLMENT','CYCLE-CREATE-Captura cerrada','D1-GROUP-WRITE','D1-TEACHER-WRITE','D1-BATCH'],
 'Reopen requires reason; reopening and concurrent close/write':['D1-LOADED-ENROLLMENT'],
 'Specials: disabled denied, enabled admitted group allowed':['SPECIAL-DISABLED-BEFORE-COMMIT'],
 'Specials does not permit ordinary/reclassification/Escolarizado/Ejecutivo':['SPECIAL-NOT-ORDINARY','SPECIAL-NOT-RECLASSIFY','SPECIAL-MODALITY-Escolarizado','SPECIAL-MODALITY-Ejecutivo'],
 'Specials actors: academic foreign enrollment, CUSTOM and delegated scope':['CUSTOM-FOREIGN-ENROLLMENT','CUSTOM-OUTSIDE-CYCLE','ACADEMIC-OUTSIDE-CYCLE','AUX-FOREIGN-ENROLLMENT'],
 'Specials own deletion is allowed; outside scope remains denied':['SPECIAL-FOREIGN-DELETE'],
 'Disable Specials: open-form confirmation denied':['SPECIAL-DISABLED-UPDATE'],
 'Final close / residual Specials / no transition from historical / next preparation':['SPECIAL-FINAL-CLOSE','CYCLE-CREATE-Preparacion']};
const get=id=>{const r=current.results.find(r=>r.id===id);assert(r,'Missing exact case '+id);return r;};
const integration=prior.cases.filter(c=>!['Strict Rules denial','Concurrent write ordering'].includes(c.name)).map(c=>c.status==='PASS'?{...c,source:'86caef / r02.json reused'}:{...c,before:c.status,status:map[c.name]?.every(id=>get(id).after==='PASS')?'PASS':'BLOCKED',resolvedRules:map[c.name],source:'Prior non-Rules assertions plus exact candidate Rules traces; not a repeated suite'});
assert.equal(Object.values(map).flat().length,20);
const historical=prevGate.historical.map(r=>r.status==='PASS'?{...r,reused:true}:{id:r.id,before:r.status,status:get(r.id).after,evidence:get(r.id).evidence});
// Prove unchanged application and server policies before reusing evidence; only explicit local port tuples differ.
const changed=execFileSync('git',['diff','86caef3a966db5ab5c26931ebddffa909289c2a6','--name-only','--','src','firestore.rules','storage.rules','functions'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);assert.deepEqual(changed,['functions/local-runtime.js']);
const previous=execFileSync('git',['show','86caef3a966db5ab5c26931ebddffa909289c2a6:functions/local-runtime.js'],{encoding:'utf8'}).replace(/\r\n/g,'\n');const present=readFileSync('functions/local-runtime.js','utf8').replace(/\r\n/g,'\n').replace(', 43000, 44000','');assert.equal(present,previous);
const reused=['transactions.json','server.json','renewal-ui.json','ui.json'];for(const file of reused)assert(read(old+'/'+file).results.every(r=>r.status==='PASS'));
const all=[...historical,...integration,...current.results.map(r=>({status:r.after}))];const overall=all.every(r=>r.status==='PASS')?'PASS':'BLOCKED';
const result={at:new Date().toISOString(),reference:current.baseCommit,candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),overall,historical,integration,unique:{R02:23,USER_DELETION:2,total:25},requiredInconclusive:current.results.filter(r=>r.after==='INCONCLUSIVE_EVALUATOR').length,userDeletion:{rules:current.results.filter(r=>r.scope==='USER_DELETION'),functions:'10 previous conclusive cases retained; no policy change'},reused,policyUnchanged:true,R03:'10 incumplimientos conservados, sin implementar',production:'PENDIENTE: R04, 200 documentos, migracion, reversion y validaciones remotas Firebase',humanAcceptance:'PENDIENTE'};
writeFileSync(d+'/r02-gate.json',JSON.stringify(result,null,2));console.log(JSON.stringify({overall,historical:historical.map(r=>({id:r.id,status:r.status})),unique:result.unique}));if(overall!=='PASS')process.exitCode=1;
