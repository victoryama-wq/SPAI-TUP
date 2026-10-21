'use strict';

// E2-R01: role labels are presentation only. These keys are server-managed.
const MODULES = ['dashboard', 'usuarios', 'ciclos', 'nomenclaturas', 'grupos', 'docentes', 'asignaturas', 'asignaciones', 'solicitudes', 'ligasMeet', 'moodle', 'bitacora'];
const BASE_ROLES = ['ADMIN_GENERAL', 'ADMIN_OPERATIVO', 'COORDINACION_ACADEMICA', 'ALTA_DOCENTES', 'CUSTOM', 'PENDING'];
const DELEGABLE = ['MANAGE_CUSTOM_ROLES', 'VALIDATE_TEACHERS', 'MANAGE_CYCLES', 'CONFIRM_MOODLE_UPDATE', 'MANAGE_MOODLE_TEMPLATES', 'RECOVER_DELETED_RECORDS', 'PURGE_CYCLE', 'OPERATE_EXCEPTIONAL_CHANGE'];
const NON_DELEGABLE = ['MANAGE_USERS', 'MANAGE_CUSTOM_ROLE_DEFINITIONS', 'MANAGE_SYSTEM_DELEGATIONS', 'RESOLVE_AUX_ROLE_REVIEWS', 'CORRECT_TEACHER_MOODLE_IDENTITY'];
const REQUEST_CAPABILITY = 'REQUEST_TEACHER_MOODLE_IDENTITY';
const RANK = { NONE: 0, VIEW: 1, EDIT: 2 };
const MAPPING_VERSION = 'E2-R01-v0.4-1';
function fail(message, code = 'permission-denied') { const error = new Error(message); error.code = code; throw error; }
function assert(condition, message, code) { if (!condition) fail(message, code); }
function list(value) { return Array.isArray(value) && value.every(v => typeof v === 'string') ? [...new Set(value)] : []; }
function levels(value = {}) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Permisos inválidos.', 'invalid-argument');
  assert(Object.keys(value).every(k => MODULES.includes(k)), 'Módulo desconocido.', 'invalid-argument');
  return Object.fromEntries(MODULES.map(key => {
    const level = String(value[key] ?? 'NONE').toUpperCase();
    assert(Object.hasOwn(RANK, level), 'Nivel inválido.', 'invalid-argument');
    return [key, level];
  }));
}
function scope(value = {}) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Ámbito inválido.', 'invalid-argument');
  return Object.fromEntries(['programs', 'cycles', 'teachers', 'fields'].map(k => {
    assert(value[k] === undefined || (Array.isArray(value[k]) && value[k].every(v => typeof v === 'string' && v.length > 0 && v.length < 160)), 'Ámbito inválido.', 'invalid-argument');
    return [k, list(value[k])];
  }));
}
function subset(values, ceiling) { return ceiling.includes('*') || values.every(v => ceiling.includes(v)); }
function isGeneral(profile) { return !profile?.deletedAt && !profile?.identityAliasOf && profile?.status === 'Activo' && profile.permissionSchemaVersion === 2 && profile.baseRole === 'ADMIN_GENERAL'; }
function legacyValid(profile, mapping, nowMillis = Date.now()) {
  const legacy = profile?.legacyAuthorization;
  return profile?.permissionSchemaVersion !== 2 && profile?.status === 'Activo' && !profile.deletedAt && !profile.identityAliasOf
    && legacy?.mappingVersion === MAPPING_VERSION && legacy.profileRevision === profile.revision
    && legacy.expiresAtMillis > nowMillis
    && mapping?.status === 'ACTIVE' && mapping.version === MAPPING_VERSION
    && mapping.revision === legacy.mappingRevision && mapping.baseRole === legacy.baseRole
    && mapping.profileRevision === profile.revision && Boolean(mapping.approvedBy);
}
function grantCurrent(grant, nowMillis = Date.now()) { return grant?.expiresAtMillis == null || (Number.isSafeInteger(grant.expiresAtMillis) && grant.expiresAtMillis > nowMillis); }
function effective(profile, delegation, { mapping, nowMillis = Date.now() } = {}) {
  const legacy = profile?.legacyAuthorization;
  if (legacyValid(profile, mapping, nowMillis)) profile = { ...profile, ...legacy, permissionSchemaVersion: 2 };
  const none = { permissions: levels(), capabilities: [], scope: scope(), baseRole: profile?.baseRole ?? 'PENDING', active: false };
  if (profile?.deletedAt || profile?.status !== 'Activo' || profile.permissionSchemaVersion !== 2 || profile.identityAliasOf) return none;
  if (isGeneral(profile)) return { permissions: levels(Object.fromEntries(MODULES.map(k => [k, 'EDIT']))), capabilities: [...DELEGABLE, ...NON_DELEGABLE, REQUEST_CAPABILITY], scope: scope({ programs: ['*'], cycles: ['*'], teachers: ['*'], fields: ['*'] }), baseRole: profile.baseRole, active: true };
  if (profile.baseRole === 'ADMIN_OPERATIVO') {
    if (!delegation || !grantCurrent(delegation, nowMillis) || delegation.status !== 'ACTIVE' || delegation.userId !== profile.authUid || delegation.id !== profile.delegationId) return { ...none, revoked: true };
    return { permissions: levels(delegation.permissions), capabilities: list(delegation.capabilities), scope: scope(delegation.scope), baseRole: profile.baseRole, active: true };
  }
  return { permissions: levels(profile.permissions), capabilities: list(profile.capabilities).filter(c => c === REQUEST_CAPABILITY), scope: scope(profile.scope), baseRole: profile.baseRole, active: true };
}
function requireCapability(actor, capability) {
  assert(actor.active && actor.capabilities.includes(capability), actor.revoked ? 'PERMISO_REVOCADO' : 'Permiso insuficiente.');
}
function customDefinition(input) {
  assert(input && typeof input === 'object' && (input.capabilities === undefined || (Array.isArray(input.capabilities) && input.capabilities.every(c => typeof c === 'string'))), 'Capacidades inválidas.', 'invalid-argument');
  const permissions = levels(input.permissions);
  for (const key of ['usuarios', 'ciclos', 'moodle', 'bitacora']) assert(permissions[key] === 'NONE', 'El módulo es administrativo.');
  for (const key of ['nomenclaturas', 'grupos', 'asignaturas', 'ligasMeet']) assert(permissions[key] !== 'EDIT', 'Este catálogo solo admite consulta personalizada.');
  const capabilities = list(input.capabilities);
  assert(capabilities.every(c => c === REQUEST_CAPABILITY), 'Capacidad no delegable a un rol personalizado.');
  return { name: String(input.name ?? '').trim(), permissions, capabilities, scope: scope(input.scope), status: 'ACTIVE' };
}
function canAssign(actor, actorId, targetId, target, role) {
  requireCapability(actor, 'MANAGE_CUSTOM_ROLES');
  customDefinition(role);
  assert(!target.identityAliasOf, 'Selecciona la identidad vigente.');
  assert(target.permissionSchemaVersion === 2 && BASE_ROLES.includes(target.baseRole), 'El destinatario requiere resolver primero su perfil heredado.', 'failed-precondition');
  assert(!['ADMIN_GENERAL', 'ADMIN_OPERATIVO'].includes(target.baseRole), 'No se asignan roles personalizados a perfiles administrativos.');
  assert(actorId !== targetId, 'No se permite autoasignación.');
  if (actor.baseRole === 'ADMIN_GENERAL') return;
  assert(list(target.assignedPrograms).length > 0, 'El destinatario no tiene ámbito institucional confirmado.');
  assert(Object.entries(role.permissions).every(([k, v]) => RANK[v] <= RANK[actor.permissions[k]]), 'El rol supera los módulos delegados.');
  assert(role.capabilities.every(c => actor.capabilities.includes(c)), 'El rol supera las capacidades delegadas.');
  for (const k of ['programs', 'cycles', 'teachers', 'fields']) assert(subset(role.scope[k], actor.scope[k]), 'El rol supera el ámbito delegado.');
  assert(subset(list(target.assignedPrograms), actor.scope.programs), 'Usuario fuera del ámbito delegado.');
}

