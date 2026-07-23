import { inject, Injectable } from '@angular/core';
import { doc, getDocFromServer, orderBy, runTransaction } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type TeacherStatus = 'PENDIENTE' | 'VALIDADO' | 'INACTIVO';
export type TeacherOrigin = 'MANUAL' | 'CSV';
export type TeacherPaymentType = 'EFECTIVO' | 'SANTANDER' | 'BANORTE';
export type TeacherCategory = 'V_35HRS' | 'VIP_35HRS' | 'M_25HRS' | 'N_15HRS';
export type TeacherLocation = 'FORANEO' | 'LOCAL' | 'VIRTUAL';
export type TeacherLifecycleStatus = 'NUEVO' | 'RETOMO' | 'VIGENTE';

export interface Teacher {
  id: string;
  teacherCode: string;
  fullName: string;
  normalizedName: string;
  moodleUser: string;
  normalizedMoodleUser: string;
  status: TeacherStatus;
  lifecycleStatus?: TeacherLifecycleStatus;
  origin: TeacherOrigin;
  email: string;
  paymentType?: TeacherPaymentType | '';
  category?: TeacherCategory | '';
  phone?: string;
  location?: TeacherLocation | '';
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
  lifecycleStatus?: TeacherLifecycleStatus;
  origin: TeacherOrigin;
  email?: string;
  paymentType?: TeacherPaymentType | '';
  category?: TeacherCategory | '';
  phone?: string;
  location?: TeacherLocation | '';
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdByPrograms: string[];
  assignedCoordinatorIds?: string[];
  assignedCoordinatorNames?: string[];
  importId?: string;
}

export interface DeleteTeacherResult {
  releasedMoodleUser: boolean;
  releasedMoodleNumber?: number;
}

export const TEACHERS_COLLECTION = 'docentes';
const TEACHERS_CONFIG_COLLECTION = 'configuracion';
const TEACHERS_CONFIG_DOCUMENT = 'docentes';
const TEACHER_MOODLE_PREFIX = 'tup-d';
const TEACHER_MOODLE_BASE_NUMBER = 1813;

@Injectable({ providedIn: 'root' })
export class TeachersRepository extends FirestoreRepository<Teacher> {
  readonly teachers = this.items;
  readonly teachersReadError = this.readError;

  constructor() {
    super(inject(FIREBASE_DB), TEACHERS_COLLECTION, orderBy('fullName', 'asc'));
  }

  async upsertTeacher(payload: UpsertTeacherPayload, options?: { reserveMoodleUser?: boolean }): Promise<string> {
    const timestamp = new Date().toISOString();

    if (options?.reserveMoodleUser) {
      return this.upsertTeacherWithReservedMoodleUser(payload, timestamp);
    }

    const normalizedMoodleUser = this.normalizeMoodleUser(payload.moodleUser);
    const currentTeacher = this.teachers().find((teacher) => teacher.id === normalizedMoodleUser);

    await this.setDocument(normalizedMoodleUser, {
      ...this.createTeacherDocument(payload, normalizedMoodleUser, currentTeacher, timestamp),
    });

    void this.verifySavedTeacher(normalizedMoodleUser, timestamp)
      .catch((error) => console.warn('No se pudo confirmar el docente en Firestore.', error));

    return normalizedMoodleUser;
  }

