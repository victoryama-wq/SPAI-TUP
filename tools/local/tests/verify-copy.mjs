import assert from 'node:assert/strict';
import { deleteApp } from 'firebase/app';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDocFromServer, getDocsFromServer, collection, query, limit, terminate } from 'firebase/firestore';
import { loadSelectedSnapshot, prepareSnapshot } from '../snapshot.mjs';
import { password, verifyHub } from '../config.mjs';
import { runtime, localConfig } from './runtime.mjs';
import { guardNetwork } from './network-guard.mjs';

const attempts = guardNetwork();
await verifyHub();
const snapshot = loadSelectedSnapshot();
assert.ok(snapshot, 'Debe estar seleccionada la copia local.');
const plan = prepareSnapshot(snapshot);
const services = runtime.initializeFirebaseRuntime(localConfig, 'verify-copy');
try {
  for (const account of plan.mappings) {
    await signInWithEmailAndPassword(services.auth, account.email, password);
    assert.equal(services.auth.currentUser.uid, account.uid);
    const user = (await getDocFromServer(doc(services.db, account.profilePath))).data();
    assert.equal(user.email, account.email);
    assert.equal(user.authUid, account.uid);
    assert.equal(user.role, account.role);
    assert.deepEqual(user.assignedPrograms, account.programs);
    if (account.slot === 'demo-sistemas') {
      for (const name of ['ciclos', 'asignaciones', 'docentes', 'grupos']) {
        assert.ok(!(await getDocsFromServer(query(collection(services.db, name), limit(1)))).empty);
      }
    }
    await signOut(services.auth);
  }
  assert.ok(attempts.length > 0);
  assert.ok(attempts.every((host) => ['127.0.0.1', 'localhost', '::1'].includes(host)));
  console.log('PASS: five DEMO logins use the mapped local profiles; Systems reads copied collections; network stays in loopback.');
} finally {
  await terminate(services.db);
  await deleteApp(services.app);
}
