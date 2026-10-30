// Empty diagnostic emulators only: no accepted scenarios, exports or fixtures loaded.
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
import {root, config, diagnosticTest, isolatedTest, localEnvironment, cliConfigFile, sessionFile, loggingPort, websocketPort, verifyHub} from '../../local/config.mjs';
assert(diagnosticTest && isolatedTest && process.env.SPAI_LOCAL_SYNTHETIC === 'true');
assert.equal(process.versions.node.split('.')[0], '22');
assert(!fs.existsSync(root+'/.local/FROZEN.json'));
for (const port of [config.auth,config.firestore,config.functions,config.storage,config.hub,config.ui,loggingPort,websocketPort]) {
 const probe=createServer(); await new Promise((ok,bad)=>{probe.once('error',bad);probe.listen(port,config.host,ok);});await new Promise(ok=>probe.close(ok));
}
const cli=JSON.parse(fs.readFileSync(root+'/firebase.local.json'));
for(const key of ['auth','firestore','functions','storage','hub','ui'])cli.emulators[key].port=config[key];
cli.emulators.logging.port=loggingPort;cli.emulators.firestore.websocketPort=websocketPort;
cli.emulators.eventarc={host:config.host,port:49299};cli.emulators.tasks={host:config.host,port:49499};
fs.mkdirSync(root+'/.local',{recursive:true});fs.writeFileSync(cliConfigFile,JSON.stringify(cli,null,2));
const child=spawn(process.execPath,['node_modules/firebase-tools/lib/bin/firebase.js','emulators:start','--project',config.projectId,'--config',cliConfigFile,'--only','auth,firestore,functions,storage','--non-interactive'],{cwd:root,env:localEnvironment(),stdio:'inherit',windowsHide:true});
fs.writeFileSync(sessionFile,JSON.stringify({projectId:config.projectId,pid:process.pid,emulatorPid:child.pid,synthetic:true,scenario:'rules-diagnostic'}));
child.on('exit',code=>{process.exitCode=code||0;});
let ready=false;
for(let n=0;n<120 && child.exitCode===null;n++) {try{await verifyHub();ready=true;break;}catch{await new Promise(ok=>setTimeout(ok,1000));}}
if(!ready){
 if(process.platform==='win32'){const task=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});await new Promise(ok=>task.once('exit',ok));}
 else child.kill();
 throw Error('Diagnostic emulators did not start');
}
console.log('RULES DIAGNOSTIC READY: isolated empty services, no acceptance data imported.');
