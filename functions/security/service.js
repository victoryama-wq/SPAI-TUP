'use strict';
const { createHash } = require('node:crypto');
const P = require('./policy');
const Inheritance = require('./inheritance');
const COLLECTIONS = ['usuarios', 'roles_personalizados', 'delegaciones', 'asignaciones_roles', 'revisiones_roles', 'mapeos_permisos'];
const stable = value => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const hash = value => createHash('sha256').update(stable(value)).digest('hex');
const revision = doc => doc?.revision ?? 0;
const id = value => { P.assert(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value), 'Identificador inválido.', 'invalid-argument'); return value; };
const requireRevision = (doc, expected, message = 'La revisión cambió. Actualiza antes de confirmar.') => P.assert(revision(doc) === expected, message, 'aborted');

function createSecurityService(db, { nowMillis = Date.now } = {}) {
  async function execute(auth, data) {
    P.assert(auth?.uid, 'Inicia sesión.', 'unauthenticated');
    P.assert(data && typeof data === 'object' && typeof data.action === 'string', 'Operación inválida.', 'invalid-argument');
    const operationId = id(data.operationId);
    const opRef = db.doc(`operaciones_seguridad/${auth.uid}_${operationId}`);
    return db.runTransaction(async tx => {
      // Every administrative writer competes on this fence. Reads remain bounded;
      // exceeding the local rollout bound is a visible error, never a partial migration.
      const lockRef = db.doc('seguridad/control');
      const lock = await tx.get(lockRef);
      const snapshots = await Promise.all(COLLECTIONS.map(c => tx.get(db.collection(c).limit(201))));
      P.assert(snapshots.reduce((n, s) => n + s.size, 0) <= 200, 'Requiere migración administrativa por lotes: límite local de 200 documentos de seguridad.', 'resource-exhausted');
      const state = Object.fromEntries(COLLECTIONS.map((c, i) => [c, Object.fromEntries(snapshots[i].docs.map(d => [d.id, { ...d.data(), id: d.id }]))]));
      const beforeState = structuredClone(state);
      const profile = state.usuarios[auth.uid];
      const actor = P.effective(profile, state.delegaciones[profile?.delegationId], { mapping: state.mapeos_permisos[auth.uid], nowMillis: nowMillis() });
      P.assert(actor.active, actor.revoked ? 'PERMISO_REVOCADO' : 'Perfil no autorizado.');
      const required = {
        saveUser: 'MANAGE_USERS', deleteUser: 'MANAGE_USERS', saveRole: 'MANAGE_CUSTOM_ROLE_DEFINITIONS', deleteRole: 'MANAGE_CUSTOM_ROLE_DEFINITIONS',
        grantDelegation: 'MANAGE_SYSTEM_DELEGATIONS', revokeDelegation: 'MANAGE_SYSTEM_DELEGATIONS', suspendDelegation: 'MANAGE_SYSTEM_DELEGATIONS',
        assignRole: 'MANAGE_CUSTOM_ROLES', removeRole: 'MANAGE_CUSTOM_ROLES', resolveReview: 'RESOLVE_AUX_ROLE_REVIEWS',
        previewInheritance: 'MANAGE_USERS', applyInheritance: 'MANAGE_USERS', approveMapping: 'MANAGE_USERS', previewMigration: 'MANAGE_USERS', applyMigration: 'MANAGE_USERS',
      }[data.action];
      P.assert(required, 'Operación desconocida.', 'invalid-argument');
      P.requireCapability(actor, required);
      const previous = await tx.get(opRef);
      if (previous.exists) {
        P.assert(previous.data().requestHash === hash(data), 'Identificador de reintento reutilizado con datos distintos.', 'already-exists');
        return previous.data().result;
      }
      const reason = data.action === 'previewInheritance' ? 'Consultar vista previa de herencia' : String(data.reason ?? '').trim();
      P.assert(reason.length >= 4 && reason.length <= 1000, 'Indica un motivo (4–1000 caracteres).', 'invalid-argument');
      const serverMillis = nowMillis();
      const now = new Date(serverMillis).toISOString();
      const targetId = id(data.targetId);
      const target = state.usuarios[targetId];
      if (['saveUser','assignRole','grantDelegation','approveMapping','previewMigration','applyMigration','previewInheritance','applyInheritance'].includes(data.action)) P.assert(!target?.deletedAt, 'El perfil fue dado de baja; requiere reincorporación administrativa explícita.', 'failed-precondition');
      const write = (collection, key, value) => { state[collection][key] = { ...value, id: key, revision: revision(state[collection][key]) + 1, updatedAt: now }; };
      const fresh = collection => P.assert(!state[collection][operationId], 'El identificador ya pertenece a una operación anterior.', 'already-exists');
      function compatibleScope(user, role, excluding) {
        const contributions = [{ permissions: user.basePermissions ?? user.permissions, scope: user.baseScope ?? user.scope }, ...Object.values(state.asignaciones_roles).filter(a => a.userId === user.id && a.status === 'ACTIVE' && a.id !== excluding)];
        P.assert(contributions.every(c => !Object.values(c.permissions ?? {}).some(level => level !== 'NONE') || hash(P.scope(c.scope)) === hash(role.scope)), 'Combinar niveles con ámbitos distintos requiere una definición consolidada revisada por Administración.', 'failed-precondition');
      }
      const result = { operationId, targetId, action: data.action };
      let previewRef; let preview;
      if (data.action === 'applyMigration') {
        previewRef = db.doc(`previews_permisos/${id(data.previewId)}`);
        preview = (await tx.get(previewRef)).data();
      }
      if (data.action === 'applyInheritance') {
        previewRef = db.doc('previews_herencia/' + id(data.previewId));
        preview = (await tx.get(previewRef)).data();
      }
      function recompute(userId) {
        const user = state.usuarios[userId];
        if (user.baseRole === 'ADMIN_OPERATIVO') {
          const grant = state.delegaciones[user.delegationId];
          const live = grant?.status === 'ACTIVE' && grant.userId === userId && P.grantCurrent(grant, serverMillis);
          const permissions = live ? grant.permissions : P.levels();
          write('usuarios', userId, { ...user, permissions, capabilities: live ? grant.capabilities : [], scope: live ? grant.scope : P.scope(), access: Object.fromEntries(P.MODULES.map(k => [k, permissions[k] !== 'NONE'])) });
          return;
        }
        const permissions = P.levels(user.basePermissions ?? user.permissions);
        const capabilities = P.list(user.baseCapabilities);
        const scope = Object.values(permissions).some(level => level !== 'NONE') || capabilities.length ? P.scope(user.baseScope ?? user.scope) : P.scope();
        for (const assignment of Object.values(state.asignaciones_roles).filter(a => a.userId === userId && a.status === 'ACTIVE')) {
          for (const k of P.MODULES) if (P.RANK[assignment.permissions[k]] > P.RANK[permissions[k]]) permissions[k] = assignment.permissions[k];
          capabilities.push(...assignment.capabilities);
          for (const k of Object.keys(scope)) scope[k] = [...new Set([...scope[k], ...assignment.scope[k]])];
        }
        for (const key of user.migrationDenials ?? []) permissions[key] = 'NONE';
        write('usuarios', userId, { ...user, permissions, capabilities: [...new Set(capabilities)], scope, access: Object.fromEntries(P.MODULES.map(k => [k, permissions[k] !== 'NONE'])) });
      }
      switch (data.action) {
        case 'previewInheritance': {
          const plan = Inheritance.plan(state, auth.uid, id(data.sourceId), targetId, data.replace, serverMillis);
          result.inheritancePreview = {...plan.review, previewId:operationId, generatedAt:now,
            expiresAtMillis:Math.min(serverMillis + 5 * 60000, plan.review.proposed.expiresAtMillis ?? Infinity)};
          tx.create(db.doc('previews_herencia/' + operationId), {...result.inheritancePreview, operatorId:auth.uid, fingerprint:plan.fingerprint});
          break;
        }
        case 'applyInheritance': {
          // Re-read time after the awaited preview read: I/O may cross its deadline.
          const confirmationMillis = nowMillis();
          P.assert(preview && preview.operatorId===auth.uid && preview.targetId===targetId && !preview.appliedAt && preview.expiresAtMillis>confirmationMillis, 'HERENCIA_PREVIEW_OBSOLETA: genera una nueva vista previa.', 'aborted');
          const plan = Inheritance.plan(state, auth.uid, preview.sourceId, targetId, preview.replace, confirmationMillis);
          P.assert(plan.fingerprint===preview.fingerprint, 'HERENCIA_PREVIEW_OBSOLETA: cambió una condición relevante.', 'aborted');
          Object.assign(result, Inheritance.apply(state, plan, auth.uid, operationId, now, write));
          P.assert(COLLECTIONS.reduce((n,c)=>n+Object.keys(state[c]).length,0)<=200, 'La herencia excedería el límite administrativo de 200 documentos.', 'resource-exhausted');
          result.reviewIds = Object.values(state.revisiones_roles).filter(r=>hash(r)!==hash(beforeState.revisiones_roles[r.id]??null)).map(r=>r.id);
          tx.update(previewRef,{appliedAt:now,appliedBy:auth.uid});
          break;
        }
        case 'saveUser': {
          P.assert(!target?.deletedAt, 'El perfil fue dado de baja; la reincorporación requiere un procedimiento administrativo explícito.', 'failed-precondition');
          const requestedEmail = String(data.value?.email ?? '').trim().toLowerCase();
          if (/^[a-z0-9._+-]+@tecplayacar\.edu\.mx$/.test(requestedEmail)) { const blocked = await tx.get(db.doc('bajas_correo/' + requestedEmail)); P.assert(!blocked.exists, 'El correo fue dado de baja; no se puede aprovisionar automáticamente.', 'failed-precondition'); }
          requireRevision(target, data.expectedRevision);
          const input = data.value;
          P.assert(input && P.BASE_ROLES.includes(input.baseRole) && ['Activo', 'Inactivo'].includes(input.status), 'Perfil inválido.', 'invalid-argument');
          P.assert(typeof input.email === 'string' && /^[a-z0-9._+-]+@tecplayacar\.edu\.mx$/.test(input.email), 'Correo institucional inválido.', 'invalid-argument');
          P.assert(typeof input.name === 'string' && input.name.trim().length >= 2, 'Nombre obligatorio.', 'invalid-argument');
          P.assert(!target?.identityAliasOf, 'Edita el perfil vinculado, no su referencia histórica.', 'failed-precondition');
          P.assert(target?.baseRole !== 'ADMIN_OPERATIVO' || input.baseRole === 'ADMIN_OPERATIVO' || !Object.values(state.delegaciones).some(d => d.userId === targetId && d.status === 'ACTIVE'), 'Revoca la delegación antes de cambiar el rol base del auxiliar.', 'failed-precondition');
          P.assert(!Object.values(state.usuarios).some(u => u.id !== targetId && !u.identityAliasOf && u.email === input.email), 'El correo ya tiene perfil.', 'already-exists');
          P.assert(!target?.authUid || target.email === input.email, 'La identidad vinculada no se cambia desde permisos.');
          let permissions = input.baseRole === 'ADMIN_GENERAL' ? P.levels(Object.fromEntries(P.MODULES.map(k => [k, 'EDIT']))) : input.baseRole === 'ADMIN_OPERATIVO' ? P.levels() : P.customDefinition(input).permissions;
          if (target?.baseRole === input.baseRole && target.basePermissions && hash(P.levels(input.permissions)) === hash(P.levels(target.permissions))) permissions = P.levels(target.basePermissions);
          const baseCapabilities = ['ADMIN_GENERAL','ADMIN_OPERATIVO'].includes(input.baseRole) ? P.list(target?.baseCapabilities) : P.list(target && hash(P.list(input.capabilities).sort()) === hash(P.list(target.capabilities).sort()) ? target.baseCapabilities ?? target.capabilities : input.capabilities ?? target?.baseCapabilities ?? target?.capabilities);
          P.assert(['ADMIN_GENERAL','ADMIN_OPERATIVO'].includes(input.baseRole) || baseCapabilities.every(c=>c===P.REQUEST_CAPABILITY), 'Facultades incompatibles con el perfil.');
          const newScope = P.scope(input.scope ?? { programs: input.assignedPrograms });
          const area = String(input.area ?? target?.area ?? '').trim();
          P.assert(area.length >= 2 && area.length <= 160, 'Registra el área institucional real del perfil.', 'invalid-argument');
          P.assert(!Object.values(permissions).some(level => level !== 'NONE') || Object.values(state.asignaciones_roles).filter(a => a.userId === targetId && a.status === 'ACTIVE').every(a => hash(a.scope) === hash(newScope)), 'El ámbito base no coincide con los roles activos.', 'failed-precondition');
          P.assert(!['ADMIN_GENERAL', 'ADMIN_OPERATIVO'].includes(input.baseRole) || !Object.values(state.asignaciones_roles).some(a => a.userId === targetId && a.status === 'ACTIVE'), 'Retira los roles personalizados antes de cambiar a un perfil administrativo.', 'failed-precondition');
          const changedPrivileges = !target || hash([target.baseRole, target.role, target.status, target.basePermissions, target.baseScope, target.assignedPrograms, target.baseCapabilities ?? []]) !== hash([input.baseRole, input.role ?? input.baseRole, input.status, permissions, newScope, P.list(input.assignedPrograms), baseCapabilities]);
          P.assert(targetId !== auth.uid || !changedPrivileges, 'El propio acceso requiere otro administrador.');
          write('usuarios', targetId, { ...target, authUid: target?.authUid ?? null, area, name: input.name.trim(), email: input.email, role: input.role ?? input.baseRole, greetingGender: input.greetingGender ?? 'Femenino', baseRole: input.baseRole, status: input.status, permissionSchemaVersion: 2, assignedPrograms: P.list(input.assignedPrograms), permissions, basePermissions: permissions, scope: newScope, baseScope: newScope, baseCapabilities, capabilities: baseCapabilities, createdAt: target?.createdAt ?? now });
          recompute(targetId);
          break;
        }
        case 'deleteUser':
          P.assert(target && targetId !== auth.uid, 'No puedes retirar tu propio perfil.');
          requireRevision(target, data.expectedRevision);
          // Keep identities, assignments and references; removal is access inactivation.
          write('usuarios', targetId, { ...target, status: 'Inactivo' });
          break;
        case 'saveRole': {
          const old = state.roles_personalizados[targetId];
          requireRevision(old, data.expectedRevision);
          P.assert(!Object.values(state.asignaciones_roles).some(a => a.roleId === targetId && a.status === 'ACTIVE'), 'El rol está asignado: crea una definición nueva y sustituye las asignaciones tras revisión.', 'failed-precondition');
          const definition = P.customDefinition(data.value);
          P.assert(definition.name.length >= 3, 'Nombre de rol obligatorio.', 'invalid-argument');
          write('roles_personalizados', targetId, { ...definition, createdAt: old?.createdAt ?? now, approvedBy: auth.uid });
          break;
        }
        case 'deleteRole':
          requireRevision(state.roles_personalizados[targetId], data.expectedRevision);
          P.assert(!Object.values(state.asignaciones_roles).some(a => a.roleId === targetId && a.status === 'ACTIVE'), 'El rol aún tiene asignaciones.', 'failed-precondition');
          write('roles_personalizados', targetId, { ...state.roles_personalizados[targetId], status: 'RETIRED' });
          break;
        case 'grantDelegation': {
          fresh('delegaciones');
          P.assert(target?.baseRole === 'ADMIN_OPERATIVO' && targetId !== auth.uid, 'Selecciona un auxiliar.');
          requireRevision(target, data.expectedRevision);
          P.assert(!Object.values(state.delegaciones).some(d => d.userId === targetId && d.status === 'ACTIVE'), 'Revoca la delegación anterior antes de otorgar otra.', 'failed-precondition');
          const capabilities = P.list(data.value?.capabilities);
          P.assert(capabilities.every(c => P.DELEGABLE.includes(c) || c === P.REQUEST_CAPABILITY), 'Capacidad no delegable.');
          const grant = { userId: targetId, status: 'ACTIVE', permissions: P.levels(data.value?.permissions), capabilities, scope: P.scope(data.value?.scope), grantedBy: auth.uid, previousDelegationId: target.delegationId ?? null, createdAt: now };
          write('delegaciones', operationId, grant);
          write('usuarios', targetId, { ...target, delegationId: operationId, permissions: grant.permissions, capabilities, scope: grant.scope, access: Object.fromEntries(P.MODULES.map(k => [k, grant.permissions[k] !== 'NONE'])) });
          result.delegationId = operationId;
          break;
        }
        case 'revokeDelegation': case 'suspendDelegation': {
          const grant = state.delegaciones[targetId];
          P.assert(grant && grant.status === 'ACTIVE', 'La delegación ya no está activa.', 'failed-precondition');
          requireRevision(grant, data.expectedRevision);
          write('delegaciones', targetId, { ...grant, status: data.action === 'suspendDelegation' ? 'SUSPENDED' : 'REVOKED', revokedBy: auth.uid, revokedAt: now });
          const helper = state.usuarios[grant.userId];
          write('usuarios', grant.userId, { ...helper, permissions: P.levels(), capabilities: [], access: Object.fromEntries(P.MODULES.map(k => [k, false])) });
          result.reviewIds = [];
          for (const assignment of Object.values(state.asignaciones_roles).filter(a => a.assignedByDelegationId === targetId && a.status === 'ACTIVE')) {
            const reviewId = `${targetId}_${assignment.id}`;
            write('asignaciones_roles', assignment.id, { ...assignment, reviewStatus: 'REQUIERE_REVISION_ADMIN_GENERAL' });
            write('revisiones_roles', reviewId, { assignmentId: assignment.id, delegationId: targetId, userId: assignment.userId, status: 'REQUIERE_REVISION_ADMIN_GENERAL', createdAt: now });
            result.reviewIds.push(reviewId);
          }
          break;
        }
        case 'assignRole': {
          fresh('asignaciones_roles');
          const role = state.roles_personalizados[id(data.roleId)];
          P.assert(target && role?.status === 'ACTIVE', 'Perfil o rol no disponible.', 'failed-precondition');
          P.assert(typeof role.approvedBy === 'string', 'La definición heredada requiere aprobación administrativa.', 'failed-precondition');
          requireRevision(target, data.expectedRevision);
          requireRevision(role, data.roleRevision);
          P.canAssign(actor, auth.uid, targetId, target, role);
          compatibleScope(target, role);
          P.assert(!Object.values(state.asignaciones_roles).some(a => a.userId === targetId && a.roleId === role.id && a.status === 'ACTIVE'), 'El rol ya está asignado.', 'already-exists');
          write('asignaciones_roles', operationId, { userId: targetId, roleId: role.id, roleRevision: role.revision, permissions: role.permissions, capabilities: role.capabilities, scope: role.scope, status: 'ACTIVE', reviewStatus: 'NOT_REQUIRED', assignedBy: auth.uid, assignedByDelegationId: actor.baseRole === 'ADMIN_OPERATIVO' ? profile.delegationId : null, createdAt: now });
          recompute(targetId);
          result.assignmentId = operationId;
          break;
        }
        case 'removeRole': {
          const assignment = state.asignaciones_roles[targetId];
          P.assert(assignment?.status === 'ACTIVE', 'Asignación no vigente.', 'failed-precondition');
          requireRevision(assignment, data.expectedRevision);
          P.canAssign(actor, auth.uid, assignment.userId, state.usuarios[assignment.userId], assignment);
          write('asignaciones_roles', targetId, { ...assignment, status: 'REMOVED', removedBy: auth.uid });
          recompute(assignment.userId);
          break;
        }
        case 'resolveReview': {
          const review = state.revisiones_roles[targetId];
          P.assert(review?.status === 'REQUIERE_REVISION_ADMIN_GENERAL', 'La revisión ya se resolvió.', 'aborted');
          requireRevision(review, data.expectedRevision);
          P.assert(['KEEP', 'REMOVE', 'REPLACE'].includes(data.decision), 'Decisión inválida.', 'invalid-argument');
          const assignment = state.asignaciones_roles[review.assignmentId];
          P.assert(assignment, 'Asignación inexistente.', 'failed-precondition');
          if (data.decision === 'REPLACE') {
            fresh('asignaciones_roles');
            const role = state.roles_personalizados[id(data.roleId)];
            P.assert(assignment.status === 'ACTIVE' && role?.status === 'ACTIVE', 'No se reactiva una asignación retirada.', 'failed-precondition');
            P.assert(typeof role.approvedBy === 'string', 'La definición heredada requiere aprobación administrativa.', 'failed-precondition');
            requireRevision(role, data.roleRevision);
            P.canAssign(actor, auth.uid, assignment.userId, state.usuarios[assignment.userId], role);
            compatibleScope(state.usuarios[assignment.userId], role, assignment.id);
            write('asignaciones_roles', operationId, { ...assignment, id: operationId, roleId: role.id, roleRevision: role.revision, permissions: role.permissions, capabilities: role.capabilities, scope: role.scope, assignedBy: auth.uid, assignedByDelegationId: null, reviewStatus: 'NOT_REQUIRED', replaces: assignment.id });
          }
          write('asignaciones_roles', assignment.id, { ...assignment, status: data.decision === 'KEEP' ? assignment.status : 'REMOVED', reviewStatus: 'RESOLVED' });
          write('revisiones_roles', targetId, { ...review, status: 'RESOLVED', decision: data.decision, resolvedBy: auth.uid, reason, resolvedAt: now });
          recompute(assignment.userId);
          break;
        }
        case 'approveMapping': {
          P.assert(target && ['COORDINACION_ACADEMICA', 'ALTA_DOCENTES'].includes(data.baseRole), 'Correspondencia no verificable.', 'invalid-argument');
          requireRevision(target, data.expectedRevision);
          const mapping = { baseRole: data.baseRole, version: P.MAPPING_VERSION, approvedBy: auth.uid, status: 'ACTIVE', profileRevision: revision(target) + (target.permissionSchemaVersion === 2 ? 0 : 1) };
          if (target.permissionSchemaVersion !== 2) {
            const proposed = P.legacyProposal(target, mapping);
            write('usuarios', targetId, { ...target, legacyAuthorization: { mappingVersion: P.MAPPING_VERSION, mappingRevision: revision(state.mapeos_permisos[targetId]) + 1, profileRevision: revision(target) + 1, issuedAtMillis: serverMillis, expiresAtMillis: serverMillis + 7 * 86400000, permissionSchemaVersion: 2, baseRole: proposed.baseRole, permissions: proposed.permissions, scope: proposed.scope, capabilities: [], status: target.status } });
          }
          write('mapeos_permisos', targetId, { ...mapping, profileHash: hash(state.usuarios[targetId]), reason });
          break;
        }
        case 'previewMigration': {
          P.assert(target, 'Perfil no encontrado.', 'not-found');
          const mapping = state.mapeos_permisos[targetId];
          const proposal = P.legacyProposal(target, mapping?.profileHash === hash(target) ? mapping : null);
          result.preview = { previewId: operationId, userId: targetId, generatedAt: now, profileRevision: revision(target), delegationRevision: revision(state.delegaciones[target.delegationId]), permissionVersions: hash(target.permissions ?? {}), profileHash: hash(target), delegationHash: hash(state.delegaciones[target.delegationId] ?? null), mappingHash: hash(mapping ?? null), previous: target, proposed: proposal, differences: P.MODULES.filter(k => target.permissions?.[k] !== proposal.permissions[k]) };
          tx.create(db.doc(`previews_permisos/${operationId}`), result.preview);
          break;
        }
        case 'applyMigration': {
          P.assert(preview?.userId === targetId && !preview.appliedAt && preview.profileHash === hash(target) && preview.delegationHash === hash(state.delegaciones[target?.delegationId] ?? null) && preview.mappingHash === hash(state.mapeos_permisos[targetId] ?? null), 'MIGRATION_PREVIEW_OBSOLETE', 'aborted');
          // A preview made during the temporary grant cannot confirm it after expiry.
          // An administrator must obtain a fresh preview and review the explicit levels.
          const expiry = target.legacyAuthorization?.expiresAtMillis;
          P.assert(target.permissionSchemaVersion === 2 || !expiry || Date.parse(preview.generatedAt) >= expiry || nowMillis() < expiry, 'LEGACY_AUTHORIZATION_EXPIRED: solicita una nueva vista previa a Administración General.', 'failed-precondition');
          P.assert(targetId !== auth.uid && !['ADMIN_GENERAL', 'ADMIN_OPERATIVO'].includes(target.baseRole), 'Los perfiles administrativos requieren revisión explícita.');
          const proposal = preview.proposed;
          write('usuarios', targetId, { ...target, permissionSchemaVersion: 2, baseRole: proposal.baseRole, permissions: proposal.permissions, basePermissions: proposal.permissions, migrationDenials: proposal.explicitDenials, capabilities: [], baseCapabilities: [], scope: proposal.scope, baseScope: proposal.scope, migrationStatus: proposal.status, migrationVersion: P.MAPPING_VERSION });
          recompute(targetId);
          tx.update(previewRef, { appliedAt: now, appliedBy: auth.uid });
          break;
        }
      }
      P.assert(Object.values(state.usuarios).some(u => P.isGeneral(u) && u.authUid === u.id), 'Debe conservarse al menos un ADMIN_GENERAL activo y vinculado.', 'failed-precondition');
      const changes = [];
      for (const collection of COLLECTIONS) for (const [key, after] of Object.entries(state[collection])) {
        const before = beforeState[collection][key] ?? null;
        if (hash(before) !== hash(after)) { tx.set(db.doc(`${collection}/${key}`), after); changes.push({ collection, id: key, before, after }); }
      }
      const eventId = `${auth.uid}_${operationId}`;
      const actualActor = { uid: auth.uid, name: profile.name, role: profile.baseRole, area: profile.area ?? 'Área no registrada' };
      tx.create(db.doc(`bitacora/${eventId}`), { module: 'usuarios', action: data.action, entityId: targetId, actor: actualActor, reason, changes, integrity: 'VERIFICADO_SERVIDOR', source: 'SERVER', createdAt: now });
      tx.create(db.doc(`eventos_seguridad/${eventId}`), { actor: actualActor, reason, action: data.action, entityId: targetId, reviewIds: result.reviewIds ?? [], recipients: Object.values(state.usuarios).filter(P.isGeneral).map(u => u.id), state: 'PENDING', attempts: 0, error: null, deduplicationKey: eventId, createdAt: now });
      tx.create(opRef, { requestHash: hash(data), result, createdAt: now });
      tx.set(lockRef, { revision: revision(lock.data()) + 1 });
      return result;
    });
  }
  async function list(auth) {
    P.assert(auth?.uid, 'Inicia sesión.', 'unauthenticated');
    return db.runTransaction(async tx => {
      const profile = (await tx.get(db.doc(`usuarios/${auth.uid}`))).data();
      const grant = profile?.delegationId ? (await tx.get(db.doc(`delegaciones/${profile.delegationId}`))).data() : null;
      const mapping = profile?.permissionSchemaVersion !== 2 ? (await tx.get(db.doc(`mapeos_permisos/${auth.uid}`))).data() : null;
      const actor = P.effective(profile, grant, { mapping, nowMillis: nowMillis() });
      P.requireCapability(actor, 'MANAGE_CUSTOM_ROLES');
      const docs = await Promise.all(COLLECTIONS.slice(0, 5).map(c => tx.get(db.collection(c).limit(201))));
      P.assert(docs.every(s => s.size <= 200), 'Directorio excede el límite local.', 'resource-exhausted');
      const result = Object.fromEntries(COLLECTIONS.slice(0, 5).map((c, i) => [c, docs[i].docs.map(d => ({ ...d.data(), id: d.id }))]));
      if (actor.baseRole !== 'ADMIN_GENERAL') {
        result.usuarios = result.usuarios.filter(u => !u.identityAliasOf && u.permissionSchemaVersion === 2 && ['COORDINACION_ACADEMICA', 'ALTA_DOCENTES', 'CUSTOM'].includes(u.baseRole) && P.list(u.assignedPrograms).length > 0 && P.subset(P.list(u.assignedPrograms), actor.scope.programs));
        const targets = new Set(result.usuarios.map(u => u.id));
        result.asignaciones_roles = result.asignaciones_roles.filter(a => targets.has(a.userId));
        result.delegaciones = []; result.revisiones_roles = [];
        result.roles_personalizados = result.roles_personalizados.filter(r => { try { P.canAssign(actor, auth.uid, 'candidate', { permissionSchemaVersion: 2, assignedPrograms: actor.scope.programs, baseRole: 'CUSTOM' }, r); return r.status === 'ACTIVE' && typeof r.approvedBy === 'string'; } catch { return false; } });
      }
      result.usuarios = result.usuarios.filter(u => !u.deletedAt).map(u => ({...u, effectiveAccess:P.effective(u,result.delegaciones.find(g=>g.id===u.delegationId),{nowMillis:nowMillis()})}));
      return result;
    });
  }
  return { execute, list };
}

