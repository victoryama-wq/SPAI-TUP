import {spawn} from 'node:child_process';
import {root} from '../local/config.mjs';
// Isolated process state; does not change the persistent private-data selection.
const env={...process.env,SPAI_LOCAL_SYNTHETIC:'true',SPAI_LOCAL_TEST_ISOLATED:'true'};
for(const args of [
 ['--test','tools/e2-r01/policy.test.mjs','tools/e2-r01/auth-config.test.mjs'],
 ['tools/local/run.mjs','--test','--r01','--stage1','--ui'],
]){
 const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});
 const code=await new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',ok);});
 if(code!==0){process.exitCode=code??1;break;}
}
