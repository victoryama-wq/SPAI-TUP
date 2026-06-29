import { inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';
import { MoodleCatalogStatus } from './moodle-categories.repository';

export interface MoodleCourseTemplate {
  id: string;
  internalId?: string;
  templateCourse: string;
  name: string;
  modality: string;
  programCode: string;
  status: MoodleCatalogStatus;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertMoodleCourseTemplatePayload {
  templateCourse: string;
  name: string;
  modality: string;
  programCode: string;
  status: MoodleCatalogStatus;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
}

export const MOODLE_TEMPLATES_COLLECTION = 'moodle_plantillas';

@Injectable({ providedIn: 'root' })
export class MoodleTemplatesRepository extends FirestoreRepository<MoodleCourseTemplate> {
  readonly templates = this.items;
  readonly templatesReadError = this.readError;

  constructor() {
    super(inject(FIREBASE_DB), MOODLE_TEMPLATES_COLLECTION, orderBy('name', 'asc'));
  }

  upsertTemplate(payload: UpsertMoodleCourseTemplatePayload, id?: string | null): Promise<void> {
    const timestamp = new Date().toISOString();
    const documentId = id || this.nextTemplateId();
    const currentTemplate = this.templates().find((template) => template.id === documentId);

    return this.setDocument(documentId, {
      internalId: currentTemplate?.internalId ?? documentId,
      templateCourse: payload.templateCourse.trim(),
      name: this.normalizeName(payload.name),
      modality: this.normalizeName(payload.modality),
      programCode: payload.programCode.trim().toUpperCase(),
      status: payload.status,
      createdBy: currentTemplate?.createdBy ?? payload.createdBy,
      createdByName: currentTemplate?.createdByName ?? payload.createdByName,
      createdByRole: currentTemplate?.createdByRole ?? payload.createdByRole,
      createdAt: currentTemplate?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  }

  importTemplates(templates: UpsertMoodleCourseTemplatePayload[]): Promise<void[]> {
    return Promise.all(templates.map((template) => this.upsertTemplate(template)));
  }

  deleteTemplate(id: string): Promise<void> {
    return this.deleteDocument(id);
  }

  normalizeTemplateId(value: string): string {
    return value.trim().replace(/\s+/g, '-').toLowerCase();
  }

  private nextTemplateId(): string {
    const usedNumbers = this.templates()
      .map((template) => template.internalId || template.id)
      .map((value) => /^TPL(\d+)$/i.exec(value)?.[1])
      .filter((value): value is string => Boolean(value))
      .map((value) => Number(value));
    const nextNumber = (usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1;

    return `TPL${String(nextNumber).padStart(4, '0')}`;
  }

  private normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }
}
