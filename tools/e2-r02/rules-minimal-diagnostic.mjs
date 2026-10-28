import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {config,complementTest,verifyHub,password} from '../local/config.mjs';
assert(complementTest);assert.ok([28080,39080].includes(config.firestore));await verifyHub();
const root=`http://127.0.0.1:${config.firestore}`, original=readFileSync('firestore.rules','utf8');
const load=async content=>{const r=await fetch(root+'/emulator/v1/projects/demo-spai-tup:securityRules',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({rules:{files:[{name:'firestore.rules',content}]}})});assert.equal(r.status,200,await r.text());};
const auth=await fetch(`http://127.0.0.1:${config.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'demo.sistemas@tecplayacar.edu.mx',password,returnSecureToken:true})}).then(r=>r.json());assert(auth.idToken);
const doc=root+'/v1/projects/demo-spai-tup/databases/(default)/documents/probe-control/fixed';
await fetch(doc,{method:'PATCH',headers:{authorization:'Bearer owner','content-type':'application/json'},body:JSON.stringify({fields:{allowed:{booleanValue:false}}})});
const results=[];
try{
 for(const expression of ['false',"exists(/databases/$(database)/documents/probe-control/fixed)","!exists(/databases/$(database)/documents/probe-control/fixed)","get(/databases/$(database)/documents/probe-control/fixed).data.allowed", "get(/databases/$(database)/documents/probe-control/fixed).data.missing == true"]){
  const rules=`rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /probe/{id} { allow write: if ${expression}; } } }`;
  await load(rules);
  const name='projects/demo-spai-tup/databases/(default)/documents/probe/'+crypto.randomUUID();
  const r=await fetch(root+'/v1/projects/demo-spai-tup/databases/(default)/documents:commit',{method:'POST',headers:{authorization:'Bearer '+auth.idToken,'content-type':'application/json'},body:JSON.stringify({writes:[{update:{name,fields:{flag:{booleanValue:true}}},currentDocument:{exists:false}}]})});
  const result=await r.json(),coverage=await fetch(root+'/emulator/v1/projects/demo-spai-tup:ruleCoverage').then(r=>r.json());
  results.push({expression,status:r.status,result,coverage});
 }
}finally{await load(original);mkdirSync('docs/evidence/r02-functional-20261026',{recursive:true});writeFileSync('docs/evidence/r02-functional-20261026/minimal-diagnostic.json',JSON.stringify(results,null,2));}
console.log(results.map(({expression,status,result})=>({expression,status,result})));
