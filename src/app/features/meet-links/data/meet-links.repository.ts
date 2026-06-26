import { computed, inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type MeetLinkStatus = 'PENDIENTE' | 'GENERADA' | 'REVISADA' | 'CON_OBSERVACION' | 'NO_APLICA';

export interface MeetLink {
  id: string;
  assignmentId: string;
  cycle: string;
  meetUrl: string;
  status: MeetLinkStatus;
  observations: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  updatedBy: string;
  updatedByName: string;
  updatedByRole: string;
  updatedAt: string;
}

export interface UpsertMeetLinkPayload {
  assignmentId: string;
  cycle: string;
  meetUrl: string;
  status: MeetLinkStatus;
  observations: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
}

export const MEET_LINKS_COLLECTION = 'ligas_meet';

@Injectable({ providedIn: 'root' })
export class MeetLinksRepository extends FirestoreRepository<MeetLink> {
  readonly meetLinks = computed(() => this.items());

  constructor() {
    super(inject(FIREBASE_DB), MEET_LINKS_COLLECTION, orderBy('updatedAt', 'desc'));
  }

  upsertMeetLink(payload: UpsertMeetLinkPayload): Promise<void> {
    const timestamp = new Date().toISOString();
    const documentId = payload.assignmentId.trim();
    const currentLink = this.meetLinks().find((link) => link.assignmentId === documentId);

    return this.setDocument(documentId, {
      assignmentId: documentId,
      cycle: payload.cycle.trim(),
      meetUrl: payload.meetUrl.trim(),
      status: payload.status,
      observations: payload.observations.trim(),
      createdBy: currentLink?.createdBy ?? payload.createdBy,
      createdByName: currentLink?.createdByName ?? payload.createdByName,
      createdByRole: currentLink?.createdByRole ?? payload.createdByRole,
      createdAt: currentLink?.createdAt ?? timestamp,
      updatedBy: payload.createdBy,
      updatedByName: payload.createdByName,
      updatedByRole: payload.createdByRole,
      updatedAt: timestamp,
    });
  }
}
