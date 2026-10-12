import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { deleteApp } from 'firebase/app';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDocFromServer, deleteDoc, terminate } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes } from 'firebase/storage';
import { config, accounts, password, verifyHub } from '../config.mjs';
import { control } from '../control.mjs';
import { runtime, localConfig } from './runtime.mjs';
import { guardNetwork } from './network-guard.mjs';

const attempted = guardNetwork();
await verifyHub();
const services = runtime.initializeFirebaseRuntime(localConfig, 'integration');
try {
  await signInWithEmailAndPassword(services.auth, accounts[0].email, password);
  assert.equal(services.auth.currentUser.uid, accounts[0].uid);
  const probe = doc(services.db, 'ciclos/demo-etapa0-probe');
  await setDoc(probe, { code: '99-1', label: 'PRUEBA FICTICIA', status: 'Preparacion', createdAt: new Date().toISOString() });
  assert.equal((await getDocFromServer(probe)).data().label, 'PRUEBA FICTICIA');
  const rest = await fetch(`http://${config.host}:${config.firestore}/v1/projects/${config.projectId}/databases/(default)/documents/ciclos/demo-etapa0-probe`, { headers: { authorization: 'Bearer owner' } }).then((r) => r.json());
  assert.equal(rest.fields.label.stringValue, 'PRUEBA FICTICIA');
  await deleteDoc(probe);
  console.log('PASS: authenticated SDK write/read and independent emulator REST verification.');
  const sync = httpsCallable(services.functions, 'syncUserProfileByEmail');
  assert.equal((await sync({})).data.synced, true);
  console.log('PASS: callable Functions uses emulator with authenticated context.');
  await assert.rejects(uploadBytes(ref(services.storage, 'demo/probe.txt'), new Uint8Array([1, 2, 3])), (error) => error.code === 'storage/unauthorized');
  console.log('PASS: Storage emulator reachable; original deny-all rules preserved.');
  const notification = doc(services.db, 'notificaciones/demo-test-mail');
  await setDoc(notification, { actorId: accounts[0].uid, type: 'SOLICITUD_SISTEMAS', target: 'SISTEMAS', title: 'Correo ficticio', message: 'Nunca enviar', createdAt: new Date().toISOString(), readBy: [] });
  let data;
  for (let attempt = 0; attempt < 40; attempt++) {
    data = (await getDocFromServer(notification)).data();
    if (data.emailStatus === 'SIMULADO_LOCAL') break;
    await delay(500);
  }
  assert.equal(data.emailStatus, 'SIMULADO_LOCAL');
  assert.equal(data.emailRecipientCount, 0);
  console.log('PASS: Firestore event executed Functions and simulated mail without recipients.');
  for (const account of accounts.slice(1)) {
    await signOut(services.auth);
    await signInWithEmailAndPassword(services.auth, account.email, password);
    assert.equal((await getDocFromServer(doc(services.db, `usuarios/${account.uid}`))).data().role, account.role);
  }
  console.log('PASS: all five fictitious accounts authenticate and read their own profiles.');
  assert.ok(attempted.length > 0);
  assert.ok(attempted.every((host) => ['127.0.0.1', 'localhost', '::1'].includes(host)));
  await control('seed');
  console.log('PASS: repeat seeding succeeds with deterministic IDs.');
} finally {
  await terminate(services.db);
  await deleteApp(services.app);
}
