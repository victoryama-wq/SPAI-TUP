import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { User } from 'firebase/auth';
import { Router } from '@angular/router';
import {
  collection,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
  onSnapshot,
  query,
  setDoc,
  where,
  doc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AppUser, USERS_COLLECTION } from '../../features/users/data/users.repository';
import { AuthService } from './auth.service';
import { FIREBASE_FUNCTIONS, FIREBASE_DB } from '../firebase/firebase.tokens';
import { environment } from '../../../environments/environment';

export interface UserSession {
  authUid: string;
  email: string;
  displayName: string;
  appUser: AppUser | null;
}

const SESSION_RELEASE_KEY = 'spai.session.release';
const SESSION_RELEASE_VERSION = '2026-08-03-operational-dashboard';
const PENDING_USER_ACCESS = {
  dashboard: false,
  usuarios: false,
  ciclos: false,
  nomenclaturas: false,
  grupos: false,
  docentes: false,
  asignaturas: false,
  asignaciones: false,
  solicitudes: false,
  ligasMeet: false,
  moodle: false,
  bitacora: false,
};

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly firestore = inject(FIREBASE_DB);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly syncUserProfileByEmail = httpsCallable<Record<string, never>, { synced: boolean; reason?: string }>(
    this.functions,
    'syncUserProfileByEmail',
  );
  private readonly sessionSignal = signal<UserSession | null>(null);

  private readonly profileOwner = signal<User | null>(null);
  // A previous identity's profile is never visible while a new Auth identity
  // waits for its server snapshot, even before effects have cleaned up.
  readonly session = computed(() => this.authService.user() && this.profileOwner() === this.authService.user() ? this.sessionSignal() : null);
  readonly authorizationReady = computed(() => !this.authService.loading() && (!this.authService.user() || this.session() !== null));

  constructor() {
    effect((onCleanup) => {
      const authUser = this.authService.user();
      this.sessionSignal.set(null);
      this.profileOwner.set(null);

      if (!authUser?.email) {
        this.sessionSignal.set(null);
        // A confirmed signed-out browser has no old session to invalidate.
        // Acknowledge the release before its first interactive sign-in; an
        // authenticated persisted session still follows the forced logout below.
        if (!this.authService.loading()) this.requiresReleaseSignOut();
        return;
      }

      if (this.requiresReleaseSignOut()) {
        this.sessionSignal.set(null);
        void this.authService.signOut().finally(() => void this.router.navigate(['/']));
        return;
      }

      const email = authUser.email;
      const normalizedEmail = email.toLowerCase();
      const userRef = doc(this.firestore, USERS_COLLECTION, authUser.uid);
      let disposed = false;
      let legacyExpiry: ReturnType<typeof setTimeout> | undefined;
      let lastProfile: DocumentSnapshot | undefined;
      let mapping: DocumentData | undefined;
      let mappingUnsubscribe: (() => void) | undefined;
      let grantUnsubscribe: (() => void) | undefined;
      let grantId: string | undefined;
      let grant: DocumentData | undefined;
      let grantReady = false;

      const setSession = (snapshot: DocumentSnapshot) => {
        if (disposed) return;
        let appUser = snapshot.exists()
          ? ({ id: snapshot.id, ...snapshot.data() } as AppUser)
          : null;
        if (appUser?.baseRole === 'ADMIN_OPERATIVO') {
          if (!grantReady) { this.sessionSignal.set(null); return; }
          const active = grant?.['status'] === 'ACTIVE' && grant['userId'] === authUser.uid && grantId === appUser.delegationId;
          const rawScope = grant?.['scope'] ?? {};
          const list = (key: string): string[] => Array.isArray(rawScope[key]) ? rawScope[key].filter((value: unknown) => typeof value === 'string') : [];
          appUser = { ...appUser, delegationActive: active, permissions: active ? grant?.['permissions'] ?? {} : {},
            capabilities: active ? grant?.['capabilities'] ?? [] : [],
            scope: active ? {programs:list('programs'),cycles:list('cycles'),teachers:list('teachers'),fields:list('fields')} : {programs:[],cycles:[],teachers:[],fields:[]},
            authorizationNotice: active ? undefined : 'PERMISO_REVOCADO: tu delegación no está vigente. Solicita revisión a Administración General.' };
        }
        clearTimeout(legacyExpiry);
        const legacy = appUser?.legacyAuthorization;
        if (appUser && appUser.permissionSchemaVersion !== 2 && !appUser.identityAliasOf && appUser.status === 'Activo' && legacy?.mappingVersion === 'E2-R01-v0.4-1' && legacy.profileRevision === appUser.revision && legacy.expiresAtMillis > Date.now() && mapping?.['status'] === 'ACTIVE' && mapping['version'] === legacy.mappingVersion && mapping['revision'] === legacy.mappingRevision && mapping['profileRevision'] === appUser.revision && mapping['baseRole'] === legacy.baseRole && mapping['approvedBy']) {
          appUser = { ...appUser, ...legacy };
          legacyExpiry = setTimeout(() => setSession(snapshot), legacy.expiresAtMillis - Date.now());
        } else if (appUser && appUser.permissionSchemaVersion !== 2 && legacy) {
          appUser = { ...appUser, authorizationNotice: legacy.expiresAtMillis <= Date.now()
            ? 'La autorización temporal de siete días venció. Solicita a Administración General una nueva vista previa y la migración de tus permisos. Tus permisos explícitos se conservan.'
            : 'La autorización temporal requiere revisión de Administración General: el perfil o su correspondencia cambiaron.' };
        }

        this.sessionSignal.set({
          authUid: authUser.uid,
          email: normalizedEmail,
          displayName: authUser.displayName ?? authUser.email ?? 'Usuario SPAI',
          appUser,
        });
        this.profileOwner.set(authUser);
      };

      const setUnauthenticatedAppSession = () => {
        if (disposed) return;
        this.sessionSignal.set({
          authUid: authUser.uid,
          email: normalizedEmail,
          displayName: authUser.displayName ?? authUser.email ?? 'Usuario SPAI',
          appUser: null,
        });
        this.profileOwner.set(authUser);
      };

      const bootstrapUser = async () => {
        // DEMO profiles are loaded by the supervisor. A persisted browser session
        // must not create users while the emulator is being reset or imported.
        if (environment.mode === 'local') {
          setUnauthenticatedAppSession();
          return;
        }
        const timestamp = new Date().toISOString();

        await setDoc(
          userRef,
          {
            authUid: authUser.uid,
            name: authUser.displayName ?? authUser.email,
            email: normalizedEmail,
            // Un correo institucional no otorga un rol ni permisos por sí solo.
            // Sistemas debe autorizar y configurar el perfil desde Usuarios.
            role: 'Pendiente de autorizacion',
            assignedPrograms: [],
            access: PENDING_USER_ACCESS,
            status: 'Inactivo',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          { merge: true },
        );
      };

      let linking = false;
      const unsubscribe = onSnapshot(userRef, { includeMetadataChanges: true }, async snapshot => {
        if (disposed || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        lastProfile = snapshot;
        const nextGrantId = snapshot.data()?.['baseRole'] === 'ADMIN_OPERATIVO' ? snapshot.data()?.['delegationId'] : undefined;
        if (nextGrantId !== grantId) {
          grantUnsubscribe?.(); grant = undefined; grantReady = !nextGrantId; grantId = nextGrantId;
          if (nextGrantId) {
            const watchedId = nextGrantId;
            grantUnsubscribe = onSnapshot(doc(this.firestore, 'delegaciones', nextGrantId), { includeMetadataChanges: true }, value => {
              if (disposed || watchedId !== grantId || value.metadata.fromCache || value.metadata.hasPendingWrites) return;
              grant = value.data(); grantReady = true; if (lastProfile) setSession(lastProfile);
            }, () => { if (!disposed && watchedId === grantId) { grant = undefined; grantReady = true; if (lastProfile) setSession(lastProfile); } });
          }
        }
        if (!nextGrantId) grantReady = true;
        if (snapshot.exists() && snapshot.data()['permissionSchemaVersion'] !== 2 && !mappingUnsubscribe) {
          mappingUnsubscribe = onSnapshot(doc(this.firestore, 'mapeos_permisos', authUser.uid), { includeMetadataChanges: true }, value => {
            if (disposed || value.metadata.fromCache || value.metadata.hasPendingWrites) return;
            mapping = value.data(); if (lastProfile) setSession(lastProfile);
          }, () => { mapping = undefined; if (lastProfile) setSession(lastProfile); });
        }
        if (snapshot.exists()) { setSession(snapshot); return; }
        setUnauthenticatedAppSession();
        if (linking) return;
        linking = true;
        try {
          const result = await this.syncUserProfileByEmail({});
          if (!disposed && !result.data.synced) await bootstrapUser();
        } catch (error) { console.warn('La identidad requiere revisión administrativa.', error); }
      }, error => { console.error('No se pudo consultar el perfil vigente.', error); setUnauthenticatedAppSession(); });

      onCleanup(() => {
        disposed = true;
        clearTimeout(legacyExpiry);
        mappingUnsubscribe?.();
        grantUnsubscribe?.();
        unsubscribe();
      });
    });
  }

  private requiresReleaseSignOut(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      if (window.localStorage.getItem(SESSION_RELEASE_KEY) === SESSION_RELEASE_VERSION) {
        return false;
      }

      window.localStorage.setItem(SESSION_RELEASE_KEY, SESSION_RELEASE_VERSION);
      return true;
    } catch {
      return false;
    }
  }
}