async function processNotification(db, eventId, local) {
  // No external sender in R01. In a non-local environment keep delivery pending.
  try { return await db.runTransaction(async tx => {
    const ref = db.doc(`eventos_seguridad/${eventId}`); const snapshot = await tx.get(ref);
    if (!snapshot.exists || snapshot.data().state === 'SIMULADO_LOCAL' || (!local && snapshot.data().state === 'DELIVERY_NOT_CONFIGURED')) return;
    const event = snapshot.data();
    if (!event.internalDelivered) for (const recipient of event.recipients) tx.create(db.doc(`avisos_seguridad/${eventId}_${recipient}`), { eventId, recipient, actor: event.actor, action: event.action, entityId: event.entityId, reviewIds: event.reviewIds, createdAt: event.createdAt, read: false });
    tx.update(ref, { state: local ? 'SIMULADO_LOCAL' : 'DELIVERY_NOT_CONFIGURED', attempts: event.attempts + 1, error: local ? null : 'R01 no conecta SMTP.', internalDelivered: true });
  }); } catch (error) {
    // Do not undo the committed command. Record a retryable consumer failure.
    // If Firestore itself is unavailable the original pending event remains.
    await db.runTransaction(async tx => {
      const ref = db.doc(`eventos_seguridad/${eventId}`); const snapshot = await tx.get(ref);
      if (snapshot.exists && !['SIMULADO_LOCAL', 'DELIVERY_NOT_CONFIGURED'].includes(snapshot.data().state)) tx.update(ref, { state: 'RETRY_PENDING', attempts: snapshot.data().attempts + 1, error: String(error.code ?? 'processing-failed'), lastAttemptAt: new Date().toISOString() });
    }).catch(() => {});
    throw error;
  }
}
module.exports = { createSecurityService, processNotification, hash };
