// Read only the identity captured in the event, never the current viewer/profile.
export function auditIdentity(entry: Record<string, unknown>): { user: string; userRole: string } {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const actor = entry['actor'] && typeof entry['actor'] === 'object'
    ? entry['actor'] as Record<string, unknown> : {};
  return {
    user: text(entry['actorName']) || text(actor['name']) || text(entry['user'])
      || text(entry['actorEmail']) || text(actor['email']),
    userRole: text(entry['actorRole']) || text(actor['role']) || text(entry['userRole']) || text(entry['actorArea']),
  };
}
