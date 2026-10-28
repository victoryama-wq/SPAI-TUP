// Read only the identity captured in the event, never the current viewer/profile.
export function auditIdentity(entry: Record<string, unknown>): { user: string; userRole: string } {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const actor = entry['actor'] && typeof entry['actor'] === 'object'
    ? entry['actor'] as Record<string, unknown> : {};
  const user = text(entry['actorName']) || text(actor['name']) || text(entry['user'])
    || text(entry['actorEmail']) || text(actor['email']);
  const role = text(entry['actorRole']) || text(actor['role']) || text(entry['userRole']) || text(entry['actorArea']);
  const comparable = (value: string) => value.replace(/\s+/g, ' ').toLocaleLowerCase('es');
  // An old area snapshot can repeat the actor's name. Suppress only that
  // redundant presentation; keep distinct roles and the original event intact.
  return { user, userRole: comparable(role) === comparable(user) ? '' : role };
}

/** Correlate only server snapshots already in the authorized query. No lookup
 * of current identities, additional query or write to historical records. */
export function auditPresentation<T extends Record<string, unknown>>(entry: T, entries: T[]) {
  const operation = entry['operationId'];
  const initial = entry['action'] === 'BAJA_AUTH_COMPLETADA' && entry['source'] === 'SERVIDOR'
    && typeof operation === 'string' && operation && entry['id'] === 'baja_auth_' + operation
    ? entries.filter(row => row['id'] === 'baja_' + operation && row['source'] === 'SERVIDOR'
      && row['action'] === 'BAJA_USUARIO_INICIADA' && row['operationId'] === operation
      && typeof entry['actorId'] === 'string' && row['actorId'] === entry['actorId']
      && typeof entry['entityId'] === 'string' && row['entityId'] === entry['entityId']) : [];
  const own = auditIdentity(entry);
  const linked = initial.length === 1 ? initial[0] : null;
  const identity = own.user ? own : linked ? auditIdentity(linked) : own;
  const metadata = { ...(entry['metadata'] as Record<string, unknown> | undefined) };
  if (!own.user && identity.user) metadata['Identidad acreditada por'] = 'Registro de inicio de la misma operación';
  if (entry['action'] === 'BAJA_AUTH_COMPLETADA') {
    if (operation) metadata['Operación relacionada'] = operation;
    const reason = entry['reason'] || linked?.['reason'];
    if (typeof reason === 'string') metadata['Motivo'] = reason;
    const executor = entry['executor'] as Record<string, unknown> | undefined;
    if (executor) metadata['Ejecutor técnico'] = executor['kind'] === 'SERVER' ? 'Proceso de servidor'
      : `Reintento administrativo: ${executor['name'] || executor['id']}`;
    if (entry['authResult'] === 'CONFIRMED_ABSENT') metadata['Authentication'] = 'Ausencia de la cuenta confirmada';
  }
  return { ...entry, ...identity, metadata,
    description: entry['description'] || (linked ? 'Baja en Authentication completada. Consulta la operación relacionada; este evento histórico no conserva el nombre del destinatario.' : '') };
}
