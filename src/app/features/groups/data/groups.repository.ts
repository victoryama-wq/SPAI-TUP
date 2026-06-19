import { inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type GroupModality = 'Escolarizado' | 'Ejecutivo' | 'Virtual' | 'No identificada';
export type GroupShift = 'Matutino' | 'Vespertino' | 'Nocturno' | 'No identificado';
export type GroupStatus = 'Activo' | 'Inactivo';

export interface AcademicGroup {
  id: string;
  fullGroup: string;
  cycleCode: string;
  programAbbreviation: string;
  groupCode: string;
  section: string;
  programName: string;
  modality: GroupModality;
  shift: GroupShift;
  academicArea: string;
  status: GroupStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertGroupPayload {
  fullGroup: string;
  cycleCode: string;
  programAbbreviation: string;
  groupCode: string;
  section: string;
  programName: string;
  modality: GroupModality;
  shift: GroupShift;
  academicArea: string;
  status: GroupStatus;
}

export const GROUPS_COLLECTION = 'grupos';

@Injectable({ providedIn: 'root' })
export class GroupsRepository extends FirestoreRepository<AcademicGroup> {
  readonly groups = this.items;

  constructor() {
    super(inject(FIREBASE_DB), GROUPS_COLLECTION, orderBy('fullGroup', 'asc'));
  }

  upsertGroup(payload: UpsertGroupPayload): Promise<void> {
    const timestamp = new Date().toISOString();
    const id = this.createGroupId(payload.fullGroup);
    const currentGroup = this.groups().find((group) => group.id === id);

    return this.setDocument(id, {
      fullGroup: this.normalizeFullGroup(payload.fullGroup),
      cycleCode: payload.cycleCode.trim(),
      programAbbreviation: payload.programAbbreviation.trim().toUpperCase(),
      groupCode: payload.groupCode.trim(),
      section: payload.section.trim().toUpperCase(),
      programName: payload.programName.trim(),
      modality: payload.modality,
      shift: payload.shift,
      academicArea: payload.academicArea.trim(),
      status: payload.status,
      createdAt: currentGroup?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  }

  async importGroups(groups: UpsertGroupPayload[]): Promise<void> {
    await Promise.all(groups.map((group) => this.upsertGroup(group)));
  }

  deleteGroup(id: string): Promise<void> {
    return this.deleteDocument(id);
  }

  async deleteGroups(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => this.deleteGroup(id)));
  }

  hasFullGroup(fullGroup: string): boolean {
    const id = this.createGroupId(fullGroup);
    return this.groups().some((group) => group.id === id);
  }

  createGroupId(fullGroup: string): string {
    return this.normalizeFullGroup(fullGroup).replace(/[^A-Z0-9]+/g, '_');
  }

  private normalizeFullGroup(fullGroup: string): string {
    return fullGroup.trim().replace(/\s+/g, ' ').toUpperCase();
  }
}
