import { accounts } from './config.mjs';

export const fixtureTime = '2026-09-01T15:00:00.000Z';
const dates = { createdAt: fixtureTime, updatedAt: fixtureTime };
const modules = ['dashboard', 'usuarios', 'ciclos', 'nomenclaturas', 'grupos', 'docentes', 'asignaturas', 'asignaciones', 'solicitudes', 'ligasMeet', 'moodle', 'bitacora'];
const academicModules = ['dashboard', 'nomenclaturas', 'grupos', 'docentes', 'asignaturas', 'asignaciones', 'solicitudes'];
const actor = { createdBy: 'demo-sistemas', createdByName: 'Sistemas DEMO', createdByRole: 'Coordinación de Sistemas' };

/** Synthetic fixtures using existing contracts, never exported from a live database. */
export function fixtures() {
  const docs = [];
  const add = (path, data) => docs.push({ path, data: { ...dates, ...data } });
  for (const account of accounts) {
    const enabled = account.role.includes('Sistemas') ? modules : academicModules;
    add(`usuarios/${account.uid}`, {
      permissionSchemaVersion: 2, revision: 1, area: account.uid === 'demo-sistemas' || account.uid === 'demo-auxiliar' ? 'Sistemas DEMO' : 'Académica DEMO',
      baseRole: account.uid === 'demo-sistemas' ? 'ADMIN_GENERAL' : account.uid === 'demo-auxiliar' ? 'ADMIN_OPERATIVO' : 'COORDINACION_ACADEMICA',
      permissions: Object.fromEntries(modules.map(k => [k, enabled.includes(k) ? (['docentes','asignaciones','solicitudes'].includes(k) ? 'EDIT' : 'VIEW') : 'NONE'])),
      scope: { programs: account.programs, cycles: ['*'], teachers: [], fields: [] },
      authUid: account.uid, name: account.name, email: account.email, role: account.role,
      greetingGender: 'Femenino', assignedPrograms: account.programs,
      access: Object.fromEntries(modules.map((key) => [key, enabled.includes(key)])),
      status: account.uid === 'demo-inactivo' ? 'Inactivo' : 'Activo',
    });
  }
  // Base roles remain the current role strings in usuarios, not invented role IDs.
  add('roles_personalizados/demo-consulta', {
    name: 'Consulta DEMO', description: 'Plantilla ficticia de consulta', status: 'ACTIVE', revision: 1,
    approvedBy: 'demo-sistemas', capabilities: [], scope: {programs:['ADM'],cycles:['27-1'],teachers:[],fields:[]},
    permissions: Object.fromEntries(modules.map((key) => [key, key === 'dashboard' ? 'VIEW' : 'NONE'])),
  });
  for (const [code, status] of [['27-2', 'Preparacion'], ['27-1', 'Captura'], ['26-3', 'Captura cerrada'], ['26-2', 'Cerrado']]) {
    add(`ciclos/demo-${code}`, {
      code, label: `Ciclo DEMO ${code}`, status, notes: 'Ficticio para pruebas locales',
      createdAt: code === '27-1' ? '2026-09-02T15:00:00.000Z' : fixtureTime,
      captureStartedAt: status === 'Preparacion' ? null : fixtureTime,
      tentativeCaptureCloseAt: '2026-09-30', captureClosedAt: status.includes('cerrada') ? fixtureTime : null,
      closedAt: status === 'Cerrado' ? fixtureTime : null,
    });
  }
  for (const [program, coordinator] of [['ADM', accounts[2]], ['DER', accounts[3]]]) {
    add(`programas/${program}`, { code: program, name: `Programa ${program} DEMO`, academicArea: 'Campus TUP', programType: 'Licenciatura', modality: 'Escolarizado', coordinator: coordinator.uid, status: 'Activo' });
    add(`nomenclaturas_programas/demo-${program}`, { abbreviation: program, programCode: program, programName: `Programa ${program} DEMO`, planName: 'Plan DEMO', planCode: '2027', status: 'ACTIVA', usageCount: 0, notes: 'Campus TUP - datos ficticios' });
    for (const cycle of ['27-1', '26-3', '26-2']) {
      const fullGroup = `${cycle} ${program} 11 01`;
      add(`grupos/${fullGroup.replace(/[^A-Z0-9]+/g, '_')}`, { fullGroup, cycleCode: cycle, programAbbreviation: program, groupCode: '11', section: '01', programName: `Programa ${program} DEMO`, modality: 'Escolarizado', shift: 'Matutino', academicArea: 'Campus TUP', status: 'Activo' });
    }
    add(`moodle_categorias/demo-${program}`, { ...actor, categoryNumber: program === 'ADM' ? '9001' : '9002', programCode: program, programName: `Programa ${program} DEMO`, status: 'Activo' });
    add(`moodle_plantillas/demo-${program}`, { ...actor, internalId: `demo-${program}`, templateCourse: `demo-template-${program.toLowerCase()}`, name: `PLANTILLA ${program} DEMO`, modality: 'ESCOLARIZADO', programCode: program, status: 'Activo' });
  }
  for (const [index, status] of ['VALIDADO', 'PENDIENTE', 'INACTIVO'].entries()) {
    const coordinator = accounts[index % 2 + 2];
    const username = `demo-docente-${index + 1}`;
    add(`docentes/${username}`, {
      ...actor, teacherCode: `DEMO-${index + 1}`, fullName: `DOCENTE FICTICIO ${index + 1}`, normalizedName: `docente ficticio ${index + 1}`,
      moodleUser: username, normalizedMoodleUser: username, status, lifecycleStatus: status === 'PENDIENTE' ? 'NUEVO' : 'VIGENTE',
      origin: 'MANUAL', email: `${username}@example.invalid`, notes: 'No es una persona real',
      createdByPrograms: coordinator.programs, assignedCoordinatorIds: [coordinator.uid], assignedCoordinatorNames: [coordinator.name],
      validatedBy: status === 'VALIDADO' ? actor.createdBy : '', validatedAt: status === 'VALIDADO' ? fixtureTime : '', inactivatedBy: '', inactivatedAt: '', importId: '',
    });
  }
  for (const [id, name] of [['DEMO101', 'INTRODUCCION DEMO'], ['DEMO102', 'METODOS DEMO']]) {
    add(`asignaturas/${id}`, { ...actor, subjectId: id, name, normalizedName: name.toLowerCase(), status: 'Activo', origin: 'MANUAL' });
  }
  for (const [id, program, cycle, status] of [['demo-asignacion-a', 'ADM', '27-1', 'EN_CAPTURA'], ['demo-asignacion-b', 'DER', '27-1', 'CARGADO_MOODLE'], ['demo-asignacion-cerrada', 'ADM', '26-3', 'EN_REVISION'], ['demo-asignacion-historica', 'DER', '26-2', 'VALIDADO']]) {
    const coordinator = program === 'ADM' ? accounts[2] : accounts[3];
    add(`asignaciones/${id}`, {
      cycle, program, group: `${cycle} ${program} 11 01`, subjectId: 'DEMO101', subjectName: 'INTRODUCCION DEMO', moodleId: id, normalizedMoodleId: id,
      teacherMoodleUser: 'demo-docente-1', teacherName: 'DOCENTE FICTICIO 1', status, observations: 'Ficticia', assignmentType: 'REGULAR',
      shared: false, sourceAssignmentId: '', sharedGroups: [], sharedPrograms: [], special: false, studentEnrollments: 'demo-estudiante-001',
      createdBy: coordinator.uid, createdByName: coordinator.name, createdByRole: coordinator.role, createdByPrograms: coordinator.programs,
      updatedBy: coordinator.uid, updatedByName: coordinator.name, updatedByRole: coordinator.role,
      deletedAt: null, deletedBy: '', deletedByName: '', deletedByRole: '',
    });
  }
  for (const [index, status] of ['PENDIENTE', 'RECHAZADA'].entries()) {
    add(`solicitudes_compartidas/demo-compartida-${index}`, {
      requestType: 'COMPARTIR_CLASE', cycle: '27-1', sourceAssignmentId: 'demo-asignacion-a', destinationAssignmentId: '',
      sourceCoordination: accounts[2].name, destinationCoordination: accounts[3].name, sourceProgram: 'ADM', destinationProgram: 'DER',
      sourceGroup: '27-1 ADM 11 01', destinationGroup: '27-1 DER 11 01', subjectId: 'DEMO101', subjectName: 'INTRODUCCION DEMO',
      moodleId: 'demo-asignacion-a', teacherMoodleUser: 'demo-docente-1', teacherName: 'DOCENTE FICTICIO 1', status,
      requestMessage: 'Solicitud ficticia de compartir clase', responseObservations: status === 'RECHAZADA' ? 'Respuesta ficticia' : '',
      requestedBy: accounts[3].uid, requestedByName: accounts[3].name, requestedByRole: accounts[3].role, requestedAt: fixtureTime,
      respondedBy: '', respondedByName: '', respondedByRole: '', respondedAt: '',
    });
  }
  add('solicitudes_sistemas/demo-reapertura', { type: 'REABRIR_CAPTURA', title: 'Reapertura DEMO', detail: 'Prueba ficticia; no aplicar a datos reales', cycle: '26-3', requestedBy: accounts[2].uid, requestedByName: accounts[2].name, requestedByRole: accounts[2].role, requestedByPrograms: ['ADM'], status: 'PENDIENTE', systemResponse: '' });
  add('notificaciones/demo-aviso', { title: 'Aviso ficticio', message: 'El correo de esta notificacion debe simularse.', target: 'SISTEMAS', type: 'SOLICITUD_SISTEMAS', entity: 'solicitudes_sistemas', entityId: 'demo-reapertura', actorId: accounts[2].uid, actorName: accounts[2].name, actorRole: accounts[2].role, readBy: [] });
  add('configuracion/docentes', { lastMoodleTeacherNumber: 1000 });
  add('configuracion/notificaciones_asignaciones', { enabled: false, updatedBy: actor.createdBy, updatedByName: actor.createdByName });
  return docs;
}
