import { inject, Injectable } from '@angular/core';
import { orderBy } from 'firebase/firestore';
import { FirestoreRepository } from '../../../core/data/firestore.repository';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type SharedRequestStatus = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'CANCELADA';
export type OperationalRequestType = 'COMPARTIR_CLASE' | 'REABRIR_CAPTURA' | 'ALTA_GRUPO' | 'ASIGNACION_ESPECIAL';

export interface SharedClassRequest {
  id: string;
  requestType?: OperationalRequestType;
  cycle: string;
  sourceAssignmentId: string;
  destinationAssignmentId: string;
  sourceCoordination: string;
  destinationCoordination: string;
  sourceProgram: string;
  destinationProgram: string;
  sourceGroup: string;
  destinationGroup: string;
  subjectId: string;
  subjectName: string;
  moodleId: string;
  teacherMoodleUser: string;
  teacherName: string;
  targetCycle?: string;
  requestedProgram?: string;
  reason?: string;
  groupFullGroup?: string;
  groupCode?: string;
  groupSection?: string;
  groupProgramName?: string;
  groupModality?: string;
  groupShift?: string;
  groupAcademicArea?: string;
  specialSubjectId?: string;
  specialSubjectName?: string;
  specialMoodleId?: string;
  specialTeacherMoodleUser?: string;
  specialTeacherName?: string;
  specialStudentEnrollments?: string;
  createdEntityId?: string;
  status: SharedRequestStatus;
  requestMessage: string;
  responseObservations: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  requestedAt: string;
  respondedBy: string;
  respondedByName: string;
  respondedByRole: string;
  respondedAt: string;
  updatedAt: string;
}

export interface RequestActorData {
  userId: string;
  userName: string;
  userRole: string;
}

export interface CreateSharedRequestPayload {
  requestType?: OperationalRequestType;
  cycle: string;
  sourceAssignmentId?: string;
  sourceCoordination?: string;
  destinationCoordination?: string;
  sourceProgram?: string;
  destinationProgram?: string;
  sourceGroup?: string;
  destinationGroup?: string;
  subjectId?: string;
  subjectName?: string;
  moodleId?: string;
  teacherMoodleUser?: string;
  teacherName?: string;
  targetCycle?: string;
  requestedProgram?: string;
  reason?: string;
  groupFullGroup?: string;
  groupCode?: string;
  groupSection?: string;
  groupProgramName?: string;
  groupModality?: string;
  groupShift?: string;
  groupAcademicArea?: string;
  specialSubjectId?: string;
  specialSubjectName?: string;
  specialMoodleId?: string;
  specialTeacherMoodleUser?: string;
  specialTeacherName?: string;
  specialStudentEnrollments?: string;
  requestMessage?: string;
  actor: RequestActorData;
}

export const SHARED_REQUESTS_COLLECTION = 'solicitudes_compartidas';

@Injectable({ providedIn: 'root' })
export class SharedRequestsRepository extends FirestoreRepository<SharedClassRequest> {
  readonly requests = this.items;

  constructor() {
    super(inject(FIREBASE_DB), SHARED_REQUESTS_COLLECTION, orderBy('updatedAt', 'desc'));
  }

