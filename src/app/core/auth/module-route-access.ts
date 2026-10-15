import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { hasAccess } from '../../features/users/data/module-permission.service';
import type { AppUser, ModuleAccess } from '../../features/users/data/users.repository';
import { UserSessionService } from './user-session.service';

export const MODULE_PATHS: ReadonlyArray<readonly [string, keyof ModuleAccess]> = [
  ['/', 'dashboard'], ['/usuarios', 'usuarios'], ['/ciclos', 'ciclos'],
  ['/nomenclaturas', 'nomenclaturas'], ['/grupos', 'grupos'], ['/docentes', 'docentes'],
  ['/asignaturas', 'asignaturas'], ['/asignaciones', 'asignaciones'], ['/solicitudes', 'solicitudes'],
  ['/ligas-meet', 'ligasMeet'], ['/moodle', 'moodle'], ['/bitacora', 'bitacora'],
];
export function firstAuthorizedPath(user: AppUser | null | undefined): string {
  return MODULE_PATHS.find(([, key]) => hasAccess(user, key))?.[0] ?? '/acceso-restringido';
}
export function canAccessModulePath(url: string, user: AppUser | null | undefined): boolean {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (path === '/acceso-restringido') return firstAuthorizedPath(user) === path;
  const entry = MODULE_PATHS.find(([candidate]) => candidate === path);
  return Boolean(entry && hasAccess(user, entry[1]));
}
export const moduleAccessGuard: CanActivateFn = (_route, state) => {
  const session = inject(UserSessionService);
  const router = inject(Router);
  return toObservable(session.authorizationReady).pipe(filter(Boolean), take(1), map(() => {
    const user = session.session()?.appUser;
    if (!user) return false; // The application shell presents login/pending access.
    return canAccessModulePath(state.url, user) || router.parseUrl(firstAuthorizedPath(user));
  }));
};
