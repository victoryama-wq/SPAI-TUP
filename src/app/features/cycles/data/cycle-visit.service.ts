import { Injectable, signal } from '@angular/core';

/** Presentation state only. The authorized route may be recreated when a
 * profile snapshot changes; that does not constitute another module visit. */
@Injectable({ providedIn: 'root' })
export class CycleVisitService {
  private key = '';
  readonly dismissed = signal(false);
  resolved = false;
  shown = false;
  cycleId: string | null = null;
  enter(authUid: string, navigationId: number): void {
    const key = `${authUid}:${navigationId}`;
    if (key === this.key) return;
    this.key = key;
    this.dismissed.set(false);
    this.resolved = false;
    this.shown = false;
    this.cycleId = null;
  }
}
