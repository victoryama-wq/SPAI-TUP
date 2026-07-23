import { DestroyRef, effect, inject, Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

const INACTIVITY_TIMEOUT_MS = 45 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 15 * 1000;
const ACTIVITY_EVENTS: ReadonlyArray<keyof WindowEventMap> = [
  'click',
  'keydown',
  'scroll',
  'touchstart',
  'pointerdown',
];

@Injectable({ providedIn: 'root' })
export class InactivityLogoutService {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly router = inject(Router);
  private isTracking = false;
  private lastActivityAt = Date.now();
  private logoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect((onCleanup) => {
      if (!this.authService.isAuthenticated() || !this.isBrowser()) {
        this.stopTracking();
        return;
      }

      this.ngZone.runOutsideAngular(() => this.startTracking());
      onCleanup(() => this.stopTracking());
    });

    this.destroyRef.onDestroy(() => this.stopTracking());
  }

  private startTracking(): void {
    if (this.isTracking) {
      this.scheduleLogout();
      return;
    }

    this.isTracking = true;
    this.lastActivityAt = Date.now();

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, this.recordActivity, { passive: true });
    }

    this.scheduleLogout();
  }

  private stopTracking(): void {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }

    if (!this.isTracking || !this.isBrowser()) {
      this.isTracking = false;
      return;
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.removeEventListener(eventName, this.recordActivity);
    }

    this.isTracking = false;
  }

  private readonly recordActivity = (): void => {
    const now = Date.now();

    if (now - this.lastActivityAt < ACTIVITY_THROTTLE_MS) {
      return;
    }

    this.lastActivityAt = now;
    this.scheduleLogout();
  };

  private scheduleLogout(): void {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
    }

    const remainingTime = Math.max(INACTIVITY_TIMEOUT_MS - (Date.now() - this.lastActivityAt), 0);

    this.logoutTimer = setTimeout(() => {
      void this.logoutAfterInactivity();
    }, remainingTime);
  }

  private async logoutAfterInactivity(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.stopTracking();
      return;
    }

    const inactiveTime = Date.now() - this.lastActivityAt;

    if (inactiveTime < INACTIVITY_TIMEOUT_MS) {
      this.scheduleLogout();
      return;
    }

    this.stopTracking();

    try {
      await this.ngZone.run(() => this.authService.signOut());
    } finally {
      await this.ngZone.run(() => this.router.navigate(['/']));
    }
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }
}
