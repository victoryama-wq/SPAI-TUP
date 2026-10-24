import emulators from './local-emulators.json';
import accounts from './local-accounts.json';
import reviewAccounts from './local-review-accounts.json';

// Separate opt-in build. Auth, Firestore and Functions use explicit HTTPS at
// the tunnel; no SDK internals, production endpoints or remote database.
const host = window.location.hostname;
const port = Number(window.location.port || '443');
export const environment = {
  mode: 'local' as 'local' | 'production', production: false, demoTunnel: true,
  demoAccounts: [...accounts, ...reviewAccounts],
  emulators: { ...emulators, host, auth: port, firestore: port, functions: port, storage: port },
  firebase: {
    apiKey: 'demo-spai-tup-not-a-real-key', authDomain: host, projectId: emulators.projectId,
    storageBucket: `${emulators.projectId}.appspot.com`, messagingSenderId: '000000000000',
    appId: '1:000000000000:web:demo-spai-tup',
  },
};
