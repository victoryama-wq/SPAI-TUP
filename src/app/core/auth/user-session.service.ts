import { effect, inject, Injectable, signal } from '@angular/core';
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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AppUser, USERS_COLLECTION } from '../../features/users/data/users.repository';
import { AuthService } from './auth.service';
import { FIREBASE_APP, FIREBASE_DB } from '../firebase/firebase.tokens';

export interface UserSession {
  authUid: string;
  email: string;
  displayName: string;
  appUser: AppUser | null;
}

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private readonly authService = inject(AuthService);
  private readonly firebaseApp = inject(FIREBASE_APP);
  private readonly firestore = inject(FIREBASE_DB);
  private readonly functions = getFunctions(this.firebaseApp, 'us-central1');
  private readonly syncUserProfileByEmail = httpsCallable<Record<string, never>, { synced: boolean; reason?: string }>(
    this.functions,
    'syncUserProfileByEmail',
  );
  private readonly sessionSignal = signal<UserSession | null>(null);

  readonly session = this.sessionSignal.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const authUser = this.authService.user();

      if (!authUser?.email) {
        this.sessionSignal.set(null);
        return;
      }

      const email = authUser.email;
      const normalizedEmail = email.toLowerCase();
      const userRef = doc(this.firestore, USERS_COLLECTION, authUser.uid);
      let emailUnsubscribe: (() => void) | null = null;

      const setSession = (snapshot: DocumentSnapshot) => {
        const appUser = snapshot.exists()
          ? ({ id: snapshot.id, ...snapshot.data() } as AppUser)
          : null;

        this.sessionSignal.set({
          authUid: authUser.uid,
          email: normalizedEmail,
          displayName: authUser.displayName ?? authUser.email ?? 'Usuario SPAI',
          appUser,
        });
      };

      const setUnauthenticatedAppSession = () => {
        this.sessionSignal.set({
          authUid: authUser.uid,
          email: normalizedEmail,
          displayName: authUser.displayName ?? authUser.email ?? 'Usuario SPAI',
          appUser: null,
        });
      };

      const bootstrapUser = async () => {
        const timestamp = new Date().toISOString();

        await setDoc(
          userRef,
          {
            authUid: authUser.uid,
            name: authUser.displayName ?? authUser.email,
            email: normalizedEmail,
            role: 'Auxiliar de Sistemas',
            assignedPrograms: [],
            access: {},
            status: 'Inactivo',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          { merge: true },
        );
      };

      const selectEmailUserSnapshot = (emailSnapshot: QuerySnapshot<DocumentData>): DocumentSnapshot | null => {
        const candidates = emailSnapshot.docs.filter((item) => item.data()['status'] === 'Activo');

        if (!candidates.length) {
          return emailSnapshot.docs[0] ?? null;
        }

        const exactUidUser = candidates.find((item) => item.id === authUser.uid);

        if (exactUidUser) {
          return exactUidUser;
        }

        const withPrograms = candidates.find((item) => {
          const assignedPrograms = item.data()['assignedPrograms'];

          return Array.isArray(assignedPrograms) && assignedPrograms.length > 0 && item.id !== authUser.uid;
        });

        return withPrograms ?? candidates.find((item) => item.id !== authUser.uid) ?? candidates[0];
      };

      const normalizeComparableValue = (value: unknown): string => JSON.stringify(value ?? null);

      const needsUidSync = (
        sourceData: Omit<AppUser, 'id'>,
        fallbackSnapshot: DocumentSnapshot | null,
      ): boolean => {
        if (!fallbackSnapshot?.exists() || fallbackSnapshot.id !== authUser.uid) {
          return true;
        }

        const currentData = fallbackSnapshot.data();
        const fieldsToCompare = [
          'name',
          'email',
          'role',
          'greetingGender',
          'assignedPrograms',
          'access',
          'status',
        ];

        return fieldsToCompare.some((field) => {
          return normalizeComparableValue(currentData[field]) !== normalizeComparableValue(sourceData[field as keyof Omit<AppUser, 'id'>]);
        }) || currentData['authUid'] !== authUser.uid;
      };

      const listenByEmail = (fallbackSnapshot: DocumentSnapshot | null) => {
        const usersRef = collection(this.firestore, USERS_COLLECTION);
        const userQuery = query(
          usersRef,
          where('email', '==', normalizedEmail),
        );

        emailUnsubscribe?.();
        emailUnsubscribe = onSnapshot(userQuery, async (emailSnapshot) => {
          const emailUserSnapshot = selectEmailUserSnapshot(emailSnapshot);

          if (!emailUserSnapshot) {
            if (fallbackSnapshot?.exists()) {
              setSession(fallbackSnapshot);
              return;
            }

            try {
              await bootstrapUser();
            } catch (error) {
              console.error('No se pudo preparar el usuario inicial en Firestore', error);
              setUnauthenticatedAppSession();
            }
            return;
          }

          const emailUser = { id: emailUserSnapshot.id, ...emailUserSnapshot.data() } as AppUser;
          const { id: _id, ...emailUserData } = emailUser;

          if (emailUserSnapshot.id === authUser.uid) {
            setSession(emailUserSnapshot);
            return;
          }

          if (!needsUidSync(emailUserData, fallbackSnapshot)) {
            if (fallbackSnapshot?.exists()) {
              setSession(fallbackSnapshot);
              return;
            }

            setUnauthenticatedAppSession();
            return;
          }

          try {
            await this.syncUserProfileByEmail({});
          } catch (error) {
            console.warn('El usuario se reconocio por correo, pero no se pudo migrar al UID de Firebase.', error);
            setUnauthenticatedAppSession();
          }
        }, (error) => {
          console.error('No se pudo buscar el usuario por correo institucional', error);

          if (fallbackSnapshot?.exists()) {
            setSession(fallbackSnapshot);
            return;
          }

          setUnauthenticatedAppSession();
        });
      };

      const unsubscribe = onSnapshot(userRef, async (snapshot) => {
        if (snapshot.exists()) {
          const appUser = { id: snapshot.id, ...snapshot.data() } as AppUser;

          if (appUser.status === 'Activo') {
            setSession(snapshot);
          }
        }

        listenByEmail(snapshot);
      }, (error) => {
        console.error('No se pudo leer el usuario activo por UID', error);
        setUnauthenticatedAppSession();
      });

      onCleanup(() => {
        emailUnsubscribe?.();
        unsubscribe();
      });
    });
  }
}
