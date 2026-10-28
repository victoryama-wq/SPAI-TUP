// Run after final-prepare.mjs renewal, only in the owned synthetic slot.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {terminate} from 'firebase/firestore';
import {deleteApp} from 'firebase/app';
import {root,config,complementTest,verifyHub,localEnvironment,password} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
assert.equal(complementTest,true);assert.ok([28080,39080].includes(config.firestore));await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json')),A=require('firebase-admin/app'),app=A.initializeApp({projectId:config.projectId},'renewal-proof'),db=require('firebase-admin/firestore').getFirestore(app);
const client=runtime.initializeFirebaseRuntime(localConfig,'renewal-proof');
try {
 await signInWithEmailAndPassword(client.auth,'demo.sistemas@tecplayacar.edu.mx',password);
 const before=(await db.doc('ciclos/demo-27-1').get()).data();assert.equal(before.status,'Cerrado');assert.equal((await db.collection('ciclos').get()).size,2);
 const command=httpsCallable(client.functions,'cycleCommand');
 await command({action:'purge',cycleId:'demo-26-3',expectedRevision:1,reason:'Renovación ficticia aislada sin dependencias',operationId:crypto.randomUUID()});
 assert.equal((await db.doc('ciclos/demo-26-3').get()).exists,false);
 const created=(await command({action:'create',payload:{code:'27-2',label:'Siguiente ciclo ficticio'},operationId:crypto.randomUUID()})).data;
 assert.equal(created.status,'Preparacion');assert.equal((await db.collection('ciclos').get()).size,2);assert.deepEqual((await db.doc('ciclos/demo-27-1').get()).data(),before);
 writeFileSync(resolve(root,(process.env.SPAI_LOCAL_TEST_SLOT === 'preproduction' ? 'docs/evidence/r02-preproduction-20261028/renewal-callable.json' : 'docs/evidence/r02-final-review/renewal-callable.json')),JSON.stringify({at:new Date().toISOString(),status:'PASS',environment:`isolated ${config.firestore}/${config.functions}; frontend ${process.env.SPAI_LOCAL_TEST_SLOT === 'preproduction' ? 4207 : 4204}`,authenticatedActor:'demo-sistemas',olderDeleted:'26-3',latestPreserved:'27-1',created:'27-2',nextStatus:created.status,humanAcceptance:false},null,2));console.log('PASS renovación del escenario reproducible mediante callable autenticado');
}finally{await terminate(client.db);await deleteApp(client.app);await A.deleteApp(app);}
