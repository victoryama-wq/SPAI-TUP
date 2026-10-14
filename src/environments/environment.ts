import emulators from './local-emulators.json';
import accounts from './local-accounts.json';
import reviewAccounts from './local-review-accounts.json';

export const environment = {
  mode: 'local' as 'local' | 'production',
  production: false,
  demoAccounts: [...accounts, ...reviewAccounts],
  emulators,
  firebase: {
    apiKey: 'demo-spai-tup-not-a-real-key',
    authDomain: '127.0.0.1',
    projectId: emulators.projectId,
    storageBucket: `${emulators.projectId}.appspot.com`,
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:demo-spai-tup',
  },
};
