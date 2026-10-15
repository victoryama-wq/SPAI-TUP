import { and, collection, documentId, FieldPath, Firestore, or, query, Query, QueryConstraint, QueryFilterConstraint, where } from 'firebase/firestore';
import type { AppUser, ModuleAccess } from '../../features/users/data/users.repository';
import { hasAccess } from '../../features/users/data/module-permission.service';
const MODULES: Record<string, keyof ModuleAccess> = { usuarios:'usuarios', roles_personalizados:'usuarios', ciclos:'ciclos', programas:'nomenclaturas', nomenclaturas_programas:'nomenclaturas', grupos:'grupos', docentes:'docentes', asignaturas:'asignaturas', asignaciones:'asignaciones', solicitudes_compartidas:'solicitudes', solicitudes_sistemas:'solicitudes', ligas_meet:'ligasMeet', moodle_categorias:'moodle', moodle_plantillas:'moodle', bitacora:'bitacora' };
export function authorizedQuery(db: Firestore, path: string, constraints: QueryConstraint[], user: AppUser | null | undefined): Query | null {
  if (!user || user.status !== 'Activo' || user.permissionSchemaVersion !== 2 || user.identityAliasOf) return null;
  const module = MODULES[path];
  const general = user.baseRole === 'ADMIN_GENERAL';
  const academic = user.baseRole === 'COORDINACION_ACADEMICA';
  // The own profile is already resolved by UserSessionService through get.
  // The administrative directory is never queried by other actors.
  if (path === 'usuarios' && !general) return null;
  if (!general && module && !hasAccess(user, module) && !(path === 'ciclos' && (hasAccess(user, 'dashboard') || hasAccess(user, 'asignaciones')))) return null;
  const ref = collection(db, path);
  if (general) return constraints.length ? query(ref, ...constraints) : query(ref);
  const programs = user.scope?.programs ?? [];
  let filter: QueryFilterConstraint | undefined;
  const scoped = (field: string | FieldPath, values = programs): QueryFilterConstraint => {
    if (values.length > (path === 'docentes' ? 28 : 30)) throw new Error('El ámbito supera el límite de esta consulta. Requiere paginación; no se ha reducido tu autorización.');
    return where(field, 'in', values.length ? values : ['_no_authorized_scope_']);
  };
  // Fail visibly rather than silently dropping a scope beyond Firestore's query bound.
  if (programs.length > 14 && !programs.includes('*')) throw new Error('El ámbito requiere consultas paginadas por programas. Contacta a Administración; no se ha reducido tu acceso.');
  if (path === 'roles_personalizados') return null;
  else if (path === 'solicitudes_compartidas' && !programs.includes('*')) filter = or(where('requestedBy', '==', user.id), scoped('sourceProgram'), scoped('destinationProgram'));
  else if (path === 'solicitudes_sistemas' && !programs.includes('*')) filter = where('requestedBy', '==', user.id);
  else if (path === 'docentes' && !academic && user.baseRole !== 'ALTA_DOCENTES' && !(user.scope?.teachers ?? []).includes('*')) filter = or(where('createdBy','==',user.id), where('assignedCoordinatorIds','array-contains',user.id), scoped(documentId(), user.scope?.teachers ?? []));
  else if (!programs.includes('*') && !academic) {
    const fields: Record<string, string | FieldPath> = { programas:documentId(), nomenclaturas_programas:'programCode', grupos:'programAbbreviation', asignaciones:'program', moodle_categorias:'programCode', moodle_plantillas:'programCode' };
    if (fields[path]) filter = scoped(fields[path]);
    if (path === 'ligas_meet') filter = scoped('cycle', user.scope?.cycles ?? []);
  }
  if (path === 'asignaciones' && !academic && !(user.scope?.cycles ?? []).includes('*')) {
    const cycles = user.scope?.cycles ?? [];
    if (!programs.includes('*') && Math.max(1, programs.length) * Math.max(1, cycles.length) > 30) throw new Error('El ámbito combinado requiere consultas paginadas. No se ha reducido tu autorización.');
    filter = filter ? and(filter, scoped('cycle', cycles)) : scoped('cycle', cycles);
  }
  return filter ? query(query(ref, or(filter)), ...constraints) : query(ref, ...constraints);
}
