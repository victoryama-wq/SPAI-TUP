import { computed, inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type AssignmentStatus = 'EN_CAPTURA' | 'EN_REVISION' | 'CARGADO_MOODLE' | 'VALIDADO' | 'CON_OBSERVACION';

export interface AcademicAssignment {
  id: string;
  cycle: string;
  program: string;
  group: string;
  subjectId: string;
  subjectName: string;
  moodleId: string;
  normalizedMoodleId: string;
  teacherMoodleUser: string;
  teacherName: string;
  status: AssignmentStatus;
  observations: string;
  shared: boolean;
  sourceAssignmentId: string;
  special: boolean;
  studentEnrollments: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdByPrograms: string[];
  createdAt: string;
  updatedBy: string;
  updatedByName: string;
  updatedByRole: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedBy?: string;
  deletedByName?: string;
  deletedByRole?: string;
}

export interface UpsertAssignmentPayload {
  id?: string | null;
  cycle: string;
  program: string;
  group: string;
  subjectId: string;
  subjectName: string;
  moodleId: string;
  teacherMoodleUser: string;
  teacherName: string;
  status: AssignmentStatus;
  observations: string;
  shared: boolean;
  sourceAssignmentId?: string;
  special?: boolean;
  studentEnrollments?: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdByPrograms: string[];
}

export interface DeleteAssignmentPayload {
  deletedBy: string;
  deletedByName: string;
  deletedByRole: string;
}

export const ASSIGNMENTS_COLLECTION = 'asignaciones';

@Injectable({ providedIn: 'root' })
export class AssignmentsRepository extends FirestoreRepository<AcademicAssignment> {
  readonly assignments = computed(() => this.items().filter((assignment) => !assignment.deletedAt));

  constructor() {
    super(inject(FIREBASE_DB), ASSIGNMENTS_COLLECTION, orderBy('updatedAt', 'desc'));
  }

  upsertAssignment(payload: UpsertAssignmentPayload): string {
    const timestamp = new Date().toISOString();
    const documentId = payload.id || this.createAssignmentId(payload);
    const currentAssignment = this.assignments().find((assignment) => assignment.id === documentId);
    const normalizedMoodleId = this.normalizeMoodleId(payload.moodleId);

    void this.setDocument(documentId, {
      cycle: payload.cycle.trim(),
      program: payload.program.trim().toUpperCase(),
      group: payload.group.trim().toUpperCase(),
      subjectId: payload.subjectId.trim().toUpperCase(),
      subjectName: this.normalizeName(payload.subjectName),
      moodleId: normalizedMoodleId,
      normalizedMoodleId,
      teacherMoodleUser: payload.teacherMoodleUser.trim().toLowerCase(),
      teacherName: this.normalizeName(payload.teacherName),
      status: payload.status,
      observations: payload.observations.trim(),
      shared: payload.shared,
      sourceAssignmentId: payload.shared ? payload.sourceAssignmentId?.trim() ?? '' : '',
      special: payload.special ?? false,
      studentEnrollments: payload.studentEnrollments?.trim() ?? '',
      createdBy: currentAssignment?.createdBy ?? payload.createdBy,
      createdByName: currentAssignment?.createdByName ?? payload.createdByName,
      createdByRole: currentAssignment?.createdByRole ?? payload.createdByRole,
      createdByPrograms: currentAssignment?.createdByPrograms ?? payload.createdByPrograms,
      createdAt: currentAssignment?.createdAt ?? timestamp,
      updatedBy: payload.createdBy,
      updatedByName: payload.createdByName,
      updatedByRole: payload.createdByRole,
      updatedAt: timestamp,
      deletedAt: null,
      deletedBy: '',
      deletedByName: '',
      deletedByRole: '',
    });

    return documentId;
  }

  hasMoodleIdConflict(cycle: string, moodleId: string, excludedId?: string | null): boolean {
    const normalizedMoodleId = this.normalizeMoodleId(moodleId);
    const normalizedCycle = cycle.trim();

    return this.assignments().some((assignment) => {
      return assignment.id !== excludedId
        && !assignment.deletedAt
        && assignment.cycle === normalizedCycle
        && assignment.normalizedMoodleId === normalizedMoodleId
        && !assignment.shared;
    });
  }

  normalizeMoodleId(value: string): string {
    return value.trim().toLowerCase();
  }

  deleteAssignment(id: string, payload: DeleteAssignmentPayload): Promise<void> {
    return this.deleteDocument(id).catch(() => this.archiveAssignment(id, payload));
  }

  async deleteAssignments(ids: string[], payload: DeleteAssignmentPayload): Promise<void> {
    await Promise.all(ids.map((id) => this.deleteAssignment(id, payload)));
  }

  private archiveAssignment(id: string, payload: DeleteAssignmentPayload): Promise<void> {
    return this.updateDocument(id, {
      deletedAt: new Date().toISOString(),
      deletedBy: payload.deletedBy,
      deletedByName: payload.deletedByName,
      deletedByRole: payload.deletedByRole,
      updatedAt: new Date().toISOString(),
    });
  }

  private createAssignmentId(payload: UpsertAssignmentPayload): string {
    return [
      payload.cycle,
      payload.special ? 'ESPECIAL' : payload.group,
      payload.subjectId,
      this.normalizeMoodleId(payload.moodleId),
    ]
      .join('_')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9._-]+/g, '_');
  }

  private normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toUpperCase();
  }
}
