import { inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type NomenclatureStatus = 'ACTIVA' | 'INACTIVA';

export interface ProgramNomenclature {
  id: string;
  abbreviation: string;
  programCode: string;
  programName: string;
  planName: string;
  planCode: string;
  status: NomenclatureStatus;
  usageCount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNomenclaturePayload {
  abbreviation: string;
  programCode: string;
  programName: string;
  planName: string;
  planCode: string;
  status: NomenclatureStatus;
  notes: string;
}

export type UpdateNomenclaturePayload = CreateNomenclaturePayload;

export const NOMENCLATURES_COLLECTION = 'nomenclaturas_programas';

@Injectable({ providedIn: 'root' })
export class NomenclaturesRepository extends FirestoreRepository<ProgramNomenclature> {
  readonly nomenclatures = this.items;

  constructor() {
    super(inject(FIREBASE_DB), NOMENCLATURES_COLLECTION, orderBy('abbreviation', 'asc'));
  }

  createNomenclature(payload: CreateNomenclaturePayload): Promise<unknown> {
    const timestamp = new Date().toISOString();

    return this.addDocument({
      abbreviation: this.normalizeAbbreviation(payload.abbreviation),
      programCode: this.normalizeCode(payload.programCode),
      programName: payload.programName.trim(),
      planName: payload.planName.trim(),
      planCode: this.normalizeCode(payload.planCode),
      status: payload.status,
      usageCount: 0,
      notes: payload.notes.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  updateNomenclature(id: string, payload: UpdateNomenclaturePayload): Promise<void> {
    return this.updateDocument(id, {
      abbreviation: this.normalizeAbbreviation(payload.abbreviation),
      programCode: this.normalizeCode(payload.programCode),
      programName: payload.programName.trim(),
      planName: payload.planName.trim(),
      planCode: this.normalizeCode(payload.planCode),
      status: payload.status,
      notes: payload.notes.trim(),
      updatedAt: new Date().toISOString(),
    });
  }

  async upsertNomenclature(payload: CreateNomenclaturePayload): Promise<'created' | 'updated'> {
    const existing = this.nomenclatures().find(
      (item) => item.abbreviation === this.normalizeAbbreviation(payload.abbreviation),
    );

    if (existing) {
      await this.updateNomenclature(existing.id, payload);
      return 'updated';
    }

    await this.createNomenclature(payload);
    return 'created';
  }

  toggleStatus(id: string): void {
    const nomenclature = this.nomenclatures().find((item) => item.id === id);

    if (!nomenclature) {
      return;
    }

    void this.updateDocument(id, {
      status: nomenclature.status === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA',
      updatedAt: new Date().toISOString(),
    });
  }

  deleteIfUnused(id: string): void {
    const nomenclature = this.nomenclatures().find((item) => item.id === id);

    if (!nomenclature || nomenclature.usageCount > 0) {
      return;
    }

    void this.deleteDocument(id);
  }

  hasAbbreviation(abbreviation: string, ignoredId: string | null = null): boolean {
    const normalizedAbbreviation = this.normalizeAbbreviation(abbreviation);

    return this.nomenclatures().some(
      (item) => item.id !== ignoredId && item.abbreviation === normalizedAbbreviation,
    );
  }

  private normalizeAbbreviation(abbreviation: string): string {
    return abbreviation.trim().toUpperCase();
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }
}
