import config from './local-emulators.json';
import accounts from './local-accounts.json';
import reviewAccounts from './local-review-accounts.json';

/** Fixed loopback-only acceptance suite. Never selected by the production build. */
export const environment = {
  mode: 'local' as 'local' | 'production', production: false,
  demoAccounts: [...accounts, ...reviewAccounts],
  emulators: { ...config, auth:29099, firestore:28080, functions:25001, storage:29199 },
  firebase: {
    apiKey:'demo-spai-tup-not-a-real-key', authDomain:'127.0.0.1', projectId:config.projectId,
    storageBucket:`${config.projectId}.appspot.com`, messagingSenderId:'000000000000', appId:'1:000000000000:web:demo-spai-tup',
  },
};
