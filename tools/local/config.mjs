import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, delimiter } from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const isolatedTest = process.env.SPAI_LOCAL_TEST_ISOLATED === 'true';
if (isolatedTest && process.env.SPAI_LOCAL_SYNTHETIC !== 'true') throw new Error('El ensayo aislado requiere fixtures sintéticos.');
export const preproductionTest = process.env.SPAI_LOCAL_TEST_SLOT === 'preproduction';
export const complementTest = process.env.SPAI_LOCAL_TEST_SLOT === 'complement' || preproductionTest;
export const recoveryTest = process.env.SPAI_LOCAL_TEST_SLOT === 'recovery';
if (recoveryTest && !isolatedTest) throw new Error('La recuperacion requiere emuladores aislados sinteticos.');
if (complementTest && !isolatedTest) throw new Error('El complemento solo admite emuladores aislados sinteticos.');
export const testOffset = isolatedTest ? (recoveryTest ? 40000 : preproductionTest ? 31000 : complementTest ? 20000 : 10000) : 0;
export const config = JSON.parse(readFileSync(resolve(root, 'src/environments/local-emulators.json'), 'utf8'));
if (isolatedTest) for (const key of ['auth','firestore','functions','storage','hub','ui','control']) config[key] += testOffset;
export const cliConfigFile = resolve(root, recoveryTest ? '.local-emulators.recovery.json' : complementTest ? '.local-emulators.complement.json' : isolatedTest ? '.local-emulators.isolated.json' : 'firebase.local.json');
export const loggingPort = 4500 + testOffset;
export const websocketPort = 9150 + testOffset;
export const accounts = JSON.parse(readFileSync(resolve(root, 'src/environments/local-accounts.json'), 'utf8'));
export const password = 'Demo-only-2026!';
export const sessionFile = resolve(root, recoveryTest ? '.local/tunnel-recovery/session.json' : complementTest ? '.local/session-complement.json' : isolatedTest ? '.local/session-isolated.json' : '.local/session.json');

export function assertLocalConfig(candidate = config) {
  if (candidate.projectId !== 'demo-spai-tup' || candidate.host !== '127.0.0.1') {
    throw new Error('Solo se admite demo-spai-tup en 127.0.0.1.');
  }
  const expected = { auth: 9099, firestore: 8080, functions: 5001, storage: 9199, hub: 4400, ui: 4000, control: 4310 };
  for (const [key, port] of Object.entries(expected)) {
    if (candidate[key] !== port + testOffset) throw new Error(`Puerto local inesperado: ${key}.`);
  }
}

export function localEnvironment() {
  assertLocalConfig();
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(GOOGLE_APPLICATION_CREDENTIALS|FIREBASE_TOKEN|GOOGLE_OAUTH_ACCESS_TOKEN|SPAI_SMTP_PASSWORD|GCLOUD_PROJECT|GOOGLE_CLOUD_PROJECT|FIREBASE_CONFIG)$/i.test(key)) delete env[key];
  }
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = `${dirname(process.execPath)}${delimiter}${env[pathKey] || ''}`;
  return {
    ...env, SPAI_LOCAL_MODE: 'true', GCLOUD_PROJECT: config.projectId, GOOGLE_CLOUD_PROJECT: config.projectId,
    XDG_CONFIG_HOME: resolve(root, '.local/cli-config'),
    APPDATA: resolve(root, '.local/appdata'),
    CLOUDSDK_CONFIG: resolve(root, '.local/gcloud'),
    GOOGLE_APPLICATION_CREDENTIALS: resolve(root, '.local/disabled-cloud-credentials.json'),
    FUNCTIONS_DISCOVERY_TIMEOUT: '30',
    FIREBASE_CONFIG: JSON.stringify({ projectId: config.projectId, storageBucket: `${config.projectId}.appspot.com` }),
    FIRESTORE_EMULATOR_HOST: `${config.host}:${config.firestore}`,
    FIREBASE_AUTH_EMULATOR_HOST: `${config.host}:${config.auth}`,
    FIREBASE_STORAGE_EMULATOR_HOST: `${config.host}:${config.storage}`,
  };
}

export async function verifyHub() {
  assertLocalConfig();
  const base = `http://${config.host}:${config.hub}`;
  const info = await fetch(`${base}/`, { signal: AbortSignal.timeout(2000) }).then((r) => r.json());
  const session = JSON.parse(readFileSync(sessionFile, 'utf8'));
  if (session.projectId !== config.projectId || info.pid !== session.emulatorPid) {
    throw new Error('El hub no pertenece a la sesion DEMO iniciada por este repositorio.');
  }
  const emulators = await fetch(`${base}/emulators`, { signal: AbortSignal.timeout(2000) }).then((r) => r.json());
  for (const service of ['auth', 'firestore', 'functions', 'storage']) {
    if (emulators[service]?.host !== config.host || emulators[service]?.port !== config[service]) {
      throw new Error(`Emulador ${service} ausente o incompatible.`);
    }
  }
}
