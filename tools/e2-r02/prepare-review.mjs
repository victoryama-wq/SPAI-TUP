import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { root, config, isolatedTest, testOffset, accounts, password, localEnvironment, verifyHub } from '../local/config.mjs';
import { reviewFixtures, reviewScenario, validateReviewFixtures } from './review-fixtures.mjs';

export async function prepareReview() {
  assert.ok(isolatedTest && testOffset === 10000, 'Solo sesión sintética aislada 10000; nunca recuperación, LAN ni copia importada');
  await verifyHub(); Object.assign(process.env, localEnvironment());
  const require = createRequire(resolve(root, 'functions/package.json'));
  const A = require('firebase-admin/app');
  const app = A.initializeApp({projectId:config.projectId}, `r02-review-${Date.now()}`);
  try {
    const db = require('firebase-admin/firestore').getFirestore(app);
    const auth = require('firebase-admin/auth').getAuth(app);
    const marker = await db.doc('demo_escenario/r02').get();
    if (marker.exists) {
      assert.equal(marker.data().scenario, reviewScenario);
      const actual = [];
      for (const collection of await db.listCollections()) for (const doc of (await collection.get()).docs) actual.push({path:doc.ref.path,data:doc.data()});
      const report = validateReviewFixtures(actual);
      console.log('Escenario existente verificado, sin resembrar ni revertir pruebas.', JSON.stringify(report));
      return report;
    }
    assert.equal((await db.listCollections()).length, 0, 'La base no está vacía ni pertenece a este escenario. No se modifica.');
    assert.equal((await auth.listUsers(1)).users.length, 0, 'Auth contiene una sesión previa. No se modifica.');
    const docs = reviewFixtures();
    for (const account of accounts) await auth.createUser({uid:account.uid,email:account.email,displayName:account.name,password,emailVerified:true});
    const batch = db.batch();
    for (const item of docs) batch.create(db.doc(item.path),item.data);
    batch.create(db.doc('demo_escenario/r02'),{scenario:reviewScenario,provenance:'tools/e2-r02/review-fixtures.mjs; synthetic only',createdAt:new Date().toISOString()});
    await batch.commit();
    await require('./cycles/service').createCycleService(db).inspect({uid:'demo-sistemas'});
    const report = validateReviewFixtures(docs);
    console.log('Revisión R02 preparada sin importar copias ni restablecer datos.', JSON.stringify(report));
    return report;
  } finally { await A.deleteApp(app); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await prepareReview();
