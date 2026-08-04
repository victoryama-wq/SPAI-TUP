import { computed, inject, Injectable } from '@angular/core';
import { collection, doc, getDocFromServer, getDocsFromServer, orderBy, query, setDoc, waitForPendingWrites, where } from 'firebase/firestore';
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
const ASSIGNMENT_SAVE_TIMEOUT_MS = 30000;
const ASSIGNMENT_VERIFY_TIMEOUT_MS = 10000;
const ASSIGNMENT_DELETE_TIMEOUT_MS = 12000;

@Injectable({ providedIn: 'root' })
export class AssignmentsRepository extends FirestoreRepository<AcademicAssignment> {
  readonly assignments = computed(() => this.items().filter((assignment) => !assignment.deletedAt));

  constructor() {
    super(inject(FIREBASE_DB), ASSIGNMENTS_COLLECTION, orderBy('updatedAt', 'desc'));
  }

  async upsertAssignment(payload: UpsertAssignmentPayload): Promise<string> {
    const timestamp = new Date().toISOString();
    const requestedDocumentId = payload.id?.trim() || null;
    const localAssignment = requestedDocumentId
      ? this.assignments().find((assignment) => assignment.id === requestedDocumentId) ?? null
      : null;
    const serverAssignment = requestedDocumentId && !localAssignment
      ? await this.findAssignmentById(requestedDocumentId)
      : null;
    const normalizedMoodleId = this.normalizeMoodleId(payload.moodleId);
    const assignmentType = payload.assignmentType ?? (payload.special ? 'ESPECIAL' : 'REGULAR');
    const normalizedPayload = {
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
      assignmentType,
      shared: payload.shared,
      sourceAssignmentId: payload.sourceAssignmentId?.trim() ?? '',
      sharedGroups: this.normalizeList(payload.sharedGroups ?? []),
      sharedPrograms: this.normalizeList(payload.sharedPrograms ?? []),
      special: payload.special ?? false,
      studentEnrollments: payload.studentEnrollments?.trim() ?? '',
    };
    const localMatchingAssignment = requestedDocumentId
      ? null
      : this.findMatchingAssignmentInList(normalizedPayload, this.assignments());
    const existingAssignment = localAssignment
      ?? serverAssignment
      ?? localMatchingAssignment
      ?? (requestedDocumentId ? null : await this.findExistingAssignmentForPayload(normalizedPayload));
    const targetDocumentId = requestedDocumentId
      ?? existingAssignment?.id
      ?? this.buildAssignmentDocumentId(normalizedPayload);
    const assignmentDocument = {
      ...normalizedPayload,
      createdBy: existingAssignment?.createdBy ?? payload.createdBy,
      createdByName: existingAssignment?.createdByName ?? payload.createdByName,
      createdByRole: existingAssignment?.createdByRole ?? payload.createdByRole,
      createdByPrograms: existingAssignment?.createdByPrograms ?? payload.createdByPrograms,
      createdAt: existingAssignment?.createdAt ?? timestamp,
      updatedBy: payload.createdBy,
      updatedByName: payload.createdByName,
      updatedByRole: payload.createdByRole,
      updatedAt: timestamp,
      deletedAt: null,
      deletedBy: '',
      deletedByName: '',
      deletedByRole: '',
    };

    await this.withFirestoreTimeout(
      setDoc(doc(this.firestore, this.collectionPath, targetDocumentId), assignmentDocument, { merge: true }),
      ASSIGNMENT_SAVE_TIMEOUT_MS,
      requestedDocumentId
        ? 'Firestore no confirmo la actualizacion de la asignacion. Revisa conexion e intenta de nuevo.'
        : 'Firestore no confirmo el guardado de la asignacion. Revisa conexion e intenta de nuevo.',
    );

    await this.withFirestoreTimeout(
      waitForPendingWrites(this.firestore),
      ASSIGNMENT_VERIFY_TIMEOUT_MS,
      'Firestore no confirmo la escritura de la asignacion. Revisa conexion e intenta de nuevo.',
    );

    await this.verifyAssignmentPersisted(targetDocumentId, assignmentDocument);
    return targetDocumentId;
  }

