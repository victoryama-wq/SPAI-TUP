'use strict';

/** Fail closed if any emulator indicator is present. Never accept a live project here. */
function resolveLocalRuntime(env = process.env) {
  const firebaseConfig = JSON.parse(env.FIREBASE_CONFIG || '{}');
  const projectId = env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId;
  const local = env.FUNCTIONS_EMULATOR === 'true' || env.SPAI_LOCAL_MODE === 'true'
    || projectId?.startsWith('demo-') || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST
    || env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (!local) return null;
  if (projectId !== 'demo-spai-tup'
    || [env.GCLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT, firebaseConfig.projectId].some((id) => id && id !== projectId)
    || env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080'
    || env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
    || env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') {
    throw new Error('Configuracion local incompleta: se requiere demo-spai-tup y los emuladores locales.');
  }
  return { projectId };
}

module.exports = { resolveLocalRuntime };
