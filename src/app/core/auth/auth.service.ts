import { computed, inject, Injectable, signal } from '@angular/core';
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { FIREBASE_AUTH } from '../firebase/firebase.tokens';

const INSTITUTIONAL_DOMAIN = '@tecplayacar.edu.mx';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly userSignal = signal<User | null>(null);
  private readonly loadingSignal = signal(true);

  readonly user = this.userSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  constructor() {
    void setPersistence(this.auth, browserLocalPersistence);

    onAuthStateChanged(this.auth, (user) => {
      this.userSignal.set(user);
      this.loadingSignal.set(false);
    });
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      hd: 'tecplayacar.edu.mx',
      prompt: 'select_account',
    });

    const credential = await signInWithPopup(this.auth, provider);
    const email = credential.user.email?.toLowerCase() ?? '';

    if (!email.endsWith(INSTITUTIONAL_DOMAIN)) {
      await signOut(this.auth);
      throw new Error(`Solo se permite el acceso con correo institucional ${INSTITUTIONAL_DOMAIN}`);
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }
}
