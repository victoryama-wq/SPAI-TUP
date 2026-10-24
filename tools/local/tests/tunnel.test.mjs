import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, localConfig } from './runtime.mjs';
import { tunnelOrigin, target, permittedOrigin } from '../tunnel-policy.mjs';

test('VS Code rewritten Origin requires localhost pair and exact authorized forwarded host', () => {
  const allowed='https://review-4206.usw2.devtunnels.ms';
  const headers={host:'localhost:4206',origin:'http://localhost:4206','x-forwarded-host':'review-4206.usw2.devtunnels.ms'};
  assert.equal(permittedOrigin(headers,allowed),true);
  for(const bad of [{...headers,'x-forwarded-host':undefined},{...headers,'x-forwarded-host':'another.usw2.devtunnels.ms'},{...headers,host:'evil.test'},{...headers,origin:'https://evil.test'},{...headers,origin:'null'}]) assert.equal(permittedOrigin(bad,allowed),false);
  assert.equal(permittedOrigin(headers,null),false);
  assert.equal(permittedOrigin({origin:allowed},allowed),true);
  assert.equal(permittedOrigin({origin:'http://127.0.0.1:4206'},allowed),true);
});

test('Tunnel origin is HTTPS and exact Dev Tunnels origin only', () => {
  assert.equal(tunnelOrigin('https://review-4206.usw2.devtunnels.ms/'), 'https://review-4206.usw2.devtunnels.ms');
  for (const origin of ['http://review-4206.usw2.devtunnels.ms','https://review-4206.usw2.devtunnels.ms.evil.test','https://evil.test','https://user:pass@review-4206.usw2.devtunnels.ms','https://review-4206.usw2.devtunnels.ms/path','https://review-4206.usw2.devtunnels.ms:4206']) assert.throws(()=>tunnelOrigin(origin));
});
test('Tunnel runtime is explicit and never compatible with production or another host', () => {
  const previous=globalThis.window;
  try {
    globalThis.window={location:{hostname:'review-4206.usw2.devtunnels.ms',protocol:'https:',port:''}};
    const tunnel={...localConfig,demoTunnel:true,emulators:{...localConfig.emulators,host:window.location.hostname,auth:443,firestore:443,functions:443,storage:443}};
    assert.doesNotThrow(()=>runtime.validateFirebaseConfig(tunnel));
    for(const bad of [{...tunnel,demoTunnel:false},{...tunnel,demoLan:true},{...tunnel,mode:'production'},{...tunnel,emulators:{...tunnel.emulators,auth:9099}},{...tunnel,emulators:{...tunnel.emulators,host:'another.usw2.devtunnels.ms'}}]) assert.throws(()=>runtime.validateFirebaseConfig(bad));
    window.location.protocol='http:';assert.throws(()=>runtime.validateFirebaseConfig(tunnel));
  } finally { if(previous===undefined) delete globalThis.window;else globalThis.window=previous; }
});
test('Only application emulator paths are forwarded', () => {
  const ports={auth:1,firestore:2,functions:3,storage:4};
  assert.equal(target('/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',ports),1);
  assert.equal(target('/google.firestore.v1.Firestore/Listen/channel',ports),2);
  assert.equal(target('/demo-spai-tup/us-central1/cycleCommand',ports),3);
  assert.equal(target('/v0/b/demo-spai-tup.appspot.com/o',ports),4);
  for(const path of ['/emulator/v1/projects/demo-spai-tup/accounts','/identitytoolkit.googleapis.com/v1/accounts:signUp','/identitytoolkit.googleapis.com/v1/accounts:delete','/v1/projects/demo-spai-tup/databases/(default)/documents','/demo-spai-tup/us-central1/cycleCommand/extra','/v0/b/real-project.appspot.com/o','/save','/stop']) assert.equal(target(path,ports),null);
});
