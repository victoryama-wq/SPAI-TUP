import { inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type MoodleCatalogStatus = 'Activo' | 'Inactivo';

export interface MoodleCategory {
  id: string;
  categoryNumber: string;
  programCode: string;
  programName: string;
  status: MoodleCatalogStatus;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertMoodleCategoryPayload {
  categoryNumber: string;
  programCode: string;
  programName: string;
  status: MoodleCatalogStatus;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
}

export const MOODLE_CATEGORIES_COLLECTION = 'moodle_categorias';

@Injectable({ providedIn: 'root' })
export class MoodleCategoriesRepository extends FirestoreRepository<MoodleCategory> {
  readonly categories = this.items;
  readonly categoriesReadError = this.readError;

  constructor() {
    super(inject(FIREBASE_DB), MOODLE_CATEGORIES_COLLECTION, orderBy('programCode', 'asc'));
  }

  upsertCategory(payload: UpsertMoodleCategoryPayload, id?: string | null): Promise<void> {
    const timestamp = new Date().toISOString();
    const documentId = id || this.normalizeCategoryId(payload.categoryNumber);
    const currentCategory = this.categories().find((category) => category.id === documentId);

    return this.setDocument(documentId, {
      categoryNumber: payload.categoryNumber.trim(),
      programCode: payload.programCode.trim().toUpperCase(),
      programName: this.normalizeName(payload.programName),
      status: payload.status,
      createdBy: currentCategory?.createdBy ?? payload.createdBy,
      createdByName: currentCategory?.createdByName ?? payload.createdByName,
      createdByRole: currentCategory?.createdByRole ?? payload.createdByRole,
      createdAt: currentCategory?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
  }

  importCategories(categories: UpsertMoodleCategoryPayload[]): Promise<void[]> {
    return Promise.all(categories.map((category) => this.upsertCategory(category)));
  }

  deleteCategory(id: string): Promise<void> {
    return this.deleteDocument(id);
  }

  normalizeCategoryId(value: string): string {
    return value.trim().replace(/\s+/g, '-').toLowerCase();
  }

  private normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }
}
