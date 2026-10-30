import { randomId } from '../../../core/utils/random-id';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB, FIREBASE_FUNCTIONS } from '../../../core/firebase/firebase.tokens';
import { UserSessionService } from '../../../core/auth/user-session.service';
export type CycleStatus = 'Preparacion' | 'Captura' | 'Captura cerrada' | 'Cerrado';
export interface AcademicCycle {
  id: string; code: string; label: string; status: CycleStatus; notes: string;
  createdAt: string; captureStartedAt: string | null; tentativeCaptureCloseAt?: string | null;
  captureClosedAt: string | null; closedAt: string | null;
  revision?: number; specialsEnabled?: boolean;
}
export interface CreateCyclePayload { code: string; label: string; notes: string; tentativeCaptureCloseAt?: string | null; }
export const CYCLES_COLLECTION = 'ciclos';
@Injectable({ providedIn: 'root' })
export class CyclesRepository extends FirestoreRepository<AcademicCycle> {
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly session = inject(UserSessionService);
  readonly cycles = this.items;
  readonly operativeCycles = computed(() => this.cycles().filter(c => ['Preparacion','Captura','Captura cerrada'].includes(c.status)));
  readonly multipleOperative = computed(() => this.operativeCycles().length > 1);
  readonly overLimit = computed(() => this.cycles().length > 2);
  readonly inconsistent = computed(() => this.multipleOperative() || this.overLimit());
  readonly activeCycle = computed(() => this.operativeCycles().length === 1 ? this.operativeCycles()[0] : null);
  readonly contextError = signal('');
  private readonly verifiedContext = signal('');
  readonly refreshing = signal(false);
  readonly refreshError = signal('');
  readonly confirmedPendingRefresh = signal(false);
  readonly mutationPending = signal(false);
  private refreshAttempt = 0;
  private readonly contextVersion = computed(() => JSON.stringify({
    actor: this.session.session(),
    cycles: this.cycles().map(c => [c.id, c.revision, c.code, c.status, c.specialsEnabled]),
  }));
  private readonly contextRetry = signal(0);
  readonly contextReady = computed(() => this.ready() && this.verifiedContext() === this.contextVersion()
    && !this.refreshing() && !this.mutationPending() && !this.confirmedPendingRefresh() && !this.refreshError());
  readonly updating = computed(() => this.refreshing() || this.mutationPending());
  readonly captureMessage = computed(() => !this.ready() ? this.readMessage() : this.refreshError()
    || (this.updating() ? 'Actualizando el estado autorizado…' : '') || this.contextError() || (this.inconsistent()
    ? (this.overLimit() ? 'Inconsistencia: hay más de dos ciclos registrados. No se eliminará ningún registro automáticamente; solicita revisión a Sistemas.' : 'Inconsistencia: hay varios ciclos operativos. No se seleccionó ninguno; solicita revisión a Sistemas.')
    : !this.activeCycle() ? 'No hay ciclo operativo. Los históricos continúan disponibles para consulta.'
    : this.activeCycle()?.status === 'Captura' ? '' : `Ciclo en ${this.activeCycle()?.status}: captura académica ordinaria bloqueada.`));
  constructor() {
    super(inject(FIREBASE_DB), CYCLES_COLLECTION, orderBy('createdAt', 'desc'));
    effect(onCleanup => {
      const version = this.contextVersion(); const ready = this.ready(); this.contextRetry();
      this.verifiedContext.set(''); this.contextError.set(''); let cancelled = false;
      onCleanup(() => { cancelled = true; });
      if (!ready) return;
      // Metadata-only snapshots and identical query results do not require
      // another context write. Permission/profile changes still invalidate it.
      void version;
      httpsCallable(this.functions, 'cycleContext')({}).then(() => { if (!cancelled) this.verifiedContext.set(version); })
        .catch(() => { if (!cancelled) this.contextError.set('No se pudo verificar el ciclo en servidor. Reintenta la consulta.'); });
    });
  }
  /** A prepared command keeps its revision and id across confirmation/retries. */
  prepare(action: string, cycle?: AcademicCycle, extra: Record<string, unknown> = {}) {
    return {action, operationId:randomId(), ...(cycle ? {cycleId:cycle.id,expectedRevision:cycle.revision??0} : {}), ...extra};
  }
  async confirm(command: Record<string, unknown>): Promise<void> {
    // An acknowledged mutation and a failed read are different outcomes. Never
    // retry cycleCommand just because its subsequent query failed.
    if (this.updating() || this.confirmedPendingRefresh() || this.refreshError()) throw new Error('Espera a que se verifique la actualización antes de confirmar otra operación.');
    this.mutationPending.set(true);
    try {
      try { await httpsCallable(this.functions, 'cycleCommand')(command); }
      catch (error) {
        await this.refreshFromServer().catch(() => undefined);
        throw error;
      }
      this.confirmedPendingRefresh.set(true);
      await this.refreshFromServer().catch(() => undefined);
    } finally { this.mutationPending.set(false); }
  }
  override async refreshFromServer(): Promise<void> {
    const attempt = ++this.refreshAttempt;
    this.refreshing.set(true);
    this.refreshError.set('');
    try {
      // Same authorized query as the live subscription; all consumers derive
      // their state from this repository, including assignment restrictions.
      await super.refreshFromServer();
      if (attempt !== this.refreshAttempt) return;
      this.confirmedPendingRefresh.set(false);
      if (this.contextError()) this.contextRetry.update(value => value + 1);
    } catch (error) {
      if (attempt !== this.refreshAttempt) throw error;
      this.refreshError.set(this.confirmedPendingRefresh()
        ? 'La operación se confirmó; no pudimos actualizar la vista.'
        : 'No pudimos actualizar el estado vigente. Reintenta la actualización.');
      throw error;
    } finally { if (attempt === this.refreshAttempt) this.refreshing.set(false); }
  }
  protected override retainVerifiedRowsOnRefresh(): boolean { return true; }
  protected override acceptsRefreshedRows(next: AcademicCycle[], current: AcademicCycle[], newerSnapshot: boolean): boolean {
    if (newerSnapshot && (next.length !== current.length || current.some(c => !next.some(n => n.id === c.id)))) return false;
    return current.every(c => !next.some(n => n.id === c.id && (n.revision ?? 0) < (c.revision ?? 0)));
  }
  async createCycle(payload: CreateCyclePayload): Promise<void> { await this.confirm(this.prepare('create',undefined,{payload})); }
  startCapture(id: string): Promise<void> { return this.change('start',id); }
  closeCapture(id: string): Promise<void> { return this.change('closeCapture',id); }
  reopenCapture(id: string, reason = ''): Promise<void> { return this.change('reopen',id,{reason}); }
  closeCycle(id: string): Promise<void> { return this.change('close',id); }
  updateTentativeCaptureClose(id: string, date: string | null): Promise<void> { return this.change('schedule',id,{date}); }
  deleteCycle(_id: string): Promise<void> { return Promise.reject(new Error('La depuración de ciclos corresponde a R04.')); }
  private change(action: string,id: string,extra: Record<string, unknown> = {}): Promise<void> {
    const cycle=this.cycles().find(c=>c.id===id);
    if (!cycle) return Promise.reject(new Error('Ciclo no disponible.'));
    return this.confirm(this.prepare(action,cycle,extra));
  }
  hasCycleCode(code: string): boolean { return this.cycles().some(c=>c.code.toLowerCase()===code.trim().toLowerCase()); }
}