// Recognized *verified keys*, never role display text. Unknown/absent is unresolved.
const LEGACY_MAPPING = {
  COORDINACION_ACADEMICA: { dashboard: 'VIEW', nomenclaturas: 'VIEW', grupos: 'VIEW', docentes: 'EDIT', asignaturas: 'VIEW', asignaciones: 'EDIT', solicitudes: 'EDIT', ligasMeet: 'VIEW' },
  ALTA_DOCENTES: { dashboard: 'VIEW', docentes: 'EDIT' },
};
function legacyProposal(profile, verifiedMapping) {
  const recognized = verifiedMapping?.status === 'ACTIVE' && verifiedMapping?.version === MAPPING_VERSION && verifiedMapping?.approvedBy && LEGACY_MAPPING[verifiedMapping.baseRole];
  const proposed = levels(); const unresolved = [];
  for (const module of MODULES) {
    const explicit = profile.permissions?.[module];
    if (typeof explicit === 'string' && Object.hasOwn(RANK, explicit.toUpperCase())) proposed[module] = explicit.toUpperCase();
    else if (profile.access?.[module] === false) proposed[module] = 'NONE';
    else if (recognized && profile.access?.[module] === true && recognized[module]) proposed[module] = recognized[module];
    else unresolved.push(module);
  }
  const explicitDenials = MODULES.filter(key => String(profile.permissions?.[key]).toUpperCase() === 'NONE' || (profile.permissions?.[key] === undefined && profile.access?.[key] === false));
  return { mappingVersion: MAPPING_VERSION, baseRole: recognized ? verifiedMapping.baseRole : 'CUSTOM', permissions: proposed, explicitDenials, capabilities: [], scope: scope(profile.scope ?? { programs: list(profile.assignedPrograms) }), unresolved, status: unresolved.length ? 'LEGACY_UNRESOLVED' : 'READY' };
}
module.exports = { grantCurrent, MODULES, BASE_ROLES, DELEGABLE, NON_DELEGABLE, REQUEST_CAPABILITY, MAPPING_VERSION, RANK, fail, assert, list, levels, scope, subset, isGeneral, legacyValid, effective, requireCapability, customDefinition, canAssign, legacyProposal };
