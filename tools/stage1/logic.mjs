import assert from 'node:assert/strict';
import { sourceMembers, deferred } from './source-harness.mjs';
import { reporter } from './report.mjs';

const report = reporter('stage1-logic');
const requestFile = 'src/app/features/requests/pages/requests-page.component.ts';
const repoFile = 'src/app/features/requests/data/shared-requests.repository.ts';
const cycleFile = 'src/app/features/cycles/data/cycles.repository.ts';
const actor = { userId: 'test-a', userName: 'Persona ficticia', userRole: 'Coordinación Académica' };
const request = { id: 'request-a', requestType: 'COMPARTIR_CLASE', status: 'PENDIENTE', cycle: '27-1', sourceAssignmentId: 'source', sourceProgram: 'ADM', destinationProgram: 'DER', destinationGroup: '27-1 DER 11 01', subjectId: 'TEST', requestedBy: 'test-b' };
const source = { id: 'source', cycle: '27-1', program: 'ADM', group: '27-1 ADM 11 01', subjectId: 'TEST', subjectName: 'PRUEBA', moodleId: 'test', teacherMoodleUser: 'ficticio', teacherName: 'FICTICIO', status: 'CARGADO_MOODLE', sharedGroups: [], sharedPrograms: [], observations: '', studentEnrollments: '' };
const evidence = (path, member) => `${path}#${member}`;

const permission = sourceMembers('src/app/features/users/data/module-permission.service.ts', 'ModulePermissionService', ['hasModuleAccess', 'canEditModule', 'customPermissionFor', 'customRoleFor', 'normalizeIdentity'], { customRolesRepository: { roleTemplates: () => [{ name: 'Consulta Sistemas', permissions: { docentes: 'view' } }] } });
const aux = { id: 'aux-off', role: 'Auxiliar de Sistemas', status: 'Activo', access: { docentes: false } };
const view = { ...aux, role: 'Consulta Sistemas', access: { docentes: true } };
for (const [id, user, baseline, expected] of [['UI-AUX-OFF', aux, true, false], ['UI-CUSTOM-VIEW', view, false, false]]) {
  const page = sourceMembers('src/app/features/teachers/pages/teachers-page.component.ts', 'TeachersPageComponent', ['canManageTeachers'], { session: () => ({ appUser: user }), modulePermissionService: permission });
  report.check(id, 'F01', 2, page.canManageTeachers(), baseline, expected, 'TeachersPageComponent.canManageTeachers + ModulePermissionService');
}
const requestUi = (program) => sourceMembers(requestFile, 'RequestsPageComponent', ['canAccessRequest', 'canRespondRequest', 'canCancelRequest'], {
  session: () => ({ appUser: { id: `test-${program}` } }), requestTypeFor: (r) => r.requestType,
  canSeeAllRequests: () => false, canUseRequests: () => true, userHasProgram: (p) => p === program,
});
for (const [program, read, respond] of [['ADM', true, true], ['DER', true, false], ['OTRO', false, false]]) {
  const ui = requestUi(program);
  report.check(`UI-REQUEST-${program}`, 'F03', 2, [ui.canAccessRequest(request), ui.canRespondRequest(request)], [read, respond], [read, respond], evidence(requestFile, 'canAccessRequest/canRespondRequest'));
}
const teacherUi = sourceMembers('src/app/features/teachers/pages/teachers-page.component.ts', 'TeachersPageComponent', ['canDeleteOwnPendingNewTeacher'], { session: () => ({ authUid: 'test-a', appUser: { id: 'test-a', status: 'Activo', access: { docentes: true } } }), modulePermissionService: permission });
report.check('UI-TEACHER-OWNERSHIP', 'F02', 2, ['test-a', 'test-b'].map((createdBy) => teacherUi.canDeleteOwnPendingNewTeacher({ status: 'PENDIENTE', origin: 'MANUAL', lifecycleStatus: 'NUEVO', createdBy })), [true, false], [true, false], 'TeachersPageComponent.canDeleteOwnPendingNewTeacher');

