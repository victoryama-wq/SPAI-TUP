import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { config, root, accounts, password, localEnvironment, verifyHub } from './config.mjs';
import { fixtures } from './fixtures.mjs';

export async function seed() {
  await verifyHub(); // Validate the demo project before loading any Admin SDK.
  Object.assign(process.env, localEnvironment());
  const require = createRequire(resolve(root, 'functions/package.json'));
  const { initializeApp, deleteApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getAuth } = require('firebase-admin/auth');
  const app = initializeApp({ projectId: config.projectId }, `local-seed-${Date.now()}`);
  try {
    const auth = getAuth(app);
    for (const account of accounts) {
      const data = { email: account.email, displayName: account.name, password, emailVerified: true };
      try { await auth.createUser({ uid: account.uid, ...data }); }
      catch (error) {
        if (error.code !== 'auth/uid-already-exists') throw error;
        await auth.updateUser(account.uid, data);
      }
    }
    const db = getFirestore(app);
    const batch = db.batch();
    for (const item of fixtures()) batch.set(db.doc(item.path), item.data);
    await batch.commit();
    console.log(`Datos DEMO: ${accounts.length} cuentas y ${fixtures().length} documentos. Sin datos de produccion.`);
  } finally { await deleteApp(app); }
}