  createRequest(payload: CreateSharedRequestPayload): string {
    const timestamp = new Date().toISOString();
    const documentId = this.createRequestId(payload);
    const requestType = payload.requestType ?? 'COMPARTIR_CLASE';

    void this.setDocument(documentId, {
      requestType,
      cycle: payload.cycle.trim(),
      sourceAssignmentId: payload.sourceAssignmentId ?? '',
      destinationAssignmentId: '',
      sourceCoordination: this.normalizeName(payload.sourceCoordination ?? ''),
      destinationCoordination: this.normalizeName(payload.destinationCoordination ?? ''),
      sourceProgram: payload.sourceProgram?.trim().toUpperCase() ?? '',
      destinationProgram: payload.destinationProgram?.trim().toUpperCase() ?? '',
      sourceGroup: payload.sourceGroup?.trim().toUpperCase() ?? '',
      destinationGroup: payload.destinationGroup?.trim().toUpperCase() ?? '',
      subjectId: payload.subjectId?.trim().toUpperCase() ?? '',
      subjectName: this.normalizeName(payload.subjectName ?? ''),
      moodleId: payload.moodleId?.trim().toLowerCase() ?? '',
      teacherMoodleUser: payload.teacherMoodleUser?.trim().toLowerCase() ?? '',
      teacherName: this.normalizeName(payload.teacherName ?? ''),
      targetCycle: payload.targetCycle?.trim() ?? '',
      requestedProgram: payload.requestedProgram?.trim().toUpperCase() ?? '',
      reason: payload.reason?.trim() ?? '',
      groupFullGroup: payload.groupFullGroup?.trim().toUpperCase() ?? '',
      groupCode: payload.groupCode?.trim() ?? '',
      groupSection: payload.groupSection?.trim().toUpperCase() ?? '',
      groupProgramName: payload.groupProgramName?.trim() ?? '',
      groupModality: payload.groupModality ?? '',
      groupShift: payload.groupShift ?? '',
      groupAcademicArea: payload.groupAcademicArea?.trim() ?? '',
      specialSubjectId: payload.specialSubjectId?.trim().toUpperCase() ?? '',
      specialSubjectName: this.normalizeName(payload.specialSubjectName ?? ''),
      specialMoodleId: payload.specialMoodleId?.trim().toLowerCase() ?? '',
      specialTeacherMoodleUser: payload.specialTeacherMoodleUser?.trim().toLowerCase() ?? '',
      specialTeacherName: this.normalizeName(payload.specialTeacherName ?? ''),
      specialStudentEnrollments: payload.specialStudentEnrollments?.trim() ?? '',
      createdEntityId: '',
      status: 'PENDIENTE',
      requestMessage: payload.requestMessage?.trim() ?? '',
      responseObservations: '',
      requestedBy: payload.actor.userId,
      requestedByName: payload.actor.userName,
      requestedByRole: payload.actor.userRole,
      requestedAt: timestamp,
      respondedBy: '',
      respondedByName: '',
      respondedByRole: '',
      respondedAt: '',
      updatedAt: timestamp,
    });

    return documentId;
  }

  acceptRequest(
    requestId: string,
    destinationAssignmentId: string,
    responseObservations: string,
    actor: RequestActorData,
    createdEntityId = destinationAssignmentId,
  ): void {
    this.resolveRequest(requestId, 'ACEPTADA', destinationAssignmentId, responseObservations, actor, createdEntityId);
  }

  rejectRequest(requestId: string, responseObservations: string, actor: RequestActorData): void {
    this.resolveRequest(requestId, 'RECHAZADA', '', responseObservations, actor);
  }

  cancelRequest(requestId: string, actor: RequestActorData): void {
    this.resolveRequest(requestId, 'CANCELADA', '', 'Solicitud cancelada por la coordinacion solicitante.', actor);
  }

  hasPendingDuplicate(sourceAssignmentId: string, destinationGroup: string): boolean {
    const normalizedGroup = destinationGroup.trim().toUpperCase();

    return this.requests().some((request) => {
      return request.status === 'PENDIENTE'
        && request.sourceAssignmentId === sourceAssignmentId
        && request.destinationGroup === normalizedGroup;
    });
  }

  private resolveRequest(
    requestId: string,
    status: Exclude<SharedRequestStatus, 'PENDIENTE'>,
    destinationAssignmentId: string,
    responseObservations: string,
    actor: RequestActorData,
    createdEntityId = '',
  ): void {
    const timestamp = new Date().toISOString();

    void this.updateDocument(requestId, {
      status,
      destinationAssignmentId,
      createdEntityId,
      responseObservations: responseObservations.trim(),
      respondedBy: actor.userId,
      respondedByName: actor.userName,
      respondedByRole: actor.userRole,
      respondedAt: timestamp,
      updatedAt: timestamp,
    });
  }

  private createRequestId(payload: CreateSharedRequestPayload): string {
    return [
      'SOL',
      payload.requestType ?? 'COMPARTIR_CLASE',
      payload.cycle,
      payload.sourceAssignmentId ?? payload.requestedProgram ?? payload.destinationProgram ?? '',
      payload.destinationGroup ?? payload.groupFullGroup ?? payload.specialSubjectId ?? '',
      Date.now().toString(36),
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
