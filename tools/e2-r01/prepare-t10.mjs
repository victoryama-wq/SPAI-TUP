import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {deleteApp} from 'firebase/app';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {terminate} from 'firebase/firestore';
import {config,root,password,sessionFile,isolatedTest,localEnvironment,verifyHub} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
import {guardNetwork} from '../local/tests/network-guard.mjs';
import {createT10Assignment} from './t10-fixture.mjs';

assert.equal(isolatedTest,true,'No se permite alterar la demo compartida');guardNetwork();await verifyHub();
assert.equal(JSON.parse(readFileSync(sessionFile,'utf8')).synthetic,true);
Object.assign(process.env,localEnvironment());const require=createRequire(resolve(root,'functions/package.json'));
const {initializeApp,deleteApp:deleteAdmin}=require('firebase-admin/app');const {getFirestore}=require('firebase-admin/firestore');
const admin=initializeApp({projectId:config.projectId},'t10-review');const db=getFirestore(admin);
const client=runtime.initializeFirebaseRuntime(localConfig,'t10-review-command');
try{
 await signInWithEmailAndPassword(client.auth,'demo.sistemas@tecplayacar.edu.mx',password);
 const aux=(await db.doc('usuarios/demo-auxiliar').get()).data();assert.ok(!aux.delegationId,'Usar una sesión aislada nueva');
 await httpsCallable(client.functions,'securityCommand')({operationId:crypto.randomUUID(),reason:'Escenario humano aislado T10, sin cambios en LAN',action:'grantDelegation',targetId:'demo-auxiliar',expectedRevision:aux.revision,value:{permissions:{asignaciones:'EDIT'},capabilities:[],scope:{programs:['ADM'],cycles:['27-1']}}});
 await createT10Assignment(db);
 console.log('T10 listo: 27-1 Captura; acceptance-foreign DER; CA puede matrícula; Consulta VIEW y Auxiliar EDIT solo ADM/27-1. Datos ficticios aislados.');
}finally{await terminate(client.db);await deleteApp(client.app);await deleteAdmin(admin);}
