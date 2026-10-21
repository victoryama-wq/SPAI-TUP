import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { sourceMembers, sourceFunctions } from '../stage1/source-harness.mjs';
const require = createRequire(import.meta.url);
const P = require('../../functions/security/policy');
const profile = { authUid: 'helper', status: 'Activo', baseRole: 'ADMIN_OPERATIVO', permissionSchemaVersion: 2, delegationId: 'grant' };
const grant = { id: 'grant', userId: 'helper', status: 'ACTIVE', permissions: { docentes: 'EDIT' }, capabilities: ['MANAGE_CUSTOM_ROLES'], scope: { programs: ['ADM'] } };
test('VIEW nunca equivale a EDIT; desconocidos no se normalizan a acceso', () => {
  assert.equal(P.levels({ docentes: 'view' }).docentes, 'VIEW');
  assert.equal(P.levels().docentes, 'NONE');
  assert.throws(() => P.levels({ docentes: true })); assert.throws(() => P.levels({ unknown: 'VIEW' }));
});
test('Nombre Sistemas no concede autoridad; inactivo y ausente no operan', () => {
  for (const p of [null, { role: 'Coordinación de Sistemas', status: 'Activo' }, { ...profile, status: 'Inactivo' }]) assert.equal(P.effective(p).active, false);
});
test('Caducidad determinista, revisión y mapeo vigente en política de servidor', () => {
  assert.equal(P.effective({...profile, identityAliasOf:'canonical'},grant).active,false);
  const mapping={status:'ACTIVE',version:P.MAPPING_VERSION,approvedBy:'admin',baseRole:'COORDINACION_ACADEMICA',revision:4,profileRevision:3};
  const legacy={authUid:'legacy',status:'Activo',revision:3,legacyAuthorization:{mappingVersion:P.MAPPING_VERSION,mappingRevision:4,profileRevision:3,issuedAtMillis:1000,expiresAtMillis:1000+7*86400000,baseRole:'COORDINACION_ACADEMICA',permissions:P.levels({docentes:'VIEW',asignaciones:'NONE'}),scope:P.scope({programs:['ADM']})}};
  const at=nowMillis=>({mapping,nowMillis}); const expiry=legacy.legacyAuthorization.expiresAtMillis;
  assert.equal(P.effective(legacy,null,at(expiry-1)).permissions.docentes,'VIEW');
  assert.equal(P.effective(legacy,null,at(expiry)).active,false);
  assert.equal(P.effective(legacy,null,at(expiry+1)).active,false);
  for(const change of [{revision:4},{status:'Inactivo'},{identityAliasOf:'other'}]) assert.equal(P.effective({...legacy,...change},null,at(2000)).active,false);
  for(const change of [{revision:5},{status:'REVOKED'},{baseRole:'ALTA_DOCENTES'},{profileRevision:4}]) assert.equal(P.effective(legacy,null,{mapping:{...mapping,...change},nowMillis:2000}).active,false);
  assert.equal(P.effective(legacy,null,{nowMillis:2000}).active,false);
  assert.equal(legacy.legacyAuthorization.permissions.docentes,'VIEW');
  assert.equal(legacy.legacyAuthorization.permissions.asignaciones,'NONE');
});

