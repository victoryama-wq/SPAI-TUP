'use strict';

/** Fail closed if any emulator indicator is present. Never accept a live project here. */
function resolveLocalRuntime(env = process.env) {
  const firebaseConfig = JSON.parse(env.FIREBASE_CONFIG || '{}');
  const projectId = env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId;
  const local = env.FUNCTIONS_EMULATOR === 'true' || env.SPAI_LOCAL_MODE === 'true'
    || projectId?.startsWith('demo-') || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST
    || env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (!local) return null;
  // Firebase's discovery worker does not forward arbitrary SPAI_* variables.
  // Only these two complete loopback tuples are permitted, never mixed ports.
  const isolated = env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:18080'
    && env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:19099'
    && env.FIREBASE_STORAGE_EMULATOR_HOST === '127.0.0.1:19199';
  if (projectId !== 'demo-spai-tup'
    || [env.GCLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT, firebaseConfig.projectId].some((id) => id && id !== projectId)
    || env.FIRESTORE_EMULATOR_HOST !== `127.0.0.1:${isolated ? 18080 : 8080}`
    || env.FIREBASE_AUTH_EMULATOR_HOST !== `127.0.0.1:${isolated ? 19099 : 9099}`
    || env.FIREBASE_STORAGE_EMULATOR_HOST !== `127.0.0.1:${isolated ? 19199 : 9199}`) {
    throw new Error('Configuracion local incompleta: se requiere demo-spai-tup y los emuladores locales.');
  }
  return { projectId };
}

module.exports = { resolveLocalRuntime };
