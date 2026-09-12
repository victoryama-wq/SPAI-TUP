import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { deleteApp } from 'firebase/app';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDocFromServer, getDocsFromServer, collection, setDoc, updateDoc, deleteDoc, terminate } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { root, config, localEnvironment, verifyHub, password } from '../local/config.mjs';
import { fixtures } from '../local/fixtures.mjs';
import { runtime, localConfig } from '../local/tests/runtime.mjs';
import { guardNetwork } from '../local/tests/network-guard.mjs';
import { reporter } from './report.mjs';

if (process.env.SPAI_LOCAL_SYNTHETIC !== 'true') throw new Error('Usa npm run test:stage1; no ejecutar contra una demo personal.');
const network = guardNetwork();
await verifyHub();
Object.assign(process.env, localEnvironment());
const require = createRequire(resolve(root, 'functions/package.json'));
const adminApp = require('firebase-admin/app');
const adminAuth = require('firebase-admin/auth');
const adminFirestore = require('firebase-admin/firestore');
const admin = adminApp.initializeApp({ projectId: config.projectId }, 'stage1-setup');
const db = adminFirestore.getFirestore(admin);
const report = reporter('stage1-rules');
const modules = Object.keys(fixtures().find((d) => d.path === 'usuarios/demo-sistemas').data.access);
const access = (value) => Object.fromEntries(modules.map((key) => [key, value]));
const specs = [
  ['systems', 'Coordinación de Sistemas', 'Activo', true, []],
  ['aux-off', 'Auxiliar de Sistemas', 'Activo', false, []],
  ['academic-a', 'Coordinación Académica', 'Activo', true, ['ADM']],
  ['academic-b', 'Coordinación Académica', 'Activo', true, ['DER']],
  ['academic-c', 'Coordinación Académica', 'Activo', true, ['OTRO']],
  ['academic-off', 'Coordinación Académica', 'Activo', false, ['ADM']],
  ['inactive', 'Coordinación de Sistemas', 'Inactivo', true, []],
  ['custom-view', 'Consulta Sistemas', 'Activo', true, []],
  ['custom-off', 'Consulta limitada', 'Activo', false, []],
  ['custom-edit', 'Operador personalizado', 'Activo', true, []],
  ['aux-users', 'Auxiliar de Sistemas', 'Activo', false, []],
  ['legacy', 'Pendiente de autorizacion', 'Inactivo', false, []],
];
const services = new Map();
const uid = (key) => `stage1-${key}`;
const email = (key) => `${uid(key)}@tecplayacar.edu.mx`;
const fixture = (path) => structuredClone(fixtures().find((d) => d.path === path).data);
const source = { ...fixture('asignaciones/demo-asignacion-a'), createdBy: uid('academic-a') };
const shared = { ...fixture('solicitudes_compartidas/demo-compartida-0'), sourceAssignmentId: 'stage1-source', requestedBy: uid('academic-b') };
async function reset(path, data) { await db.doc(path).set(data); }
const path = (key, name) => doc(services.get(key).db, name);
async function allowed(operation) {
  try { await operation(); return true; }
  catch (error) { if (error.code === 'permission-denied') return false; throw error; }
}
async function check(id, finding, stage, operation, baseline, expected, evidence = 'firestore.rules') {
  report.check(id, finding, stage, await allowed(operation), baseline, expected, evidence);
}