  importTeachers(teachers: UpsertTeacherPayload[]): Promise<string[]> {
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

  deleteTeacher(
    teacher: Teacher,
    actor?: Pick<UpsertTeacherPayload, 'createdBy' | 'createdByName'>,
  ): Promise<DeleteTeacherResult> {
    const teacherId = this.normalizeMoodleUser(teacher.id || teacher.moodleUser || teacher.normalizedMoodleUser);
    const teacherRef = doc(this.firestore, this.collectionPath, teacherId);
    const configRef = doc(this.firestore, TEACHERS_CONFIG_COLLECTION, TEACHERS_CONFIG_DOCUMENT);
    const timestamp = new Date().toISOString();

    return runTransaction(this.firestore, async (transaction) => {
      const teacherSnapshot = await transaction.get(teacherRef);

      if (!teacherSnapshot.exists()) {
        return { releasedMoodleUser: false };
      }

      const configSnapshot = await transaction.get(configRef);
      const teacherData = teacherSnapshot.data() as Teacher;
      const storedLastNumber = Number(configSnapshot.data()?.['lastMoodleTeacherNumber']);
      const moodleUser = this.normalizeMoodleUser(
        teacherData.moodleUser || teacherData.normalizedMoodleUser || teacherId,
      );
      const deletedNumber = this.moodleTeacherNumber(moodleUser);
      const shouldReleaseMoodleUser = this.shouldReleaseReservedMoodleUser(
        teacherData,
        deletedNumber,
        storedLastNumber,
      );
      let releasedMoodleUser = false;

      transaction.delete(teacherRef);

      if (shouldReleaseMoodleUser && deletedNumber !== null) {
        const remainingMaxNumber = this.maxRegisteredMoodleNumber(teacherId);
        const releasedLastNumber = Math.max(TEACHER_MOODLE_BASE_NUMBER, remainingMaxNumber, deletedNumber - 1);

        if (releasedLastNumber < storedLastNumber) {
          transaction.set(configRef, {
            lastMoodleTeacherNumber: releasedLastNumber,
            updatedAt: timestamp,
            updatedBy: actor?.createdBy ?? teacherData.createdBy ?? '',
            updatedByName: actor?.createdByName ?? teacherData.createdByName ?? '',
          }, { merge: true });
          releasedMoodleUser = true;
        }
      }

      return {
        releasedMoodleUser,
        releasedMoodleNumber: releasedMoodleUser && deletedNumber !== null ? deletedNumber : undefined,
      };
    });
  }

  updateTeacherDetails(
    teacher: Teacher,
    payload: Pick<UpsertTeacherPayload, 'teacherCode' | 'fullName' | 'email' | 'paymentType' | 'category' | 'phone' | 'location' | 'notes'>,
  ): Promise<void> {
    return this.updateDocument(teacher.id, {
      teacherCode: payload.teacherCode?.trim() || teacher.teacherCode,
      fullName: this.normalizeFullName(payload.fullName),
      normalizedName: this.normalizeSearchText(payload.fullName),
      email: payload.email?.trim().toLowerCase() ?? '',
      paymentType: payload.paymentType ?? '',
      category: payload.category ?? '',
      phone: payload.phone?.trim() ?? '',
      location: payload.location ?? '',
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

  private async upsertTeacherWithReservedMoodleUser(payload: UpsertTeacherPayload, timestamp: string): Promise<string> {
    const configRef = doc(this.firestore, TEACHERS_CONFIG_COLLECTION, TEACHERS_CONFIG_DOCUMENT);
    const localMaxNumber = this.maxRegisteredMoodleNumber();

    const normalizedMoodleUser = await runTransaction(this.firestore, async (transaction) => {
      const configSnapshot = await transaction.get(configRef);
      const storedLastNumber = Number(configSnapshot.data()?.['lastMoodleTeacherNumber']);
      const safeLastNumber = Number.isFinite(storedLastNumber)
        ? Math.max(storedLastNumber, localMaxNumber, TEACHER_MOODLE_BASE_NUMBER)
        : Math.max(localMaxNumber, TEACHER_MOODLE_BASE_NUMBER);
      let nextNumber = safeLastNumber + 1;
      let generatedMoodleUser = `${TEACHER_MOODLE_PREFIX}${nextNumber}`;
      let teacherRef = doc(this.firestore, this.collectionPath, generatedMoodleUser);
      let teacherSnapshot = await transaction.get(teacherRef);
      let attempts = 0;

      while (teacherSnapshot.exists() && attempts < 50) {
        attempts += 1;
        nextNumber += 1;
        generatedMoodleUser = `${TEACHER_MOODLE_PREFIX}${nextNumber}`;
        teacherRef = doc(this.firestore, this.collectionPath, generatedMoodleUser);
        teacherSnapshot = await transaction.get(teacherRef);
      }

      if (teacherSnapshot.exists()) {
        throw new Error(`El usuario Moodle ${generatedMoodleUser} ya existe. Intenta guardar nuevamente.`);
      }

      transaction.set(teacherRef, this.createTeacherDocument(
        {
          ...payload,
          moodleUser: generatedMoodleUser,
          email: `${generatedMoodleUser}@tecplayacar.edu.mx`,
        },
        generatedMoodleUser,
        null,
        timestamp,
      ), { merge: true });
      transaction.set(configRef, {
        lastMoodleTeacherNumber: nextNumber,
        updatedAt: timestamp,
        updatedBy: payload.createdBy,
        updatedByName: payload.createdByName,
      }, { merge: true });

      return generatedMoodleUser;
    });

    void this.verifySavedTeacher(normalizedMoodleUser, timestamp)
      .catch((error) => console.warn('No se pudo confirmar el docente en Firestore.', error));

    return normalizedMoodleUser;
  }

  private createTeacherDocument(
    payload: UpsertTeacherPayload,
    normalizedMoodleUser: string,
    currentTeacher: Teacher | null | undefined,
    timestamp: string,
  ): Omit<Teacher, 'id'> {
    const shouldValidate = payload.status === 'VALIDADO';
    const createdByPrograms = Array.from(new Set([
      ...(currentTeacher?.createdByPrograms ?? []).map((program) => program.trim().toUpperCase()).filter(Boolean),
      ...payload.createdByPrograms.map((program) => program.trim().toUpperCase()).filter(Boolean),
    ])).sort((a, b) => a.localeCompare(b, 'es'));

    return {
      teacherCode: payload.teacherCode?.trim() || currentTeacher?.teacherCode || this.createTeacherCode(),
      fullName: this.normalizeFullName(payload.fullName),
      normalizedName: this.normalizeSearchText(payload.fullName),
      moodleUser: normalizedMoodleUser,
      normalizedMoodleUser,
      status: payload.status,
      lifecycleStatus: currentTeacher?.lifecycleStatus
        ?? payload.lifecycleStatus
        ?? (payload.origin === 'MANUAL' ? 'NUEVO' : 'VIGENTE'),
      origin: payload.origin,
      email: payload.email?.trim().toLowerCase() ?? currentTeacher?.email ?? '',
      paymentType: payload.paymentType ?? currentTeacher?.paymentType ?? '',
      category: payload.category ?? currentTeacher?.category ?? '',
      phone: payload.phone?.trim() ?? currentTeacher?.phone ?? '',
      location: payload.location ?? currentTeacher?.location ?? '',
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
    };
  }

  private maxRegisteredMoodleNumber(excludedTeacherId = ''): number {
    const normalizedExcludedId = this.normalizeMoodleUser(excludedTeacherId);

    return this.teachers().reduce((max, teacher) => {
      const value = this.normalizeMoodleUser(teacher.moodleUser || teacher.normalizedMoodleUser || teacher.id);

      if (normalizedExcludedId && (teacher.id === normalizedExcludedId || value === normalizedExcludedId)) {
        return max;
      }

      const teacherNumber = this.moodleTeacherNumber(value);

      if (teacherNumber === null) {
        return max;
      }

      return Math.max(max, teacherNumber);
    }, TEACHER_MOODLE_BASE_NUMBER);
  }

  private moodleTeacherNumber(value: string): number | null {
    const match = this.normalizeMoodleUser(value).match(/^tup-d(\d+)$/);

    if (!match) {
      return null;
    }

    const teacherNumber = Number(match[1]);
    return Number.isFinite(teacherNumber) ? teacherNumber : null;
  }

  private shouldReleaseReservedMoodleUser(
    teacher: Partial<Teacher>,
    deletedNumber: number | null,
    storedLastNumber: number,
  ): boolean {
    return deletedNumber !== null
      && Number.isFinite(storedLastNumber)
      && deletedNumber === storedLastNumber
      && teacher.status === 'PENDIENTE'
      && teacher.origin === 'MANUAL'
      && teacher.lifecycleStatus === 'NUEVO';
  }

  private async verifySavedTeacher(documentId: string, updatedAt: string): Promise<void> {
    const snapshot = await getDocFromServer(doc(this.firestore, this.collectionPath, documentId));
    const savedUpdatedAt = snapshot.data()?.['updatedAt'];

    if (!snapshot.exists() || savedUpdatedAt !== updatedAt) {
      throw new Error('El docente no se confirmo en Firestore.');
    }
  }
}
