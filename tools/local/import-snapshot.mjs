import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { config, root, password, localEnvironment, verifyHub } from './config.mjs';
import { prepareSnapshot, targetPrefix, canonical } from './snapshot.mjs';

export async function importSnapshot(snapshot) {
  const plan = prepareSnapshot(snapshot); // Validate everything before writing locally.
  await verifyHub();
  const base = `http://${config.host}:${config.firestore}/v1/`;
  const headers = { authorization: 'Bearer owner', 'content-type': 'application/json' };
  const call = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Importacion local HTTP ${response.status}.`);
    return response.json();
  };
  const triggerBase = `http://${config.host}:${config.hub}/functions/`;
  await call(`${triggerBase}disableBackgroundTriggers`, { method: 'PUT' });
  try {
    // Supervisor must start a clean emulator. Never merge a snapshot into test data.
    const existing = await call(`${base}${targetPrefix.slice(0, -1)}:listCollectionIds`, { method: 'POST', body: '{}' });
    if (existing.collectionIds?.length) throw new Error('La importacion requiere Firestore local vacio; usa local:reset.');
    for (let i = 0; i < plan.documents.length; i += 150) {
      await verifyHub();
      await call(`${base}projects/${config.projectId}/databases/(default)/documents:commit`, {
        method: 'POST', body: JSON.stringify({ writes: plan.documents.slice(i, i + 150).map((update) => ({ update })) }),
      });
    }
    Object.assign(process.env, localEnvironment());
    const require = createRequire(resolve(root, 'functions/package.json'));
    const { initializeApp, deleteApp } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const app = initializeApp({ projectId: config.projectId }, `snapshot-auth-${Date.now()}`);
    try {
      for (const account of plan.mappings) await getAuth(app).createUser({ uid: account.uid, email: account.email, displayName: account.name, password, emailVerified: true });
    } finally { await deleteApp(app); }
    // Check every imported document's path, fields and Firestore value types.
    let verified = 0;
    const collections = new Map();
    for (const doc of plan.documents) {
      const collection = doc.name.slice(0, doc.name.lastIndexOf('/'));
      if (!collections.has(collection)) collections.set(collection, new Map());
      collections.get(collection).set(doc.name, doc.fields);
    }
    for (const [collection, expected] of collections) {
      let pageToken;
      do {
        const url = new URL(base + collection.split('/').map(encodeURIComponent).join('/'));
        url.searchParams.set('pageSize', '1000');
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const page = await call(url);
        for (const doc of page.documents || []) {
          if (!expected.has(doc.name) || !isDeepStrictEqual(canonical(doc.fields || {}), canonical(expected.get(doc.name)))) throw new Error('La copia local difiere del contenido esperado.');
          expected.delete(doc.name);
          verified++;
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
      if (expected.size) throw new Error('Faltan documentos en la copia local.');
    }
    const report = { sourceProject: snapshot.sourceProject, targetProject: config.projectId, readTime: plan.readTime, sourceCount: plan.sourceCount, importedCount: plan.documents.length, verifiedCount: verified, verifiedAt: new Date().toISOString(), mappings: plan.mappings };
    writeFileSync(resolve(root, '.local/import-report.json'), JSON.stringify(report, null, 2));
    console.log(`Copia BD lista: ${verified} documentos verificados, ${plan.mappings.length} accesos DEMO. Lectura origen ${plan.readTime}.`);
  } finally {
    await call(`${triggerBase}enableBackgroundTriggers`, { method: 'PUT' });
  }
}
