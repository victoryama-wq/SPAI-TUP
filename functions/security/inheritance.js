'use strict';
const P = require('./policy');
const {createHash} = require('node:crypto');
const stable = v => JSON.stringify(v,(_k,x) => x && typeof x==='object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])) : x);
const digest = v => createHash('sha256').update(stable(v)).digest('hex');
const rows = (state, collection, userId) => Object.values(state[collection]).filter(x=>x.userId===userId);
function canonical(state,id) {
  const seen=new Set();
  while(state.usuarios[id]?.identityAliasOf) {
    P.assert(!seen.has(id),'Identidad circular: requiere regularización.','failed-precondition');
    seen.add(id); id=state.usuarios[id].identityAliasOf;
  }
  const user=state.usuarios[id];
  P.assert(user && (!user.authUid || user.authUid===id),'Identidad canónica no verificada.','failed-precondition');
  return user;
}
function lifetime(record, now) {
  if (record.expiresAtMillis != null) {
    P.assert(Number.isSafeInteger(record.expiresAtMillis) && record.expiresAtMillis>now,'La vigencia del origen terminó.','failed-precondition');
  }
  // Unknown temporal formats must not silently become permanent grants.
  P.assert(!record.expiresAt && !record.validUntil && !record.validFrom && !record.startsAtMillis,'Vigencia no compatible: requiere revisión administrativa.','failed-precondition');
}
function plan(state, operatorId, sourceId, targetId, replace, now) {
  P.assert(P.isGeneral(state.usuarios[operatorId]),'Heredar acceso requiere ADMIN_GENERAL.');
  const source=canonical(state,sourceId), target=canonical(state,targetId);
  P.assert(source.id!==target.id && (!source.email || source.email.toLowerCase()!==String(target.email??'').toLowerCase()),'Origen y destino son la misma identidad.');
  P.assert(target.id!==operatorId,'No se permite heredar acceso al propio operador.');
  P.assert(sourceId===source.id && targetId===target.id,'Selecciona las identidades canónicas, no sus alias.','failed-precondition');
  P.assert(source.permissionSchemaVersion===2 && P.BASE_ROLES.includes(source.baseRole) && source.baseRole!=='PENDING' && (!source.migrationStatus || source.migrationStatus==='READY'),'El origen requiere Regularizar acceso antes de heredar.','failed-precondition');
  P.assert(source.status==='Activo','El origen no tiene acceso vigente.','failed-precondition');
  lifetime(source,now);
  P.assert(source.expiresAtMillis==null,'Vigencia de perfil no compatible; requiere regularización.','failed-precondition');
  P.assert(!source.legacyAuthorization || source.permissionSchemaVersion===2,'No se hereda autorización temporal.','failed-precondition');
  const assignments=rows(state,'asignaciones_roles',source.id).filter(a=>a.status==='ACTIVE');
  const grant=state.delegaciones[source.delegationId];
  const effective=P.effective(source,grant,{nowMillis:now});
  P.assert(effective.active,'El origen no tiene autorización vigente.','failed-precondition');
  const basePermissions=source.baseRole==='ADMIN_OPERATIVO'?P.levels():P.levels(source.basePermissions ?? source.permissions);
  const baseScope=source.baseRole==='ADMIN_OPERATIVO'?P.scope():P.scope(source.baseScope ?? source.scope);
  const baseCapabilities=source.baseRole==='ADMIN_OPERATIVO'?[]:P.list(source.baseCapabilities ?? (assignments.length ? [] : source.capabilities));
  const denials=P.list(source.migrationDenials);
  const roles=[];
  for(const assignment of assignments) {
    lifetime(assignment,now);
    // Assignment time limits are not part of the existing role projection model.
    P.assert(assignment.expiresAtMillis==null,'Asignación con vigencia no soportada por la proyección actual. No se realizará una copia parcial.','failed-precondition');
    P.assert(!assignment.reviewStatus || assignment.reviewStatus==='NOT_REQUIRED' || assignment.reviewStatus==='RESOLVED','El origen tiene revisiones de roles pendientes.','failed-precondition');
    const role=state.roles_personalizados[assignment.roleId];
    P.assert(role?.status==='ACTIVE' && role.approvedBy && role.revision===assignment.roleRevision,'La definición de un rol del origen cambió.','failed-precondition');
    P.customDefinition(role); lifetime(role,now);
    P.assert(role.expiresAtMillis==null,'Definición con vigencia no soportada.','failed-precondition');
    P.assert(digest([P.levels(assignment.permissions),P.scope(assignment.scope),P.list(assignment.capabilities)])===digest([P.levels(role.permissions),P.scope(role.scope),P.list(role.capabilities)]),'Asignación incompatible con su definición actual.','failed-precondition');
    roles.push({assignment,role});
  }
  P.assert(!rows(state,'revisiones_roles',source.id).some(r=>r.status==='REQUIERE_REVISION_ADMIN_GENERAL'),'El origen requiere resolver sus revisiones.','failed-precondition');
  if(source.baseRole==='ADMIN_OPERATIVO') {
    P.assert(assignments.length===0,'El auxiliar tiene roles incompatibles.','failed-precondition');
    lifetime(grant,now);
    P.assert(P.list(grant.capabilities).every(c=>P.DELEGABLE.includes(c)||c===P.REQUEST_CAPABILITY),'Facultades del origen incompatibles.');
  } else if(source.baseRole==='ADMIN_GENERAL') {
    P.assert(assignments.length===0,'Administrador con asignaciones incompatibles.','failed-precondition');
  } else {
    P.customDefinition({permissions:basePermissions,scope:baseScope,capabilities:baseCapabilities});
    const levels={...basePermissions}, caps=[...baseCapabilities], scopes=P.scope(baseScope);
    P.assert(roles.every(({assignment})=>digest(P.scope(assignment.scope))===digest(P.scope(roles[0].assignment.scope))), 'Roles con ámbitos incompatibles. No se realizará una copia parcial.', 'failed-precondition');
    for(const {assignment:a} of roles) {
      P.assert(!Object.values(basePermissions).some(v=>v!=='NONE') || digest(baseScope)===digest(P.scope(a.scope)),'Ámbitos incompatibles; no se realizará una copia parcial.','failed-precondition');
      for(const key of P.MODULES) if(P.RANK[a.permissions[key]]>P.RANK[levels[key]]) levels[key]=a.permissions[key];
      caps.push(...P.list(a.capabilities));
      for(const key of Object.keys(scopes)) scopes[key]=[...new Set([...scopes[key],...P.scope(a.scope)[key]])];
    }
    for(const key of denials) levels[key]='NONE';
    P.assert(digest(P.levels(source.permissions))===digest(levels) && digest([...new Set(caps)].sort())===digest([...effective.capabilities].sort()) && digest(Object.fromEntries(Object.entries(effective.scope).map(([k,v])=>[k,[...v].sort()])))===digest(Object.fromEntries(Object.entries(scopes).map(([k,v])=>[k,[...v].sort()]))),'La configuración efectiva no coincide con sus fuentes. Regulariza el origen.','failed-precondition');
  }
  const targetAssignments=rows(state,'asignaciones_roles',target.id), targetGrants=rows(state,'delegaciones',target.id);
  const configured=target.status!=='Activo' || !['PENDING','CUSTOM'].includes(target.baseRole) || target.permissionSchemaVersion!==2 || Object.values(target.permissions??{}).some(v=>v!=='NONE') || Object.values(target.basePermissions??{}).some(v=>v!=='NONE') || P.list(target.baseCapabilities).length>0 || Object.values(P.scope(target.baseScope)).some(v=>v.length) || P.list(target.capabilities).length>0 || Object.values(P.scope(target.scope)).some(v=>v.length) || P.list(target.assignedPrograms).length>0 || targetAssignments.length>0 || targetGrants.length>0 || target.delegationId || target.legacyAuthorization || state.mapeos_permisos[target.id] || rows(state,'revisiones_roles',target.id).length>0 || P.list(target.migrationDenials).length>0;
  P.assert(!configured || replace===true,'El destino tiene configuración o historial. Selecciona Reemplazar acceso existente.','failed-precondition');
  const dependencies={operator:state.usuarios[operatorId],source,target,roles,sourceGrants:rows(state,'delegaciones',source.id),targetAssignments,targetGrants,reviews:Object.values(state.revisiones_roles).filter(r=>[source.id,target.id].includes(r.userId)),mappings:[state.mapeos_permisos[source.id]??null,state.mapeos_permisos[target.id]??null],downstream:Object.values(state.asignaciones_roles).filter(a=>targetGrants.some(g=>g.id===a.assignedByDelegationId))};
  const proposed={baseRole:source.baseRole,permissions:effective.permissions,capabilities:effective.capabilities,scope:effective.scope,roles:roles.map(({role})=>({id:role.id,name:role.name,revision:role.revision})),expiresAtMillis:source.baseRole==='ADMIN_OPERATIVO'?grant.expiresAtMillis??null:null,denials};
  return {source,target,roles,grant,basePermissions,baseScope,baseCapabilities,denials,effective,targetAssignments,targetGrants,fingerprint:digest(dependencies),
    review:{sourceId:source.id,targetId:target.id,sourceName:source.name,targetName:target.name,replace:replace===true,
      previous:{baseRole:target.baseRole??'PENDING',permissions:target.permissions??{},scope:target.scope??P.scope(),capabilities:target.capabilities??[],status:target.status},
      proposed,retire:{assignments:targetAssignments.filter(a=>a.status==='ACTIVE').map(a=>({id:a.id,roleId:a.roleId})),delegations:targetGrants.filter(g=>g.status==='ACTIVE').map(g=>g.id)},
      preserve:'Identidad, nombre, correo, saludo, estado personal, historial y revisiones. Las revisiones de asignaciones retiradas permanecen pendientes hasta su resolución.',
      sourceRevision:source.revision??0,targetRevision:target.revision??0}};
}
function apply(state, p, operatorId, operationId, now, write) {
  const provenance={sourceUserId:p.source.id,sourceRevision:p.source.revision??0,sourceFingerprint:p.fingerprint,inheritedBy:operatorId,inheritedAt:now};
  for(const a of p.targetAssignments.filter(a=>a.status==='ACTIVE')) write('asignaciones_roles',a.id,{...a,status:'REMOVED',removedBy:operatorId,removedAt:now,replacedByInheritance:operationId});
  for(const g of p.targetGrants.filter(g=>g.status==='ACTIVE')) {
    write('delegaciones',g.id,{...g,status:'REVOKED',revokedBy:operatorId,revokedAt:now,replacedByInheritance:operationId});
    for(const a of Object.values(state.asignaciones_roles).filter(a=>a.assignedByDelegationId===g.id && a.status==='ACTIVE')) {
      write('asignaciones_roles',a.id,{...a,reviewStatus:'REQUIERE_REVISION_ADMIN_GENERAL'});
      write('revisiones_roles',g.id+'_'+a.id,{assignmentId:a.id,delegationId:g.id,userId:a.userId,status:'REQUIERE_REVISION_ADMIN_GENERAL',createdAt:now});
    }
  }
  const ownId=(kind,index)=>'inherit_'+digest([operatorId,operationId,kind,index]).slice(0,48);
  let delegationId=null;const assignmentIds=[];
  if(p.source.baseRole==='ADMIN_OPERATIVO') {
    delegationId=ownId('grant',0);
    P.assert(!state.delegaciones[delegationId],'Identificador de delegación en uso.','already-exists');
    write('delegaciones',delegationId,{userId:p.target.id,status:'ACTIVE',permissions:p.effective.permissions,scope:p.effective.scope,capabilities:p.effective.capabilities,
      ...(p.grant.expiresAtMillis!=null?{expiresAtMillis:p.grant.expiresAtMillis}:{}),grantedBy:operatorId,previousDelegationId:p.target.delegationId??null,createdAt:now,provenance:{...provenance,sourceDelegationId:p.grant.id,sourceDelegationRevision:p.grant.revision??0}});
  }
  for(const [i,{role,assignment}] of p.roles.entries()) {
    const key=ownId('role',i);P.assert(!state.asignaciones_roles[key],'Identificador de asignación en uso.','already-exists');
    write('asignaciones_roles',key,{userId:p.target.id,roleId:role.id,roleRevision:role.revision,permissions:P.levels(role.permissions),capabilities:P.list(role.capabilities),scope:P.scope(role.scope),status:'ACTIVE',reviewStatus:'NOT_REQUIRED',assignedBy:operatorId,assignedByDelegationId:null,createdAt:now,provenance:{...provenance,sourceAssignmentId:assignment.id,sourceAssignmentRevision:assignment.revision??0}});assignmentIds.push(key);
  }
  const target={...p.target,baseRole:p.source.baseRole,role:p.source.role??p.source.baseRole,permissionSchemaVersion:2,permissions:p.effective.permissions,basePermissions:p.basePermissions,
    scope:p.effective.scope,baseScope:p.baseScope,capabilities:p.effective.capabilities,baseCapabilities:p.baseCapabilities,assignedPrograms:p.effective.scope.programs,
    delegationId,migrationDenials:p.denials,access:Object.fromEntries(P.MODULES.map(k=>[k,p.effective.permissions[k]!=='NONE'])),accessInheritance:provenance};
  // These are authorization caches, not personal or audit history. The previous
  // complete document is preserved in the atomic audit record.
  delete target.legacyAuthorization;delete target.migrationStatus;
  write('usuarios',p.target.id,target);
  return {assignmentIds,delegationId};
}
module.exports={plan,apply};
