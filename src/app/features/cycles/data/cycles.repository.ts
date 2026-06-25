import { computed, inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type CycleStatus = 'Preparacion' | 'Captura' | 'Captura cerrada' | 'Cerrado';

export interface AcademicCycle {
  id: string;
  code: string;
  label: string;
  status: CycleStatus;
  notes: string;
  createdAt: string;
  captureStartedAt: string | null;
  tentativeCaptureCloseAt?: string | null;
  captureClosedAt: string | null;
  closedAt: string | null;
}

export interface CreateCyclePayload {
  code: string;
  label: string;
  notes: string;
  tentativeCaptureCloseAt?: string | null;
}

export const CYCLES_COLLECTION = 'ciclos';

@Injectable({ providedIn: 'root' })
export class CyclesRepository extends FirestoreRepository<AcademicCycle> {
  readonly cycles = this.items;
  readonly activeCycle = computed(
    () =>
      this.cycles().find(
        (cycle) => cycle.status === 'Captura' || cycle.status === 'Captura cerrada',
      ) ?? null,
  );

  constructor() {
    super(inject(FIREBASE_DB), CYCLES_COLLECTION, orderBy('createdAt', 'desc'));
  }

  createCycle(payload: CreateCyclePayload): Promise<unknown> {
    const timestamp = new Date().toISOString();
    const cycle: Omit<AcademicCycle, 'id'> = {
      code: payload.code.trim(),
      label: payload.label.trim(),
      notes: payload.notes.trim(),
      status: 'Preparacion',
      createdAt: timestamp,
      captureStartedAt: null,
      tentativeCaptureCloseAt: payload.tentativeCaptureCloseAt || null,
      captureClosedAt: null,
      closedAt: null,
    };

    return this.addDocument(cycle as unknown as Record<string, unknown>);
  }

  startCapture(cycleId: string): Promise<void> | void {
    const timestamp = new Date().toISOString();
    const cycle = this.cycles().find((item) => item.id === cycleId);

    if (!cycle) {
      return;
    }

    return this.updateDocument(cycleId, {
      status: 'Captura',
      captureStartedAt: cycle.captureStartedAt ?? timestamp,
      captureClosedAt: null,
    });
  }

  closeCapture(cycleId: string): Promise<void> | void {
    const timestamp = new Date().toISOString();
    const cycle = this.cycles().find((item) => item.id === cycleId);

    if (!cycle) {
      return;
    }

    return this.updateDocument(cycleId, {
      status: 'Captura cerrada',
      captureClosedAt: cycle.captureClosedAt ?? timestamp,
    });
  }

  reopenCapture(cycleId: string): Promise<void> | void {
    const timestamp = new Date().toISOString();
    const cycle = this.cycles().find((item) => item.id === cycleId);

    if (!cycle) {
      return;
    }

    return this.updateDocument(cycleId, {
      status: 'Captura',
      captureStartedAt: cycle.captureStartedAt ?? timestamp,
      captureClosedAt: null,
      closedAt: null,
    });
  }

  closeCycle(cycleId: string): Promise<void> | void {
    const timestamp = new Date().toISOString();
    const cycle = this.cycles().find((item) => item.id === cycleId);

    if (!cycle) {
      return;
    }

    return this.updateDocument(cycleId, {
      status: 'Cerrado',
      closedAt: cycle.closedAt ?? timestamp,
    });
  }

  updateTentativeCaptureClose(cycleId: string, tentativeCaptureCloseAt: string | null): Promise<void> {
    return this.updateDocument(cycleId, {
      tentativeCaptureCloseAt,
    });
  }

  deleteCycle(cycleId: string): Promise<void> {
    return this.deleteDocument(cycleId);
  }

  hasCycleCode(code: string): boolean {
    const normalizedCode = code.trim().toLowerCase();
    return this.cycles().some((cycle) => cycle.code.toLowerCase() === normalizedCode);
  }
}
