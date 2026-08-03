import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { UserSessionService } from '../../../core/auth/user-session.service';
import { FIREBASE_DB } from '../../../core/firebase/firebase.tokens';

export type AgendaScope = 'EQUIPO' | 'PRIVADA';
export type AgendaColumn = 'PENDIENTE' | 'EN_PROCESO' | 'PARA_REVISAR' | 'LISTO';
export type AgendaPriority = 'ALTA' | 'MEDIA' | 'BAJA';
export type AgendaNoteColor = 'AMARILLO' | 'AZUL' | 'VERDE' | 'ROSA' | 'LILA';

export interface OperationalAgendaItem {
  id: string;
  scope: AgendaScope;
  title: string;
  detail: string;
  column: AgendaColumn;
  priority: AgendaPriority;
  noteColor: AgendaNoteColor;
  dueDate: string | null;
  ownerId: string;
  ownerName: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  sortOrder?: number;
}

export interface SaveOperationalAgendaItem {
  scope: AgendaScope;
  title: string;
  detail: string;
  column: AgendaColumn;
  priority: AgendaPriority;
  noteColor: AgendaNoteColor;
  dueDate: string | null;
}

export const TEAM_AGENDA_COLLECTION = 'agenda_operativa_equipo';
export const PRIVATE_AGENDA_COLLECTION = 'agenda_operativa_privada';

@Injectable({ providedIn: 'root' })
export class OperationalAgendaRepository {
  private readonly firestore = inject(FIREBASE_DB);
  private readonly userSessionService = inject(UserSessionService);
  private readonly teamItemsSignal = signal<OperationalAgendaItem[]>([]);
  private readonly privateItemsSignal = signal<OperationalAgendaItem[]>([]);
  private readonly errorSignal = signal('');

  readonly items = computed(() =>
    [...this.teamItemsSignal(), ...this.privateItemsSignal()]
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
  );
  readonly readError = this.errorSignal.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const session = this.userSessionService.session();
      const appUser = session?.appUser;

      if (!session || !appUser || appUser.status !== 'Activo' || !this.isBaseSystemsRole(appUser.role)) {
        this.teamItemsSignal.set([]);
        this.privateItemsSignal.set([]);
        this.errorSignal.set('');
        return;
      }

      const handleError = (error: Error) => {
        console.error('No se pudo cargar la agenda operativa.', error);
        this.errorSignal.set('No se pudo actualizar la agenda. Verifica tu conexión y permisos.');
      };
      const unsubscribeTeam = onSnapshot(
        collection(this.firestore, TEAM_AGENDA_COLLECTION),
        (snapshot) => {
          this.errorSignal.set('');
          this.teamItemsSignal.set(snapshot.docs.map((item) => this.mapAgendaItem(item.id, item.data())));
        },
        handleError,
      );
      const unsubscribePrivate = onSnapshot(
        collection(this.firestore, PRIVATE_AGENDA_COLLECTION, session.authUid, 'actividades'),
        (snapshot) => {
          this.errorSignal.set('');
          this.privateItemsSignal.set(snapshot.docs.map((item) => this.mapAgendaItem(item.id, item.data())));
        },
        handleError,
      );

