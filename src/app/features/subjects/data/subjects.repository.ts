import { inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type SubjectStatus = 'Activo' | 'Inactivo';
export type SubjectOrigin = 'MANUAL' | 'CSV';

export interface Subject {
  id: string;
  subjectId: string;
  name: string;
  normalizedName: string;
  status: SubjectStatus;
  origin: SubjectOrigin;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSubjectPayload {
  subjectId: string;
  name: string;
  status: SubjectStatus;
  origin: SubjectOrigin;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
}

export const SUBJECTS_COLLECTION = 'asignaturas';

@Injectable({ providedIn: 'root' })
export class SubjectsRepository extends FirestoreRepository<Subject> {
  readonly subjects = this.items;

  constructor() {
    super(inject(FIREBASE_DB), SUBJECTS_COLLECTION, orderBy('subjectId', 'asc'));
  }

  upsertSubject(payload: UpsertSubjectPayload): Promise<void> {
    const timestamp = new Date().toISOString();
    const documentId = this.normalizeSubjectId(payload.subjectId);
    const currentSubject = this.subjects().find((subject) => subject.id === documentId);

    return this.setDocument(documentId, {
      subjectId: documentId,
      name: this.normalizeSubjectName(payload.name),
      normalizedName: this.normalizeSearchText(payload.name),
      status: payload.status,
      origin: payload.origin,
      createdBy: currentSubject?.createdBy ?? payload.createdBy,
      createdByName: currentSubject?.createdByName ?? payload.createdByName,
      createdByRole: currentSubject?.createdByRole ?? payload.createdByRole,
      createdAt: currentSubject?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  }

  async importSubjects(subjects: UpsertSubjectPayload[]): Promise<void> {
    await Promise.all(subjects.map((subject) => this.upsertSubject(subject)));
  }

  updateStatus(subject: Subject, status: SubjectStatus): Promise<void> {
    return this.updateDocument(subject.id, {
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  deleteSubject(subjectId: string): Promise<void> {
    return this.deleteDocument(this.normalizeSubjectId(subjectId));
  }

  hasSubjectId(subjectId: string, excludedId?: string | null): boolean {
    const normalizedId = this.normalizeSubjectId(subjectId);

    return this.subjects().some((subject) => {
      return subject.id !== excludedId && subject.subjectId === normalizedId;
    });
  }

  normalizeSubjectId(value: string): string {
    return value.trim().toUpperCase();
  }

  isValidSubjectId(value: string): boolean {
    return /^[A-Z0-9._-]+$/.test(this.normalizeSubjectId(value));
  }

  private normalizeSubjectName(value: string): string {
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
}
