import { inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type ProgramStatus = 'Activo' | 'Inactivo';

export interface AcademicProgram {
  id: string;
  code: string;
  name: string;
  academicArea: string;
  programType: string;
  modality: string;
  coordinator: string;
  status: ProgramStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertProgramPayload {
  code: string;
  name: string;
  academicArea: string;
  programType: string;
  modality: string;
  coordinator: string;
  status: ProgramStatus;
}

export const PROGRAMS_COLLECTION = 'programas';

@Injectable({ providedIn: 'root' })
export class ProgramsRepository extends FirestoreRepository<AcademicProgram> {
  readonly programs = this.items;

  constructor() {
    super(inject(FIREBASE_DB), PROGRAMS_COLLECTION, orderBy('name', 'asc'));
  }

  upsertProgram(payload: UpsertProgramPayload): Promise<void> {
    const timestamp = new Date().toISOString();
    const id = this.normalizeCode(payload.code);
    const currentProgram = this.programs().find((program) => program.id === id);

    return this.setDocument(id, {
      code: id,
      name: payload.name.trim(),
      academicArea: payload.academicArea.trim(),
      programType: payload.programType,
      modality: payload.modality,
      coordinator: payload.coordinator.trim(),
      status: payload.status,
      createdAt: currentProgram?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  }

  hasProgramCode(code: string): boolean {
    const normalizedCode = this.normalizeCode(code);

    return this.programs().some((program) => program.code === normalizedCode);
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }
}
