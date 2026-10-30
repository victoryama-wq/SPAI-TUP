import fs from 'node:fs';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {diagnosticTest,sessionFile,verifyHub,root} from '../../local/config.mjs';
assert(diagnosticTest);await verifyHub();const session=JSON.parse(fs.readFileSync(sessionFile));
assert.equal(session.scenario,'rules-diagnostic');assert.equal(session.synthetic,true);
assert.equal(process.platform,'win32','Use SIGTERM on the recorded owned supervisor on other platforms');
const task=spawn('taskkill',['/PID',String(session.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
const code=await new Promise(ok=>task.once('exit',ok));assert.equal(code,0);
fs.writeFileSync(root+'/.local/diagnostic-stopped.json',JSON.stringify({at:new Date().toISOString(),supervisor:session.pid,emulators:session.emulatorPid}));
console.log('Only the verified diagnostic process tree was stopped. Acceptance instances untouched.');
