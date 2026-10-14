import emulators from './local-emulators.json';
import accounts from './local-accounts.json';
import reviewAccounts from './local-review-accounts.json';

// This environment is selected only by the explicit LAN build. All SDK traffic
// goes through the same LAN gateway; emulator administration remains on loopback.
const host = window.location.hostname;
export const environment = {
  mode: 'local' as 'local' | 'production',
  production: false,
  demoAccounts: [...accounts, ...reviewAccounts],
  demoLan: true,
  emulators: { ...emulators, host, auth: 4201, firestore: 4201, functions: 4201, storage: 4201 },
  firebase: {
    apiKey: 'demo-spai-tup-not-a-real-key', authDomain: host, projectId: emulators.projectId,
    storageBucket: `${emulators.projectId}.appspot.com`, messagingSenderId: '000000000000',
    appId: '1:000000000000:web:demo-spai-tup',
  },
};
