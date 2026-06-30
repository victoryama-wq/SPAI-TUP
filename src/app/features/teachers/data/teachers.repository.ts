import { inject, Injectable } from '@angular/core';
import { doc, getDocFromServer, orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type TeacherStatus = 'PENDIENTE' | 'VALIDADO' | 'INACTIVO';
export type TeacherOrigin = 'MANUAL' | 'CSV';

export interface Teacher {
  id: string;
  teacherCode: string;
  fullName: string;
  normalizedName: string;
  moodleUser: string;
  normalizedMoodleUser: string;
  status: TeacherStatus;
  origin: TeacherOrigin;
  email: string;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdByPrograms: string[];
  assignedCoordinatorIds?: string[];
  assignedCoordinatorNames?: string[];
  validatedBy: string;
  validatedAt: string;
  inactivatedBy: string;
  inactivatedAt: string;
  importId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface UpsertTeacherPayload {
  teacherCode?: string;
  fullName: string;
  moodleUser: string;
  status: TeacherStatus;
  origin: TeacherOrigin;
  email?: string;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdByPrograms: string[];
  assignedCoordinatorIds?: string[];
  assignedCoordinatorNames?: string[];
  importId?: string;
}

export const TEACHERS_COLLECTION = 'docentes';

@Injectable({ providedIn: 'root' })
export class TeachersRepository extends FirestoreRepository<Teacher> {
  readonly teachers = this.items;
  readonly teachersReadError = this.readError;

  constructor() {
    super(inject(FIREBASE_DB), TEACHERS_COLLECTION, orderBy('fullName', 'asc'));
  }

  async upsertTeacher(payload: UpsertTeacherPayload): Promise<void> {
    const timestamp = new Date().toISOString();
    const normalizedMoodleUser = this.normalizeMoodleUser(payload.moodleUser);
    const currentTeacher = this.teachers().find((teacher) => teacher.id === normalizedMoodleUser);
    const shouldValidate = payload.status === 'VALIDADO';
    const createdByPrograms = Array.from(new Set([
      ...(currentTeacher?.createdByPrograms ?? []).map((program) => program.trim().toUpperCase()).filter(Boolean),
      ...payload.createdByPrograms.map((program) => program.trim().toUpperCase()).filter(Boolean),
    ])).sort((a, b) => a.localeCompare(b, 'es'));

    await this.setDocument(normalizedMoodleUser, {
      teacherCode: payload.teacherCode?.trim() || currentTeacher?.teacherCode || this.createTeacherCode(),
      fullName: this.normalizeFullName(payload.fullName),
      normalizedName: this.normalizeSearchText(payload.fullName),
      moodleUser: normalizedMoodleUser,
      normalizedMoodleUser,
      status: payload.status,
      origin: payload.origin,
      email: payload.email?.trim().toLowerCase() ?? currentTeacher?.email ?? '',
      notes: payload.notes?.trim() ?? currentTeacher?.notes ?? '',
      createdBy: currentTeacher?.createdBy ?? payload.createdBy,
      createdByName: currentTeacher?.createdByName ?? payload.createdByName,
      createdByRole: currentTeacher?.createdByRole ?? payload.createdByRole,
      createdByPrograms,
      assignedCoordinatorIds: payload.assignedCoordinatorIds ?? currentTeacher?.assignedCoordinatorIds ?? [],
      assignedCoordinatorNames: payload.assignedCoordinatorNames ?? currentTeacher?.assignedCoordinatorNames ?? [],
      validatedBy: shouldValidate ? payload.createdBy : currentTeacher?.validatedBy ?? '',
      validatedAt: shouldValidate ? timestamp : currentTeacher?.validatedAt ?? '',
      inactivatedBy: payload.status === 'INACTIVO' ? payload.createdBy : currentTeacher?.inactivatedBy ?? '',
      inactivatedAt: payload.status === 'INACTIVO' ? timestamp : currentTeacher?.inactivatedAt ?? '',
      importId: payload.importId ?? currentTeacher?.importId ?? '',
      createdAt: currentTeacher?.createdAt ?? timestamp,
      updatedAt: timestamp,
      deletedAt: '',
      deletedBy: '',
    });

    void this.verifySavedTeacher(normalizedMoodleUser, timestamp)
      .catch((error) => console.warn('No se pudo confirmar el docente en Firestore.', error));
  }

  importTeachers(teachers: UpsertTeacherPayload[]): Promise<void[]> {
    return Promise.all(teachers.map((teacher) => this.upsertTeacher(teacher)));
  }

  updateStatus(teacher: Teacher, status: TeacherStatus, actorId: string): Promise<void> {
    const timestamp = new Date().toISOString();

    return this.updateDocument(teacher.id, {
      status,
      validatedBy: status === 'VALIDADO' ? actorId : teacher.validatedBy,
      validatedAt: status === 'VALIDADO' ? timestamp : teacher.validatedAt,
      inactivatedBy: status === 'INACTIVO' ? actorId : teacher.inactivatedBy,
      inactivatedAt: status === 'INACTIVO' ? timestamp : teacher.inactivatedAt,
      updatedAt: timestamp,
    });
  }

  deleteTeacher(teacherId: string): Promise<void> {
    return this.deleteDocument(teacherId);
  }

  updateTeacherDetails(
    teacher: Teacher,
    payload: Pick<UpsertTeacherPayload, 'teacherCode' | 'fullName' | 'email' | 'notes'>,
  ): Promise<void> {
    return this.updateDocument(teacher.id, {
      teacherCode: payload.teacherCode?.trim() || teacher.teacherCode,
      fullName: this.normalizeFullName(payload.fullName),
      normalizedName: this.normalizeSearchText(payload.fullName),
      email: payload.email?.trim().toLowerCase() ?? '',
      notes: payload.notes?.trim() ?? '',
      updatedAt: new Date().toISOString(),
    });
  }

  updateCoordinatorAssignments(
    teacher: Teacher,
    coordinators: Array<{ id: string; name: string; programs: string[] }>,
  ): Promise<void> {
    const assignedCoordinatorIds = Array.from(new Set(
      coordinators.map((coordinator) => coordinator.id).filter(Boolean),
    ));
    const assignedCoordinatorNames = Array.from(new Set(
      coordinators.map((coordinator) => coordinator.name.trim()).filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'es'));
    const assignedPrograms = Array.from(new Set(
      coordinators.flatMap((coordinator) => coordinator.programs)
        .map((program) => program.trim().toUpperCase())
        .filter(Boolean),
    )).sort((a, b) => a.localeCompare(b, 'es'));

    return this.updateDocument(teacher.id, {
      assignedCoordinatorIds,
      assignedCoordinatorNames,
      createdByPrograms: assignedPrograms,
      updatedAt: new Date().toISOString(),
    });
  }

  hasMoodleUser(moodleUser: string): boolean {
    const id = this.normalizeMoodleUser(moodleUser);
    return this.teachers().some((teacher) => teacher.id === id);
  }

  normalizeMoodleUser(value: string): string {
    return value.trim().toLowerCase();
  }

  isValidMoodleUser(value: string): boolean {
    return /^[a-z0-9._-]+$/.test(this.normalizeMoodleUser(value));
  }

  private normalizeFullName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  private normalizeSearchText(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private createTeacherCode(): string {
    return `DOC-${String(this.teachers().length + 1).padStart(4, '0')}`;
  }

  private async verifySavedTeacher(documentId: string, updatedAt: string): Promise<void> {
    const snapshot = await getDocFromServer(doc(this.firestore, this.collectionPath, documentId));
    const savedUpdatedAt = snapshot.data()?.['updatedAt'];

    if (!snapshot.exists() || savedUpdatedAt !== updatedAt) {
      throw new Error('El docente no se confirmo en Firestore.');
    }
  }
}
