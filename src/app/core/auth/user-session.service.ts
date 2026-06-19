import { effect, inject, Injectable, signal } from '@angular/core';
import {
  collection,
  DocumentSnapshot,
  onSnapshot,
  query,
  setDoc,
  where,
  doc,
} from 'firebase/firestore';
import { AppUser, USERS_COLLECTION } from '../../features/users/data/users.repository';
import { AuthService } from './auth.service';
import { FIREBASE_DB } from '../firebase/firebase.tokens';

export interface UserSession {
  authUid: string;
  email: string;
  displayName: string;
  appUser: AppUser | null;
}

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private readonly authService = inject(AuthService);
  private readonly firestore = inject(FIREBASE_DB);
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

      const unsubscribe = onSnapshot(userRef, async (snapshot) => {
        if (snapshot.exists()) {
          emailUnsubscribe?.();
          emailUnsubscribe = null;
          setSession(snapshot);
          return;
        }

        const usersRef = collection(this.firestore, USERS_COLLECTION);
        const userQuery = query(
          usersRef,
          where('email', '==', normalizedEmail),
        );

        emailUnsubscribe?.();
        emailUnsubscribe = onSnapshot(userQuery, async (emailSnapshot) => {
          const emailUserSnapshot =
            emailSnapshot.docs.find((item) => item.data()['status'] === 'Activo') ??
            emailSnapshot.docs[0];

          if (!emailUserSnapshot) {
            await bootstrapUser();
            return;
          }

          const emailUser = { id: emailUserSnapshot.id, ...emailUserSnapshot.data() } as AppUser;
          const { id: _id, ...emailUserData } = emailUser;

          await setDoc(
            userRef,
            {
              ...emailUserData,
              authUid: authUser.uid,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        });
      });

      onCleanup(() => {
        emailUnsubscribe?.();
        unsubscribe();
      });
    });
  }
}
