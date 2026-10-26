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