test('La delegación debe ser activa, propia y referida por el perfil', () => {
  assert.equal(P.effective(profile, grant).permissions.docentes, 'EDIT');
  for (const g of [null, { ...grant, status: 'REVOKED' }, { ...grant, userId: 'other' }, { ...grant, id: 'other' }]) assert.equal(P.effective(profile, g).active, false);
});
test('Definiciones personalizadas no conceden administración ni acciones sensibles', () => {
  for (const key of ['usuarios','ciclos','moodle','bitacora','grupos']) assert.throws(() => P.customDefinition({ permissions: { [key]: 'EDIT' } }));
  assert.throws(() => P.customDefinition({ capabilities: ['MANAGE_USERS'] }));
  assert.equal(P.customDefinition({ name: 'Ficha', permissions: { docentes: 'EDIT' } }).permissions.docentes, 'EDIT');
});
test('Auxiliar no puede asignarse, asignar a administradores o superar su techo', () => {
  const actor = P.effective(profile, grant);
  const role = P.customDefinition({ permissions: { docentes: 'VIEW' }, scope: { programs: ['ADM'] } });
  assert.doesNotThrow(() => P.canAssign(actor, 'helper', 'person', { permissionSchemaVersion:2, baseRole: 'CUSTOM', assignedPrograms: ['ADM'] }, role));
  assert.throws(() => P.canAssign(actor, 'helper', 'helper', { baseRole: 'CUSTOM' }, role));
  for (const baseRole of ['ADMIN_GENERAL','ADMIN_OPERATIVO']) assert.throws(() => P.canAssign(actor, 'helper','other',{baseRole},role));
  assert.throws(() => P.canAssign(actor,'helper','other',{ baseRole:'CUSTOM', assignedPrograms:['DER'] },role));
  assert.throws(() => P.canAssign(actor,'helper','other',{baseRole:'CUSTOM'}, { ...role, scope: P.scope({programs:['*']}) }));
  assert.throws(() => P.canAssign(actor,'helper','other',{baseRole:'CUSTOM'}, { ...role, permissions: P.levels({asignaciones:'EDIT'}) }));
});
test('Migración preserva NONE y false; ausente no concede; etiqueta no verifica rol', () => {
  const mapping = { status: 'ACTIVE', version: P.MAPPING_VERSION, approvedBy: 'admin', baseRole: 'COORDINACION_ACADEMICA' };
  const input = { role: 'Coordinación de Sistemas', access: { docentes: true, asignaciones: false }, permissions: { docentes: 'NONE' }, assignedPrograms:['ADM'] };
  const result = P.legacyProposal(input,mapping);
  assert.equal(result.permissions.docentes,'NONE'); assert.equal(result.permissions.asignaciones,'NONE');
  assert.equal(result.permissions.grupos,'NONE'); assert.ok(result.unresolved.includes('grupos'));
  assert.equal(P.legacyProposal({access:{docentes:true}},null).permissions.docentes,'NONE');
  assert.equal(P.legacyProposal({access:{docentes:true}},mapping).permissions.docentes,'EDIT');
});

test('UI real permite EDIT personalizado propio, pero no VIEW ni ámbito ajeno', () => {
  const helpers=sourceFunctions('src/app/features/users/data/module-permission.service.ts',['hasAccess','isSystems','hasCapability']);
  const assignment={program:'ADM',cycle:'27-1',status:'EN_CAPTURA'};
  const user={status:'Activo',permissionSchemaVersion:2,baseRole:'CUSTOM',permissions:{asignaciones:'EDIT'},scope:{programs:['ADM'],cycles:['27-1']}};
  const ui=sourceMembers('src/app/features/assignments/pages/assignments-page.component.ts','AssignmentsPageComponent',['canEditAssignment','canModifyAssignment'],{session:()=>({appUser:user}),assignmentsReady:()=>true,assignmentCaptureAllowed:()=>true},helpers);
  assert.equal(ui.canEditAssignment(assignment),true);
  assert.equal(ui.canEditAssignment({...assignment,program:'DER'}),false);
  assert.equal(ui.canEditAssignment({...assignment,cycle:'26-3'}),false);
  user.permissions.asignaciones='VIEW';assert.equal(ui.canEditAssignment(assignment),false);
  user.permissions.asignaciones='EDIT';user.baseRole='COORDINACION_ACADEMICA';assert.equal(ui.canEditAssignment({...assignment,program:'DER'}),true);
  user.baseRole='ADMIN_OPERATIVO';assert.equal(ui.canEditAssignment({...assignment,status:'CARGADO_MOODLE'}),false);
  user.capabilities=['OPERATE_EXCEPTIONAL_CHANGE'];assert.equal(ui.canEditAssignment({...assignment,status:'CARGADO_MOODLE'}),false,'Una capacidad no concede campos ausentes');
  user.scope.fields=['*'];assert.equal(ui.canEditAssignment({...assignment,status:'CARGADO_MOODLE'}),true);
  ui.assignmentsReady=()=>false;assert.equal(ui.canEditAssignment(assignment),false,'Lectura no confirmada no habilita edición');
});

test('CO-02 dashboard real solo enumera módulos explícitamente concedidos', () => {
  const helpers=sourceFunctions('src/app/features/users/data/module-permission.service.ts',['hasAccess']);
  const user={status:'Activo',permissionSchemaVersion:2,baseRole:'CUSTOM',permissions:{asignaciones:'VIEW'},scope:{programs:['ADM'],cycles:['27-1']}};
  const dashboard=sourceMembers('src/app/features/dashboard/pages/dashboard-page.component.ts','DashboardPageComponent',['customRoleModules','hasModuleAccess'],{userSessionService:{session:()=>({appUser:user})}},helpers);
  assert.deepEqual(Array.from(dashboard.customRoleModules(),m=>m.key),['asignaciones']);
  user.permissions.asignaciones='NONE'; assert.equal(dashboard.customRoleModules().length,0);
});
