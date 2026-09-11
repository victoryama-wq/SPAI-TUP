import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { deleteApp } from 'firebase/app';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, terminate } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes } from 'firebase/storage';
import { runtime, localConfig } from './runtime.mjs';
import { accounts, password } from '../config.mjs';
import { guardNetwork } from './network-guard.mjs';

const attempted = guardNetwork();
const services = runtime.initializeFirebaseRuntime(localConfig, 'offline');
try {
  await assert.rejects(signInWithEmailAndPassword(services.auth, accounts[0].email, password));
  await assert.rejects(httpsCallable(services.functions, 'syncUserProfileByEmail', { timeout: 1500 })({}));
  services.storage.maxUploadRetryTime = 1000;
  await assert.rejects(uploadBytes(ref(services.storage, 'demo/offline.txt'), new Uint8Array([1])));
  const write = setDoc(doc(services.db, 'ciclos/demo-offline'), { label: 'Never remote' }).then(() => 'saved', () => 'failed');
  const result = await Promise.race([write, delay(2500, 'unconfirmed')]);
  assert.notEqual(result, 'saved');
  assert.ok(attempted.length >= 4);
  assert.ok(attempted.every((host) => ['127.0.0.1', 'localhost', '::1'].includes(host)), JSON.stringify(attempted));
  console.log(`PASS: all four SDKs fail or remain unconfirmed without emulators; ${attempted.length} connection attempts exclusively loopback, no production fallback.`);
} finally {
  await terminate(services.db);
  await deleteApp(services.app);
}
