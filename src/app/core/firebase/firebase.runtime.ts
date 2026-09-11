import { FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

export interface FirebaseRuntimeConfig {
  mode: 'local' | 'production';
  firebase: FirebaseOptions;
  emulators?: { projectId: string; host: string; auth: number; firestore: number; functions: number; storage: number };
}

export function validateFirebaseConfig(config: FirebaseRuntimeConfig): void {
  if (config.mode === 'production') {
    if (config.firebase.projectId?.startsWith('demo-') || config.emulators) {
      throw new Error('Configuracion de produccion incompatible con emuladores.');
    }
    return;
  }
  const local = config.emulators;
  if (config.mode !== 'local' || !local || !local.projectId.startsWith('demo-')
    || config.firebase.projectId !== local.projectId || local.host !== '127.0.0.1'
    || ![local.auth, local.firestore, local.functions, local.storage].every((port) => Number.isInteger(port) && port > 0 && port < 65536)) {
    throw new Error('Modo local requiere proyecto demo- y todos los emuladores en 127.0.0.1.');
  }
  if (typeof window !== 'undefined' && !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
    throw new Error('La compilacion local solo puede ejecutarse en este equipo.');
  }
}

/** Connect every SDK before returning any service. Never reuse unknown endpoints. */
export function initializeFirebaseRuntime(config: FirebaseRuntimeConfig, name = config.mode === 'local' ? 'spai-local' : '[DEFAULT]') {
  validateFirebaseConfig(config);
  if (getApps().some((app) => app.name === name)) {
    throw new Error('Firebase ya fue inicializado; no se reutilizara una conexion no verificada.');
  }
  const app = initializeApp(config.firebase, name);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalLongPollingOptions: { timeoutSeconds: 25 },
    ignoreUndefinedProperties: true,
  });
  const functions = getFunctions(app, 'us-central1');
  const storage = getStorage(app);
  if (config.mode === 'local') {
    const local = config.emulators!;
    connectAuthEmulator(auth, `http://${local.host}:${local.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, local.host, local.firestore);
    connectFunctionsEmulator(functions, local.host, local.functions);
    connectStorageEmulator(storage, local.host, local.storage);
  }
  return { app, auth, db, functions, storage };
}