  async countActiveAssignmentsByCreator(cycle: string, createdBy: string): Promise<number> {
    const assignmentsQuery = query(
      collection(this.firestore, this.collectionPath),
      where('cycle', '==', cycle.trim()),
      where('createdBy', '==', createdBy),
    );
    const snapshot = await this.withFirestoreTimeout(
      getDocsFromServer(assignmentsQuery),
      ASSIGNMENT_VERIFY_TIMEOUT_MS,
      'Firestore no respondio al calcular el avance de asignaciones.',
    );

    return snapshot.docs.filter((item) => !item.data()['deletedAt']).length;
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

  hasGroupSubjectConflict(cycle: string, group: string, subjectId: string, excludedId?: string | null): boolean {
    const normalizedCycle = cycle.trim();
    const normalizedGroup = group.trim().toUpperCase();
    const normalizedSubjectId = subjectId.trim().toUpperCase();

    if (!normalizedCycle || !normalizedGroup || !normalizedSubjectId) {
      return false;
    }

    return this.assignments().some((assignment) => {
      return assignment.id !== excludedId
        && !assignment.deletedAt
        && assignment.cycle === normalizedCycle
        && assignment.group === normalizedGroup
        && assignment.subjectId === normalizedSubjectId
        && !assignment.sourceAssignmentId;
    });
  }

  normalizeMoodleId(value: string): string {
    return value.trim().toLowerCase();
  }

  deleteAssignment(id: string, _payload: DeleteAssignmentPayload): Promise<void> {
    return this.withFirestoreTimeout(
      this.deleteDocument(id),
      ASSIGNMENT_DELETE_TIMEOUT_MS,
      'Firestore no respondio al eliminar la asignacion. Revisa conexion e intenta de nuevo.',
    );
  }

  async updateAssignmentStatus(id: string, payload: AssignmentStatusUpdatePayload): Promise<void> {
    await this.withFirestoreTimeout(
      this.updateDocument(id, {
      status: payload.status,
      updatedBy: payload.updatedBy,
      updatedByName: payload.updatedByName,
      updatedByRole: payload.updatedByRole,
      updatedAt: new Date().toISOString(),
      }),
      ASSIGNMENT_SAVE_TIMEOUT_MS,
      'Firestore no confirmo la actualizacion del estado de la asignacion. Revisa conexion e intenta de nuevo.',
    );

    await this.withFirestoreTimeout(
      waitForPendingWrites(this.firestore),
      ASSIGNMENT_VERIFY_TIMEOUT_MS,
      'Firestore no confirmo el cambio de estado de la asignacion. Revisa conexion e intenta de nuevo.',
    );
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

  private async findAssignmentById(id: string): Promise<AcademicAssignment | null> {
    const snapshot = await this.withFirestoreTimeout(
      getDocFromServer(doc(this.firestore, this.collectionPath, id)),
      ASSIGNMENT_VERIFY_TIMEOUT_MS,
      'No se pudo confirmar la asignacion existente en Firestore.',
    );

    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as AcademicAssignment) : null;
  }

  private findMatchingAssignmentInList(
    payload: Pick<
      AcademicAssignment,
      'cycle' | 'program' | 'group' | 'subjectId' | 'normalizedMoodleId' | 'assignmentType' | 'studentEnrollments'
    >,
    assignments: AcademicAssignment[],
  ): AcademicAssignment | null {
    const targetType = payload.assignmentType ?? 'REGULAR';
    const targetEnrollments = this.normalizeComparison(payload.studentEnrollments ?? '');

    return assignments
      .filter((assignment) => !assignment.deletedAt)
      .find((assignment) => {
        const existingType = assignment.assignmentType ?? (assignment.special ? 'ESPECIAL' : 'REGULAR');

        return assignment.cycle === payload.cycle
          && assignment.group === payload.group
          && assignment.program === payload.program
          && assignment.subjectId === payload.subjectId
          && assignment.normalizedMoodleId === payload.normalizedMoodleId
          && existingType === targetType
          && (!payload.group ? this.normalizeComparison(assignment.studentEnrollments ?? '') === targetEnrollments : true);
      }) ?? null;
  }

  private async findExistingAssignmentForPayload(
    payload: Pick<
      AcademicAssignment,
      'cycle' | 'program' | 'group' | 'subjectId' | 'normalizedMoodleId' | 'assignmentType' | 'studentEnrollments'
    >,
  ): Promise<AcademicAssignment | null> {
    try {
      const snapshot = await this.withFirestoreTimeout(
        getDocsFromServer(query(
          collection(this.firestore, this.collectionPath),
          where('cycle', '==', payload.cycle),
          where('group', '==', payload.group),
        )),
        ASSIGNMENT_VERIFY_TIMEOUT_MS,
        'No se pudo revisar si la asignacion ya existia.',
      );

      return this.findMatchingAssignmentInList(
        payload,
        snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as AcademicAssignment),
      );
    } catch (error) {
      console.warn('No se pudo revisar duplicados de asignacion antes de guardar.', error);
      return null;
    }
  }

  private async verifyAssignmentPersisted(
    id: string,
    expected: Pick<
      AcademicAssignment,
      'cycle' | 'program' | 'group' | 'subjectId' | 'normalizedMoodleId' | 'updatedAt'
    >,
  ): Promise<void> {
    const snapshot = await this.withFirestoreTimeout(
      getDocFromServer(doc(this.firestore, this.collectionPath, id)),
      ASSIGNMENT_VERIFY_TIMEOUT_MS,
      'Firestore recibio la solicitud, pero no se pudo confirmar el guardado desde servidor.',
    );

    if (!snapshot.exists()) {
      throw new Error('Firestore no devolvio la asignacion guardada. No se marco como guardada.');
    }

    const saved = snapshot.data();
    const confirmed = saved['cycle'] === expected.cycle
      && saved['program'] === expected.program
      && saved['group'] === expected.group
      && saved['subjectId'] === expected.subjectId
      && saved['normalizedMoodleId'] === expected.normalizedMoodleId
      && saved['updatedAt'] === expected.updatedAt
      && !saved['deletedAt'];

    if (!confirmed) {
      throw new Error('Firestore respondio, pero la asignacion no coincide con la informacion guardada.');
    }
  }

  private buildAssignmentDocumentId(
    payload: Pick<
      AcademicAssignment,
      'cycle' | 'program' | 'group' | 'subjectId' | 'normalizedMoodleId' | 'assignmentType' | 'studentEnrollments'
    >,
  ): string {
    const baseParts = [
      payload.cycle,
      payload.program,
      payload.group || 'SIN_GRUPO',
      payload.subjectId,
      payload.normalizedMoodleId,
      payload.assignmentType ?? 'REGULAR',
      payload.group ? '' : (payload.studentEnrollments ?? ''),
    ];

    return this.normalizeDocumentId(baseParts.join('__'));
  }

  private normalizeDocumentId(value: string): string {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180);

    return normalized || `asignacion-${Date.now()}`;
  }

  private normalizeComparison(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  private withFirestoreTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);

      operation
        .then((value) => {
          clearTimeout(timeout);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}
