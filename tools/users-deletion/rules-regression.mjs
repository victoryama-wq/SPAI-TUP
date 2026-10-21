// Compare the unresolved R01 positive write against the exact pre-complement Rules.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {updateDoc,doc,terminate} from 'firebase/firestore';
import {deleteApp} from 'firebase/app';
import {config,root,password,complementTest,verifyHub} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
assert.equal(complementTest,true);assert.equal(config.firestore,28080);await verifyHub();
const current=readFileSync(resolve(root,'firestore.rules'),'utf8');
const baseline=execFileSync('git',['show','775dc7e:firestore.rules'],{cwd:root,encoding:'utf8'});
const load=async content=>{const r=await fetch(`http://127.0.0.1:${config.firestore}/emulator/v1/projects/demo-spai-tup:securityRules`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content}]}})});assert.equal(r.status,200,await r.text());};
const client=runtime.initializeFirebaseRuntime(localConfig,'rules-comparison');const results=[];
try{
 await signInWithEmailAndPassword(client.auth,'r01-aux@tecplayacar.edu.mx',password);
 for(const [version,rules] of [['775dc7e',baseline],['complement',current]]){await load(rules);try{await updateDoc(doc(client.db,'docentes/r01-own'),{fullName:'FICHA EN ÁMBITO'});results.push({version,status:'PASS'});}catch(e){results.push({version,status:'FAIL',code:e.code,error:e.message});}}
}finally{await load(current);await terminate(client.db);await deleteApp(client.app);}
writeFileSync(resolve(root,'docs/evidence/users-deletion/rules-regression.json'),JSON.stringify({at:new Date().toISOString(),case:'Positive delegated teacher edit from existing R01 suite, same isolated data',results},null,2));console.log(JSON.stringify(results));