try {
  for (const [key, role, status, enabled, assignedPrograms] of specs) {
    await adminAuth.getAuth(admin).createUser({ uid: uid(key), email: email(key), password, emailVerified: true });
    await reset(`usuarios/${uid(key)}`, { authUid: uid(key), name: `Ficticio ${key}`, email: email(key), role, status, access: { ...access(enabled), ...(key === 'aux-users' ? { usuarios: true } : {}) }, assignedPrograms });
    const client = runtime.initializeFirebaseRuntime(localConfig, `stage1-${key}`);
    services.set(key, client);
    await signInWithEmailAndPassword(client.auth, email(key), password);
  }
  services.set('anonymous', runtime.initializeFirebaseRuntime(localConfig, 'stage1-anonymous'));
  await reset('roles_personalizados/stage1-view', { name: 'Consulta Sistemas', status: 'Activo', permissions: Object.fromEntries(modules.map((key) => [key, 'view'])) });
  await reset('roles_personalizados/stage1-edit', { name: 'Operador personalizado', status: 'Activo', permissions: Object.fromEntries(modules.map((key) => [key, 'edit'])) });
  await reset('asignaciones/stage1-source', source);
  await reset('solicitudes_compartidas/stage1-request', shared);
  for (const who of ['anonymous', 'inactive']) {
    await check(`AUTH-${who}-READ`, 'AUTH', 2, () => getDocFromServer(path(who, 'ciclos/demo-27-1')), false, false);
    await check(`AUTH-${who}-WRITE`, 'AUTH', 2, () => updateDoc(path(who, 'asignaciones/stage1-source'), { teacherName: 'FICTICIO' }), false, false);
  }
  await check('INACTIVE-OWN-PROFILE', 'AUTH', 2, () => getDocFromServer(path('inactive', `usuarios/${uid('inactive')}`)), true, true);
  await assert.rejects(httpsCallable(services.get('anonymous').functions, 'syncUserProfileByEmail')({}), (e) => e.code === 'functions/unauthenticated');
  report.check('FUNCTION-ANONYMOUS', 'AUTH', 2, 'unauthenticated', 'unauthenticated', 'unauthenticated', 'Functions syncUserProfileByEmail');
  const inactiveSync = await httpsCallable(services.get('inactive').functions, 'syncUserProfileByEmail')({});
  report.check('FUNCTION-INACTIVE-STAYS-INACTIVE', 'AUTH', 2, [inactiveSync.data.synced, (await db.doc(`usuarios/${uid('inactive')}`).get()).data().status], [true, 'Inactivo'], [true, 'Inactivo'], 'Functions synchronizes profile but does not activate it');

  for (const name of ['ciclos', 'grupos', 'docentes', 'asignaturas', 'usuarios']) {
    await check(`OFF-READ-${name}`, 'F01', 2, () => getDocsFromServer(collection(services.get('custom-off').db, name)), true, false, 'canReadInstitutionalCatalogs / canReadUsersDirectory vs SPEC 25.10');
  }
  for (const who of ['aux-off', 'custom-view']) {
    await check(`OFF-WRITE-${who}`, 'F01', 2, () => updateDoc(path(who, 'ciclos/demo-27-2'), { notes: 'FICTICIO' }), true, false, 'canEditCycles ignores disabled bit or custom view when name contains Sistemas');
  }
  await check('CUSTOM-EDIT-GROUP', 'F01', 2, () => updateDoc(path('custom-edit', 'grupos/27_1_ADM_11_01'), { programName: 'FICTICIO' }), false, null, 'Generic custom edit versus Systems-only catalog rule; decision D3');
  await check('ACADEMIC-LEGACY-FLAGS', 'F01', 2, () => getDocFromServer(path('academic-off', 'asignaciones/stage1-source')), true, null, 'SPEC 6 inherited academic read versus 25.10 module permission; decision D3');

  for (const [name, creator] of [['own', 'academic-a'], ['other', 'academic-b']]) {
    const teacher = { ...fixture('docentes/demo-docente-2'), normalizedMoodleUser: `stage1-${name}`, createdBy: uid(creator) };
    await reset(`docentes/stage1-${name}`, teacher);
    await check(`TEACHER-EDIT-${name}`, 'F02', 2, () => updateDoc(path('academic-a', `docentes/stage1-${name}`), { fullName: 'CAMBIO FICTICIO' }), true, name === 'own');
    await check(`TEACHER-DELETE-${name}`, 'F02', 2, () => deleteDoc(path('academic-a', `docentes/stage1-${name}`)), name === 'own', name === 'own');
  }
  await check('TEACHER-OFF-EDIT', 'F02', 2, () => updateDoc(path('custom-off', 'docentes/stage1-other'), { fullName: 'SIN MODULO' }), true, false);
  await check('TEACHER-VALIDATED-PROTECTED', 'F02', 2, () => updateDoc(path('academic-a', 'docentes/demo-docente-1'), { fullName: 'AJENO' }), false, false);

  for (const who of ['academic-a', 'academic-b', 'academic-c']) {
    await reset('solicitudes_compartidas/stage1-request', shared);
    await check(`REQUEST-READ-${who}`, 'F03', 2, () => getDocFromServer(path(who, 'solicitudes_compartidas/stage1-request')), true, who !== 'academic-c');
    await check(`REQUEST-RESOLVE-${who}`, 'F03', 2, () => updateDoc(path(who, 'solicitudes_compartidas/stage1-request'), { status: 'ACEPTADA', respondedBy: uid(who) }), true, who === 'academic-a');
  }
  await check('REQUEST-TERMINAL-REWRITE', 'F07', 3, () => updateDoc(path('academic-a', 'solicitudes_compartidas/stage1-request'), { status: 'RECHAZADA' }), true, false);
  await check('REQUEST-FORGED-OWNER', 'F03', 2, () => setDoc(path('academic-a', 'solicitudes_compartidas/stage1-forged'), { ...shared, requestedBy: uid('academic-b') }), true, false);
  await check('SYSTEM-REQUEST-FOREIGN-READ', 'F03', 2, () => getDocFromServer(path('academic-a', 'solicitudes_sistemas/demo-reapertura')), false, false);
  await check('SYSTEM-REQUEST-FOREIGN-DELETE', 'F03', 2, () => deleteDoc(path('academic-a', 'solicitudes_sistemas/demo-reapertura')), true, false);

  for (const status of ['Preparacion', 'Captura', 'Captura cerrada', 'Cerrado']) {
    await db.doc('ciclos/demo-27-1').update({ status });
    await reset('asignaciones/stage1-source', source);
    await check(`CYCLE-WRITE-${status}`, 'F04', 3, () => updateDoc(path('academic-a', 'asignaciones/stage1-source'), { teacherName: `FICTICIO ${status}` }), true, status === 'Captura');
    await check(`CYCLE-CREATE-${status}`, 'F04', 3, () => setDoc(path('academic-a', 'asignaciones/stage1-new'), source), true, status === 'Captura');
    await db.doc('asignaciones/stage1-new').delete();
  }
  await check('SYSTEMS-CLOSED-OPERATIONS', 'F04', 3, () => updateDoc(path('systems', 'asignaciones/stage1-source'), { observations: 'REVISION FICTICIA' }), true, true, 'SPEC 10 Systems retains operational correction; exact operation matrix D1');
  await db.doc('ciclos/demo-27-1').update({ status: 'Captura' });
  await check('ACADEMIC-FOREIGN-TEACHER', 'F09', 2, () => updateDoc(path('academic-b', 'asignaciones/stage1-source'), { teacherName: 'AJENO' }), false, false);
  await check('ACADEMIC-OWN-ENROLLMENTS', 'F11', 2, () => updateDoc(path('academic-a', 'asignaciones/stage1-source'), { studentEnrollments: 'tup-ficticio-own' }), true, true, 'Positive control: same field and document, authorized source program');
  await check('ACADEMIC-FOREIGN-ENROLLMENTS', 'F11', 2, () => updateDoc(path('academic-b', 'asignaciones/stage1-source'), { studentEnrollments: 'tup-ficticio' }), false, true, 'Observed permission-denied with maximum 1000 expressions reached; SPEC 25.4 permits global enrollment-only edit during Captura');
  await check('ACADEMIC-FOREIGN-CREATE', 'F09', 2, () => setDoc(path('academic-b', 'asignaciones/stage1-outside'), { ...source, program: 'OTRO', createdBy: uid('academic-b'), createdByPrograms: ['OTRO'] }), true, false);
  await reset('asignaciones/stage1-source', { ...source, status: 'CARGADO_MOODLE' });
  await check('MOODLE-IDENTITY-PROTECTED', 'F08', 3, () => updateDoc(path('systems', 'asignaciones/stage1-source'), { subjectName: 'CAMBIO' }), false, false);
  await check('MOODLE-STATUS-RESET-ALLOWED', 'F08', 3, () => updateDoc(path('systems', 'asignaciones/stage1-source'), { status: 'EN_CAPTURA', shared: true, sharedGroups: ['FICTICIO'], sharedPrograms: ['DER'] }), true, false, 'Sharing must retain Moodle state, current client payload resets it');

  await check('PROFILE-SELF-ESCALATION-DENIED-ACADEMIC', 'F10', 2, () => updateDoc(path('academic-a', `usuarios/${uid('academic-a')}`), { role: 'Coordinación de Sistemas', access: access(true) }), false, false);
  await check('PROFILE-AUX-SELF-ESCALATION', 'F10', 2, () => updateDoc(path('aux-users', `usuarios/${uid('aux-users')}`), { role: 'Coordinación de Sistemas', access: access(true) }), true, false, 'canManageUsers allows delegated auxiliary to grant own higher privileges');
  await check('PROFILE-ESCALATED-CAPABILITY', 'F10', 2, () => deleteDoc(path('aux-users', 'roles_personalizados/stage1-edit')), true, false);
  await reset(`usuarios/${uid('legacy')}`, { email: email('legacy'), authUid: null });
  await check('PROFILE-LEGACY-ADDED-FIELDS', 'F10', 2, () => updateDoc(path('legacy', `usuarios/${uid('legacy')}`), { authUid: uid('legacy'), role: 'Coordinación de Sistemas', status: 'Activo', access: access(true) }), true, false, 'isOwnEmailBinding uses changedKeys, ignores added authorization fields on incomplete legacy profile');
  await check('PROFILE-LEGACY-CAPABILITY', 'F10', 2, () => updateDoc(path('legacy', 'ciclos/demo-27-2'), { notes: 'ESCALAMIENTO FICTICIO' }), true, false);

  assert.ok(network.length > 0 && network.every((h) => ['127.0.0.1', 'localhost', '::1'].includes(h)));
  report.finish();
} finally {
  for (const client of services.values()) { await terminate(client.db); await deleteApp(client.app); }
  await adminApp.deleteApp(admin);
}
