import { computed, inject, Injectable } from '@angular/core';
import { addDoc, collection, doc, getDocFromServer, orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type AssignmentStatus = 'EN_CAPTURA' | 'EN_REVISION' | 'CARGADO_MOODLE' | 'VALIDADO' | 'CON_OBSERVACION';
export type AssignmentType = 'REGULAR' | 'ESPECIAL' | 'CURSO_ESPECIAL' | 'PROPEDEUTICO';

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
  assignmentType?: AssignmentType;
  shared: boolean;
  sourceAssignmentId: string;
  sharedGroups?: string[];
  sharedPrograms?: string[];
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
  assignmentType?: AssignmentType;
  shared: boolean;
  sourceAssignmentId?: string;
  sharedGroups?: string[];
  sharedPrograms?: string[];
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

export interface AssignmentStatusUpdatePayload {
  status: AssignmentStatus;
  updatedBy: string;
  updatedByName: string;
  updatedByRole: string;
}

export const ASSIGNMENTS_COLLECTION = 'asignaciones';

@Injectable({ providedIn: 'root' })
export class AssignmentsRepository extends FirestoreRepository<AcademicAssignment> {
  readonly assignments = computed(() => this.items().filter((assignment) => !assignment.deletedAt));

  constructor() {
    super(inject(FIREBASE_DB), ASSIGNMENTS_COLLECTION, orderBy('updatedAt', 'desc'));
  }

  async upsertAssignment(payload: UpsertAssignmentPayload): Promise<string> {
    const timestamp = new Date().toISOString();
    const documentId = payload.id ?? null;
    const currentAssignment = this.assignments().find((assignment) => assignment.id === documentId);
    const normalizedMoodleId = this.normalizeMoodleId(payload.moodleId);
    const assignmentDocument = {
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
      assignmentType: payload.assignmentType ?? (payload.special ? 'ESPECIAL' : 'REGULAR'),
      shared: payload.shared,
      sourceAssignmentId: payload.sourceAssignmentId?.trim() ?? '',
      sharedGroups: this.normalizeList(payload.sharedGroups ?? []),
      sharedPrograms: this.normalizeList(payload.sharedPrograms ?? []),
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
    };

    if (!documentId) {
      const createdDocument = await addDoc(
        collection(this.firestore, this.collectionPath),
        assignmentDocument,
      );

      await this.verifySavedAssignment(createdDocument.id, timestamp);

      return createdDocument.id;
    }

    await this.setDocument(documentId, assignmentDocument);
    await this.verifySavedAssignment(documentId, timestamp);

    return documentId;
  }

  hasMoodleIdConflict(cycle: string, moodleId: string, subjectId: string, excludedId?: string | null): boolean {
    const normalizedMoodleId = this.normalizeMoodleId(moodleId);
    const normalizedCycle = cycle.trim();
    const normalizedSubjectId = subjectId.trim().toUpperCase();

    return this.assignments().some((assignment) => {
      return assignment.id !== excludedId
        && !assignment.deletedAt
        && assignment.cycle === normalizedCycle
        && assignment.normalizedMoodleId === normalizedMoodleId
        && assignment.subjectId === normalizedSubjectId
        && !assignment.sourceAssignmentId;
    });
  }

  normalizeMoodleId(value: string): string {
    return value.trim().toLowerCase();
  }

  deleteAssignment(id: string, _payload: DeleteAssignmentPayload): Promise<void> {
    return this.deleteDocument(id);
  }

  updateAssignmentStatus(id: string, payload: AssignmentStatusUpdatePayload): Promise<void> {
    return this.updateDocument(id, {
      status: payload.status,
      updatedBy: payload.updatedBy,
      updatedByName: payload.updatedByName,
      updatedByRole: payload.updatedByRole,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteAssignments(ids: string[], payload: DeleteAssignmentPayload): Promise<void> {
    await Promise.all(ids.map((id) => this.deleteAssignment(id, payload)));
  }

  private normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  private normalizeList(values: string[]): string[] {
    return Array.from(new Set(
      values.map((value) => value.trim().toUpperCase()).filter(Boolean),
    ));
  }

  private async verifySavedAssignment(documentId: string, updatedAt: string): Promise<void> {
    const snapshot = await getDocFromServer(doc(this.firestore, this.collectionPath, documentId));
    const savedUpdatedAt = snapshot.data()?.['updatedAt'];

    if (!snapshot.exists() || savedUpdatedAt !== updatedAt) {
      throw new Error('La asignacion no se confirmo en Firestore.');
    }
  }
}
