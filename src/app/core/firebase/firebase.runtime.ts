import { FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

export interface FirebaseRuntimeConfig {
  mode: 'local' | 'production';
  demoLan?: boolean;
  demoTunnel?: boolean;
  firebase: FirebaseOptions;
  emulators?: { projectId: string; host: string; auth: number; firestore: number; functions: number; storage: number };
}

export function validateFirebaseConfig(config: FirebaseRuntimeConfig): void {
  if (config.mode === 'production') {
    if (config.firebase.projectId?.startsWith('demo-') || config.emulators || config.demoLan || config.demoTunnel) {
      throw new Error('Configuracion de produccion incompatible con emuladores.');
    }
    return;
  }
  const local = config.emulators;
  const tunnel = config.demoTunnel === true && config.demoLan !== true && local?.projectId === 'demo-spai-tup'
    && typeof window !== 'undefined' && window.location.hostname === local.host
    && ((window.location.protocol === 'https:' && /^[a-z0-9-]+\.[a-z0-9-]+\.devtunnels\.ms$/.test(local.host)
      && ['', '443'].includes(window.location.port) && [local.auth, local.firestore, local.functions, local.storage].every(port => port === 443))
      || (window.location.protocol === 'http:' && window.location.hostname === '127.0.0.1' && window.location.port === '4206'
        && [local.auth, local.firestore, local.functions, local.storage].every(port => port === 4206)));
  const octets = local?.host.split('.').map(Number) ?? [];
  const privateHost = octets.length === 4 && octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    && (octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168));
  const lan = config.demoLan === true && privateHost && local?.projectId === 'demo-spai-tup'
    && typeof window !== 'undefined' && window.location.hostname === local.host
    && window.location.protocol === 'http:' && ['4201', '4203', '4205'].includes(window.location.port)
    && [local.auth, local.firestore, local.functions, local.storage].every((port) => port === Number(window.location.port));
  if (config.mode !== 'local' || !local || !local.projectId.startsWith('demo-')
    || config.firebase.projectId !== local.projectId || (config.demoTunnel ? !tunnel : config.demoLan ? !lan : local.host !== '127.0.0.1')
    || ![local.auth, local.firestore, local.functions, local.storage].every((port) => Number.isInteger(port) && port > 0 && port < 65536)) {
    throw new Error('Modo local requiere emuladores de prueba en loopback o la pasarela LAN explicita.');
  }
  if (!lan && !tunnel && typeof window !== 'undefined' && !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
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
  const secureTunnel = config.demoTunnel === true && window.location.protocol === 'https:';
  const tunnelEndpoint = secureTunnel ? `https://${config.emulators!.host}` : undefined;
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    ...(secureTunnel ? { host: config.emulators!.host, ssl: true } : {}),
    experimentalForceLongPolling: true,
    experimentalLongPollingOptions: { timeoutSeconds: 25 },
    ignoreUndefinedProperties: true,
  });
  const functions = getFunctions(app, tunnelEndpoint ? `${tunnelEndpoint}/demo-spai-tup/us-central1` : 'us-central1');
  const storage = getStorage(app);
  if (config.mode === 'local') {
    const local = config.emulators!;
    connectAuthEmulator(auth, tunnelEndpoint || `http://${local.host}:${local.auth}`, { disableWarnings: true });
    if (!secureTunnel) {
      connectFirestoreEmulator(db, local.host, local.firestore);
      connectFunctionsEmulator(functions, local.host, local.functions);
    }
    connectStorageEmulator(storage, local.host, local.storage);
  }
  return { app, auth, db, functions, storage };
}