let cycles = [{ id: 'a', code: '27-1', status: 'Captura cerrada' }, { id: 'b', code: '27-2', status: 'Preparacion' }];
const cr = sourceMembers(cycleFile, 'CyclesRepository', ['activeCycle', 'startCapture'], { cycles: () => cycles, updateDocument: async (id, patch) => Object.assign(cycles.find((c) => c.id === id), patch) });
report.check('CYCLE-CLOSED-CAPTURE-ACTIVE', 'F05', 3, cr.activeCycle().id, 'a', 'a', evidence(cycleFile, 'activeCycle'));
await cr.startCapture('b');
report.check('CYCLE-MULTIPLE-OPERATIVE', 'F05', 3, cycles.filter((c) => ['Captura', 'Captura cerrada'].includes(c.status)).length, 2, 1, evidence(cycleFile, 'startCapture'));
cycles.reverse();
report.check('CYCLE-SELECTION-ORDER', 'F05', 3, cr.activeCycle().id, 'b', 'ERROR_AMBIGUOUS_CYCLE', 'activeCycle chooses first; contract requires detecting ambiguity without selecting an arbitrary cycle');

const gate = sourceMembers('src/app/features/assignments/pages/assignments-page.component.ts', 'AssignmentsPageComponent', ['canCaptureAssignments'], { activeCycle: () => ({ status: 'Captura cerrada' }) });
report.check('UI-CAPTURE-CLOSED', 'F04', 3, gate.canCaptureAssignments(), false, false, 'AssignmentsPageComponent.canCaptureAssignments');

const write = deferred();
const rr = sourceMembers(repoFile, 'SharedRequestsRepository', ['createRequest', 'createRequestId', 'normalizeName', 'acceptRequest', 'resolveRequest'], { setDocument: () => write.promise, updateDocument: () => write.promise });
const createResult = rr.createRequest({ ...request, actor });
report.check('REQUEST-CREATE-AWAITS', 'F06', 3, typeof createResult.then === 'function', false, true, evidence(repoFile, 'createRequest'));
const resolveResult = rr.acceptRequest(request.id, 'source', '', actor);
report.check('REQUEST-RESOLVE-AWAITS', 'F06', 3, Boolean(resolveResult?.then), false, true, evidence(repoFile, 'resolveRequest'));
write.reject(Object.assign(new Error('denied'), { code: 'permission-denied' }));
assert.equal(await write.outcome, 'permission-denied');

let instant = 1800000000000;
const createdIds = new Set();
const duplicateRepo = sourceMembers(repoFile, 'SharedRequestsRepository', ['createRequest', 'createRequestId', 'normalizeName'], {
  setDocument: async (id) => { createdIds.add(id); },
}, { Date: class extends Date { static now() { return instant++; } } });
duplicateRepo.createRequest({ ...request, actor });
duplicateRepo.createRequest({ ...request, actor });
report.check('REQUEST-DUPLICATE-CREATE', 'F07', 3, createdIds.size, 2, 1, 'Same request intent at two controlled milliseconds creates distinct documents');

const pendingCreate = deferred();
const uiRepo = sourceMembers(repoFile, 'SharedRequestsRepository', ['createRequest', 'createRequestId', 'normalizeName'], { setDocument: () => pendingCreate.promise });
const createUi = sourceMembers(requestFile, 'RequestsPageComponent', ['createOperationalRequest'], {
  sharedRequestsRepository: uiRepo, requestActorData: () => actor, requestForm: () => ({ requestType: 'ALTA_GRUPO', program: 'ADM', cycle: '27-1', specialStudentEnrollments: '' }), selectedSpecialSubject: () => null, selectedSpecialTeacher: () => null, programName: () => 'Programa ficticio', normalizedStudentEnrollments: () => '', requestTypeLabel: () => 'Alta', auditLogRepository: { register() {} }, closeRequestModal() { this.closed = true; }, closed: false,
});
createUi.createOperationalRequest();
report.check('UI-PREMATURE-SUCCESS', 'F06', 3, createUi.closed && createUi.formMessage.includes('correctamente'), true, false, evidence(requestFile, 'createOperationalRequest'));
pendingCreate.reject(Object.assign(new Error('offline'), { code: 'unavailable' }));
assert.equal(await pendingCreate.outcome, 'unavailable');