      onCleanup(() => {
        unsubscribeTeam();
        unsubscribePrivate();
      });
    });
  }

  async create(payload: SaveOperationalAgendaItem): Promise<string> {
    const context = this.currentContext();
    const timestamp = new Date().toISOString();
    const reference = payload.scope === 'EQUIPO'
      ? collection(this.firestore, TEAM_AGENDA_COLLECTION)
      : collection(this.firestore, PRIVATE_AGENDA_COLLECTION, context.authUid, 'actividades');
    const result = await addDoc(reference, {
      ...this.normalizedPayload(payload),
      ownerId: payload.scope === 'PRIVADA' ? context.authUid : '',
      ownerName: payload.scope === 'PRIVADA' ? context.name : '',
      createdBy: context.authUid,
      createdByName: context.name,
      createdAt: timestamp,
      updatedAt: timestamp,
      sortOrder: this.nextSortOrder(payload.scope, payload.column),
    });

    return result.id;
  }

  async update(item: OperationalAgendaItem, payload: SaveOperationalAgendaItem): Promise<void> {
    const context = this.currentContext();
    const reference = this.documentReference(item, context.authUid);

    await updateDoc(reference, {
      ...this.normalizedPayload(payload),
      sortOrder: payload.column === item.column
        ? item.sortOrder ?? this.nextSortOrder(payload.scope, payload.column, item.id)
        : this.nextSortOrder(payload.scope, payload.column, item.id),
      updatedAt: new Date().toISOString(),
    });
  }

  async advance(item: OperationalAgendaItem, column: AgendaColumn): Promise<void> {
    const context = this.currentContext();

    await updateDoc(this.documentReference(item, context.authUid), {
      column,
      sortOrder: this.nextSortOrder(item.scope, column, item.id),
      updatedAt: new Date().toISOString(),
    });
  }

  async reorder(
    item: OperationalAgendaItem,
    direction: 'UP' | 'DOWN',
    orderedItems: ReadonlyArray<OperationalAgendaItem>,
  ): Promise<boolean> {
    const context = this.currentContext();
    const currentIndex = orderedItems.findIndex((candidate) => candidate.id === item.id);
    const targetIndex = currentIndex + (direction === 'UP' ? -1 : 1);

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedItems.length) {
      return false;
    }

    const reorderedItems = [...orderedItems];
    const [movedItem] = reorderedItems.splice(currentIndex, 1);
    reorderedItems.splice(targetIndex, 0, movedItem);

    const batch = writeBatch(this.firestore);
    const timestamp = new Date().toISOString();

    reorderedItems.forEach((candidate, index) => {
      const sortOrder = (index + 1) * 1000;

      if (candidate.sortOrder !== sortOrder) {
        batch.update(this.documentReference(candidate, context.authUid), {
          sortOrder,
          ...(candidate.id === item.id ? { updatedAt: timestamp } : {}),
        });
      }
    });

    await batch.commit();
    return true;
  }

  async delete(item: OperationalAgendaItem): Promise<void> {
    const context = this.currentContext();
    await deleteDoc(this.documentReference(item, context.authUid));
  }

  private normalizedPayload(payload: SaveOperationalAgendaItem): Omit<SaveOperationalAgendaItem, 'dueDate'> & { dueDate: string | null } {
    return {
      scope: payload.scope,
      title: payload.title.trim(),
      detail: payload.detail.trim(),
      column: payload.column,
      priority: payload.priority,
      noteColor: this.normalizeNoteColor(payload.noteColor),
      dueDate: payload.dueDate || null,
    };
  }

  private mapAgendaItem(id: string, data: Record<string, unknown>): OperationalAgendaItem {
    return {
      ...data,
      id,
      noteColor: this.normalizeNoteColor(data['noteColor']),
    } as OperationalAgendaItem;
  }

  private normalizeNoteColor(value: unknown): AgendaNoteColor {
    return value === 'AZUL' || value === 'VERDE' || value === 'ROSA' || value === 'LILA'
      ? value
      : 'AMARILLO';
  }

  private nextSortOrder(scope: AgendaScope, column: AgendaColumn, excludeId = ''): number {
    const sourceItems = scope === 'EQUIPO' ? this.teamItemsSignal() : this.privateItemsSignal();
    const highestOrder = sourceItems
      .filter((item) => item.column === column && item.id !== excludeId)
      .reduce((highest, item) => Math.max(highest, Number.isFinite(item.sortOrder) ? item.sortOrder! : 0), 0);

    return highestOrder + 1000;
  }

  private documentReference(item: OperationalAgendaItem, authUid: string) {
    return item.scope === 'EQUIPO'
      ? doc(this.firestore, TEAM_AGENDA_COLLECTION, item.id)
      : doc(this.firestore, PRIVATE_AGENDA_COLLECTION, authUid, 'actividades', item.id);
  }

  private currentContext(): { authUid: string; name: string } {
    const session = this.userSessionService.session();
    const appUser = session?.appUser;

    if (!session || !appUser || appUser.status !== 'Activo' || !this.isBaseSystemsRole(appUser.role)) {
      throw new Error('La agenda operativa solo está disponible para perfiles base de Sistemas.');
    }

    return { authUid: session.authUid, name: appUser.name };
  }

  private isBaseSystemsRole(role: string): boolean {
    return role === 'Coordinación de Sistemas' || role === 'Auxiliar de Sistemas';
  }
}
