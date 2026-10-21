import { randomId } from '../../../core/utils/random-id';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB, FIREBASE_FUNCTIONS } from '../../../core/firebase/firebase.tokens';
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
  readonly cycles = this.items;
  readonly operativeCycles = computed(() => this.cycles().filter(c => ['Preparacion','Captura','Captura cerrada'].includes(c.status)));
  readonly inconsistent = computed(() => this.operativeCycles().length > 1);
  readonly activeCycle = computed(() => this.operativeCycles().length === 1 ? this.operativeCycles()[0] : null);
  readonly contextError = signal('');
  readonly contextReady = signal(false);
  readonly captureMessage = computed(() => !this.ready() ? this.readMessage() : this.contextError() || (this.inconsistent()
    ? 'Inconsistencia: hay varios ciclos operativos. No se seleccionó ninguno; solicita revisión a Sistemas.'
    : !this.activeCycle() ? 'No hay ciclo operativo. Los históricos continúan disponibles para consulta.'
    : this.activeCycle()?.status === 'Captura' ? '' : `Ciclo en ${this.activeCycle()?.status}: captura académica ordinaria bloqueada.`));
  constructor() {
    super(inject(FIREBASE_DB), CYCLES_COLLECTION, orderBy('createdAt', 'desc'));
    effect(onCleanup => {
      const rows = this.cycles(); const ready = this.ready();
      this.contextReady.set(false); this.contextError.set(''); let cancelled = false;
      onCleanup(() => { cancelled = true; });
      if (!ready) return;
      void rows;
      httpsCallable(this.functions, 'cycleContext')({}).then(() => { if (!cancelled) this.contextReady.set(true); })
        .catch(() => { if (!cancelled) this.contextError.set('No se pudo verificar el ciclo en servidor. Recarga para reintentar.'); });
    });
  }
  /** A prepared command keeps its revision and id across confirmation/retries. */
  prepare(action: string, cycle?: AcademicCycle, extra: Record<string, unknown> = {}) {
    return {action, operationId:randomId(), ...(cycle ? {cycleId:cycle.id,expectedRevision:cycle.revision??0} : {}), ...extra};
  }
  async confirm(command: Record<string, unknown>): Promise<void> { await httpsCallable(this.functions, 'cycleCommand')(command); }
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
