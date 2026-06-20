import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserSessionService } from '../../../../core/auth/user-session.service';

type LoginState = 'loading' | 'signedOut' | 'preparing' | 'pending';
type MascotPose = 'base' | 'saludo';

@Component({
  selector: 'spai-login-page',
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
})
export class LoginPageComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly userSessionService = inject(UserSessionService);
  private readonly busySignal = signal(false);
  private readonly errorSignal = signal('');
  private readonly mascotPoseSignal = signal<MascotPose>('base');
  private idleIntervalId: number | null = null;
  private poseResetTimeoutId: number | null = null;

  readonly busy = this.busySignal.asReadonly();
  readonly error = computed(() => this.errorSignal() || this.authService.redirectError());
  readonly mascotPose = this.mascotPoseSignal.asReadonly();
  readonly mascotPoses: ReadonlyArray<{ key: MascotPose; src: string }> = [
    { key: 'base', src: 'brand/tup-mascot-pose-base.png' },
    { key: 'saludo', src: 'brand/tup-mascot-pose-saludo.png' },
  ];
  readonly session = this.userSessionService.session;
  readonly loginState = computed<LoginState>(() => {
    if (this.authService.loading()) {
      return 'loading';
    }

    if (!this.authService.isAuthenticated()) {
      return 'signedOut';
    }

    const appUser = this.session()?.appUser;

    if (!appUser) {
      return 'preparing';
    }

    return appUser.status === 'Activo' ? 'loading' : 'pending';
  });

  readonly displayName = computed(() => {
    const session = this.session();

    return session?.appUser?.name ?? session?.displayName ?? session?.email ?? 'Usuario SPAI';
  });

  constructor() {
    this.idleIntervalId = window.setInterval(() => this.playIdlePose(), 7600);
  }

  ngOnDestroy(): void {
    if (this.idleIntervalId !== null) {
      window.clearInterval(this.idleIntervalId);
    }

    this.clearPoseReset();
  }

  async signIn(): Promise<void> {
    this.errorSignal.set('');
    this.busySignal.set(true);

    try {
      await this.authService.signInWithGoogle();
    } catch (error) {
      console.error('No se pudo iniciar sesion con Google', error);
      const message = error instanceof Error ? error.message : '';
      this.errorSignal.set(
        message.includes('@tecplayacar.edu.mx')
          ? message
          : 'No se pudo iniciar sesion con Google. Intenta nuevamente con tu correo institucional.',
      );
    } finally {
      this.busySignal.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.errorSignal.set('');
    await this.authService.signOut();
  }

  private playIdlePose(): void {
    if (this.mascotPoseSignal() !== 'base') {
      return;
    }

    this.mascotPoseSignal.set('saludo');
    this.clearPoseReset();
    this.poseResetTimeoutId = window.setTimeout(() => {
      if (this.mascotPoseSignal() === 'saludo') {
        this.mascotPoseSignal.set('base');
      }
    }, 2600);
  }

  private clearPoseReset(): void {
    if (this.poseResetTimeoutId !== null) {
      window.clearTimeout(this.poseResetTimeoutId);
      this.poseResetTimeoutId = null;
    }
  }
}