const context = (upsert, resolve) => ({ requestTypeFor: (r) => r.requestType, requestActorData: () => actor, sourceAssignmentFor: () => structuredClone(source), groups: () => [{ fullGroup: request.destinationGroup }], assignmentActorData: () => ({}), assignmentsRepository: { upsertAssignment: upsert }, sharedRequestsRepository: { acceptRequest: resolve }, auditLogRepository: { register() {} }, responseObservations: '', closeResponseModal() { this.closed = true; }, closed: false });
let saved;
const saveResponse = deferred();
const noWaitRepo = sourceMembers(repoFile, 'SharedRequestsRepository', ['acceptRequest', 'resolveRequest'], { updateDocument: () => saveResponse.promise });
const ui = sourceMembers(requestFile, 'RequestsPageComponent', ['acceptRequest'], context(async (p) => { saved = p; return p.id; }, (...args) => noWaitRepo.acceptRequest(...args)));
await ui.acceptRequest(request);
report.check('SHARE-PRESERVES-MOODLE', 'F08', 3, saved.status, 'EN_CAPTURA', 'CARGADO_MOODLE', evidence(requestFile, 'acceptRequest'));
saveResponse.reject(Object.assign(new Error('denied'), { code: 'permission-denied' }));
await saveResponse.outcome;
report.check('SHARE-PARTIAL-AND-SUCCESS', 'F07', 3, { assignmentWritten: Boolean(saved), modalClosed: ui.closed }, { assignmentWritten: true, modalClosed: true }, { assignmentWritten: false, modalClosed: false }, 'Source assignment committed then request resolution fails; actual repository discards rejection');

let writes = 0, resolutions = 0;
const repeatUi = sourceMembers(requestFile, 'RequestsPageComponent', ['acceptRequest'], context(async () => { writes++; return 'source'; }, () => { resolutions++; }));
await Promise.all([repeatUi.acceptRequest(request), repeatUi.acceptRequest(request)]);
report.check('REQUEST-DOUBLE-ACCEPT', 'F07', 3, [writes, resolutions], [2, 2], [1, 1], 'Two concurrent acceptRequest calls with same pending request');
let stored = {};
const gateA = deferred(), gateB = deferred();
const concurrent = sourceMembers(requestFile, 'RequestsPageComponent', ['acceptRequest'], context(async (p) => { await (p.sharedGroups.includes('GROUP-B') ? gateB.promise : gateA.promise); stored = p; return p.id; }, () => {}));
const a = concurrent.acceptRequest(request);
concurrent.groups = () => [{ fullGroup: 'GROUP-B' }];
const b = concurrent.acceptRequest({ ...request, id: 'request-b', destinationGroup: 'GROUP-B', destinationProgram: 'OTRO' });
gateA.resolve(); await a; gateB.resolve(); await b;
report.check('SHARE-CONCURRENT-LOST-GROUP', 'F07', 3, stored.sharedGroups.length, 1, 2, 'Two accepted requests read same source; last write loses first group');

const rejected = deferred();
const failUi = sourceMembers(requestFile, 'RequestsPageComponent', ['acceptRequest'], context(() => rejected.promise, () => { throw new Error('Must not resolve request'); }));
const failedSave = failUi.acceptRequest(request);
rejected.reject(Object.assign(new Error('denied'), { code: 'permission-denied' }));
await assert.rejects(failedSave, (e) => e.code === 'permission-denied');
report.check('SHARE-FIRST-WRITE-FAILS', 'F06', 3, failUi.closed, false, false, 'First write rejects: acceptRequest does not close modal (caller saveResponse still discards promise)');

const cycleSave = deferred();
const cycleUi = sourceMembers('src/app/features/cycles/pages/cycles-page.component.ts', 'CyclesPageComponent', ['saveCycle'], { form: { invalid: false, getRawValue: () => ({ code: '27-1' }) }, cyclesRepository: { hasCycleCode: () => false, createCycle: () => cycleSave.promise }, closeForm() { this.closed = true; }, getSaveErrorMessage: (e) => e.code, closed: false }, { console: { error() {} } });
const saving = cycleUi.saveCycle();
assert.equal(cycleUi.isSaving, true);
cycleSave.reject(Object.assign(new Error('denied'), { code: 'permission-denied' })); await saving;
report.check('UI-CYCLE-SAVE-ERROR', 'F06', 3, [cycleUi.closed, cycleUi.formError, cycleUi.isSaving], [false, 'permission-denied', false], [false, 'permission-denied', false], 'CyclesPageComponent.saveCycle catches rejection and keeps form open');
report.finish();
