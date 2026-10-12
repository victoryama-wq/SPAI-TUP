import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { config, root, localEnvironment, assertLocalConfig, accounts } from '../config.mjs';
import { fixtures } from '../fixtures.mjs';
import { runtime, localConfig } from './runtime.mjs';

const require = createRequire(import.meta.url);
const { resolveLocalRuntime } = require('../../../functions/local-runtime.js');

test('Local rejects real projects, remote hosts and incomplete endpoints before creating an app', () => {
  assert.doesNotThrow(() => runtime.validateFirebaseConfig(localConfig));
  for (const bad of [
    { ...localConfig, firebase: { ...localConfig.firebase, projectId: 'real-project' } },
    { ...localConfig, emulators: undefined },
    { ...localConfig, emulators: { ...config, host: 'firestore.googleapis.com' } },
    { ...localConfig, emulators: { ...config, functions: undefined } },
  ]) assert.throws(() => runtime.initializeFirebaseRuntime(bad));
  assert.throws(() => assertLocalConfig({ ...config, projectId: 'real-project' }));
});

test('Functions reject missing emulator configuration and never mix live projects', () => {
  const env = localEnvironment();
  assert.equal(resolveLocalRuntime(env).projectId, config.projectId);
  assert.equal(resolveLocalRuntime({ GCLOUD_PROJECT: 'production-example' }), null);
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
    assert.throws(() => resolveLocalRuntime({ ...env, [key]: undefined }));
  }
  assert.throws(() => resolveLocalRuntime({ ...env, GCLOUD_PROJECT: 'production-example' }));
});

test('Angular, Firebase CLI and scripts share endpoints; rules remain the original files', () => {
  const cli = JSON.parse(readFileSync(resolve(root, 'firebase.local.json')));
  for (const key of ['auth', 'firestore', 'functions', 'storage', 'hub', 'ui']) {
    assert.equal(cli.emulators[key].host, config.host);
    assert.equal(cli.emulators[key].port, config[key]);
  }
  assert.equal(cli.firestore.rules, 'firestore.rules');
  assert.equal(cli.storage.rules, 'storage.rules');
  const html = readFileSync(resolve(root, 'src/index.local.html'), 'utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /googleapis|gstatic|spai-6ef68/);
  const angular = JSON.parse(readFileSync(resolve(root, 'angular.json'))).projects['spai-tup-angular'];
  assert.equal(angular.architect.serve.defaultConfiguration, 'local');
  assert.equal(angular.architect.build.configurations.local.index, 'src/index.local.html');
});

test('Fictitious fixtures are deterministic and reference existing coordinators', () => {
  assert.deepEqual(fixtures(), fixtures());
  const docs = fixtures();
  assert.equal(new Set(docs.map((d) => d.path)).size, docs.length);
  const uids = new Set(accounts.map((a) => a.uid));
  for (const doc of docs.filter((d) => d.path.startsWith('docentes/'))) {
    for (const uid of doc.data.assignedCoordinatorIds) assert.ok(uids.has(uid));
  }
  const states = docs.filter((d) => d.path.startsWith('ciclos/')).map((d) => d.data.status);
  assert.deepEqual(new Set(states), new Set(['Preparacion', 'Captura', 'Captura cerrada', 'Cerrado']));
});

test('Local email handler cannot access SMTP or secret values', async () => {
  const writes = [];
  const exported = {};
  const forbidden = () => { throw new Error('Real external effect attempted'); };
  const dependencies = {
    './security/service': require('../../../functions/security/service'),
    'firebase-admin/app': { initializeApp: () => {} },
    'firebase-admin/firestore': { getFirestore: () => ({ collection: () => ({ doc: () => ({ set: async (data) => writes.push(data) }) }) }), FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } },
    'firebase-functions': { logger: { info: () => {}, error: () => {} } },
    'firebase-functions/params': { defineSecret: () => ({ value: forbidden }) },
    'firebase-functions/v2/firestore': Object.fromEntries(['onDocumentCreated', 'onDocumentUpdated', 'onDocumentDeleted'].map((name) => [name, (options, handler) => ({ options, handler })])),
    'firebase-functions/v2/https': { HttpsError: Error, onCall: () => {} },
    nodemailer: { createTransport: forbidden },
    './local-runtime': { resolveLocalRuntime: () => ({ projectId: config.projectId }) },
  };
  vm.runInNewContext(readFileSync(resolve(root, 'functions/index.js'), 'utf8'), { require: (id) => { assert.ok(id in dependencies); return dependencies[id]; }, exports: exported, console });
  const email = exported.sendEmailForNotification;
  assert.equal(email.options.secrets.length, 0);
  await email.handler({ data: { data: () => ({ title: 'Ficticio' }) }, params: { notificationId: 'demo' } });
  assert.equal(writes[0].emailStatus, 'SIMULADO_LOCAL');
  assert.equal(writes[0].emailRecipientCount, 0);
});
