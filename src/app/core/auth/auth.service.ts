import { computed, inject, Injectable, signal } from '@angular/core';
import {
  browserLocalPersistence,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
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
  private readonly redirectErrorSignal = signal('');

  readonly user = this.userSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly redirectError = this.redirectErrorSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  constructor() {
    void this.completeRedirectSignIn();

    onAuthStateChanged(this.auth, (user) => {
      this.userSignal.set(user);
      this.loadingSignal.set(false);
    });
  }

  async signInWithGoogle(): Promise<void> {
    this.redirectErrorSignal.set('');
    const provider = this.createGoogleProvider();

    try {
      await setPersistence(this.auth, browserLocalPersistence);

      const credential = await signInWithPopup(this.auth, provider);
      await this.validateInstitutionalUser(credential.user);
    } catch (error) {
      if (this.shouldUseRedirectFallback(error)) {
        await signInWithRedirect(this.auth, provider);
        return;
      }

      const message = this.resolveAuthErrorMessage(error);
      this.redirectErrorSignal.set(message);
      throw new Error(message);
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  private async completeRedirectSignIn(): Promise<void> {
    try {
      await setPersistence(this.auth, browserLocalPersistence);
      const credential = await getRedirectResult(this.auth);

      if (credential?.user) {
        await this.validateInstitutionalUser(credential.user);
      }
    } catch (error) {
      console.error('No se pudo completar el inicio de sesion con Google', error);
      this.redirectErrorSignal.set(this.resolveAuthErrorMessage(error));
    }
  }

  private createGoogleProvider(): GoogleAuthProvider {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      hd: 'tecplayacar.edu.mx',
      prompt: 'select_account',
    });

    return provider;
  }

  private async validateInstitutionalUser(user: User): Promise<void> {
    const email = user.email?.toLowerCase() ?? '';

    if (!email.endsWith(INSTITUTIONAL_DOMAIN)) {
      await signOut(this.auth);
      throw new Error(`Solo se permite el acceso con correo institucional ${INSTITUTIONAL_DOMAIN}`);
    }
  }

  private shouldUseRedirectFallback(error: unknown): boolean {
    const code = this.authErrorCode(error);

    return code === 'auth/popup-blocked'
      || code === 'auth/popup-closed-by-user'
      || code === 'auth/cancelled-popup-request'
      || code === 'auth/operation-not-supported-in-this-environment';
  }

  private resolveAuthErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.includes(INSTITUTIONAL_DOMAIN)) {
      return error.message;
    }

    const code = this.authErrorCode(error);

    if (code === 'auth/operation-not-allowed') {
      return 'Google OAuth no esta habilitado en Firebase Authentication.';
    }

    if (code === 'auth/unauthorized-domain') {
      return 'El dominio de SPAI no esta autorizado en Firebase Authentication.';
    }

    return code
      ? `No se pudo completar el acceso con Google. Firebase devolvio ${code}.`
      : 'No se pudo completar el acceso con Google. Intenta nuevamente con tu correo institucional.';
  }

  private authErrorCode(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      return String((error as { code?: unknown }).code ?? '');
    }

    return '';
  }
}
