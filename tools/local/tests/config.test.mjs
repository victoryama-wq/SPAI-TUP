import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { config, root, localEnvironment, assertLocalConfig, accounts, cliConfigFile } from '../config.mjs';
import { fixtures } from '../fixtures.mjs';
import { runtime, localConfig } from './runtime.mjs';

const require = createRequire(import.meta.url);
const { resolveLocalRuntime } = require('../../../functions/local-runtime.js');

test('UUID fallback uses secure random bytes on HTTP LAN and preserves UUID v4 format', () => {
  const source = readFileSync(resolve(root, 'src/app/core/utils/random-id.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported = {};
  vm.runInNewContext(code, { exports: exported });
  let calls = 0;
  const fallback = { getRandomValues: (bytes) => { calls++; return globalThis.crypto.getRandomValues(bytes); } };
  const ids = Array.from({ length: 100 }, () => exported.randomId(fallback));
  assert.equal(calls, 100);
  assert.equal(new Set(ids).size, 100);
  for (const id of ids) assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(exported.randomId({ randomUUID: () => 'native-path' }), 'native-path');
  assert.throws(() => exported.randomId({}));
});

test('LAN is opt-in, private, same-host and only demo-spai-tup through declared ports 4201, 4203 or 4205', () => {
  const before = globalThis.window;
  try {
    globalThis.window = { location: { hostname: '192.168.41.254', protocol: 'http:', port: '4201' } };
    const lan = { ...localConfig, demoLan: true, emulators: { ...config, host: '192.168.41.254', auth: 4201, firestore: 4201, functions: 4201, storage: 4201 } };
    assert.doesNotThrow(() => runtime.validateFirebaseConfig(lan));
    assert.throws(() => runtime.validateFirebaseConfig(localConfig));
    globalThis.window.location.port = '4203';
    const isolatedLan = { ...lan, emulators: { ...lan.emulators, auth: 4203, firestore: 4203, functions: 4203, storage: 4203 } };
    assert.doesNotThrow(() => runtime.validateFirebaseConfig(isolatedLan));
    assert.throws(() => runtime.validateFirebaseConfig(lan));
    globalThis.window.location.port = '4205';
    const complementLan = { ...lan, emulators: { ...lan.emulators, auth: 4205, firestore: 4205, functions: 4205, storage: 4205 } };
    assert.doesNotThrow(() => runtime.validateFirebaseConfig(complementLan));
    assert.throws(() => runtime.validateFirebaseConfig(isolatedLan));
    globalThis.window.location.port = '4204';
    assert.throws(() => runtime.validateFirebaseConfig({ ...lan, emulators: { ...lan.emulators, auth: 4204, firestore: 4204, functions: 4204, storage: 4204 } }));
    globalThis.window.location.port = '4201';

    for (const bad of [
      { ...lan, demoLan: false }, { ...lan, mode: 'production' },
      { ...lan, emulators: { ...lan.emulators, host: '8.8.8.8' } },
      { ...lan, emulators: { ...lan.emulators, host: '192.168.41.253' } },
      { ...lan, emulators: { ...lan.emulators, firestore: 8080 } },
      { ...lan, firebase: { ...lan.firebase, projectId: 'real-project' } },
    ]) assert.throws(() => runtime.validateFirebaseConfig(bad));
  } finally {
    if (before === undefined) delete globalThis.window; else globalThis.window = before;
  }
});

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
  const isolated = { ...env, FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080', FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099', FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:19199' };
  assert.equal(resolveLocalRuntime(isolated).projectId, 'demo-spai-tup');
  for (const [key, normal] of Object.entries({FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099', FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199'})) {
    assert.throws(() => resolveLocalRuntime({...isolated,[key]:normal}));
  }
});

test('Angular, Firebase CLI and scripts share endpoints; rules remain the original files', () => {
  const cli = JSON.parse(readFileSync(cliConfigFile));
  for (const key of ['auth', 'firestore', 'functions', 'storage', 'hub', 'ui']) {
    assert.equal(cli.emulators[key].host, config.host);
    assert.equal(cli.emulators[key].port, config[key]);
  }
  assert.equal(resolve(dirname(cliConfigFile), cli.firestore.rules), resolve(root,'firestore.rules'));
  assert.equal(resolve(dirname(cliConfigFile), cli.storage.rules), resolve(root,'storage.rules'));
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
    './security/user-deletion': require('../../../functions/security/user-deletion'),
    'firebase-admin/auth': { getAuth: () => ({}) },
    './security/service': require('../../../functions/security/service'),
    './cycles/service': require('../../../functions/cycles/service'),
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
