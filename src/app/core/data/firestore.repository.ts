import { UserSession, UserSessionService } from '../auth/user-session.service';
import { authorizedQuery } from './authorized-query';
import { computed, effect, inject, signal } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
  QueryConstraint,
  Query,
  setDoc,
  UpdateData,
  updateDoc,
} from 'firebase/firestore';
import { AuthService } from '../auth/auth.service';

const FIRESTORE_READ_TIMEOUT_MS = 12000;

export abstract class FirestoreRepository<T extends { id: string }> {
  private readonly authService = inject(AuthService);
  private readonly itemsSignal = signal<T[]>([]);
  private readonly readErrorSignal = signal('');
  private readonly loadingSignal = signal(false);
  private readonly stateSignal = signal<'loading' | 'ready' | 'restricted' | 'denied' | 'error'>('loading');
  private collectionQuery: Query | null = null;
  private readonly userSession = inject(UserSessionService);
  private generation = 0;
  private refreshSequence = 0;
  private snapshotSequence = 0;
  private readonly dataOwner = signal<UserSession | null>(null);
  private readonly dataSelection = signal('');

  readonly items = computed(() => this.dataOwner() === this.userSession.session() && this.dataSelection() === this.selectionKey() && this.stateSignal() === 'ready' ? this.itemsSignal() : []);
  readonly readState = computed(() => this.dataOwner() === this.userSession.session() && this.dataSelection() === this.selectionKey() ? this.stateSignal() : 'loading');
  readonly ready = computed(() => this.readState() === 'ready');
  readonly readMessage = computed(() => ({ loading: 'Cargando datos autorizados…', ready: '',
    restricted: 'Sin ámbito de consulta concedido. Solicita revisión a Administración General.',
    denied: 'Acceso denegado o revocado. Solicita revisión de tus permisos a Administración General.',
    error: 'No se pudo completar la consulta. Reintenta o recarga la página.' })[this.readState()]);
  readonly readError = this.readErrorSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  protected constructor(
    protected readonly firestore: Firestore,
    protected readonly collectionPath: string,
    ...constraints: QueryConstraint[]
  ) {
    effect((onCleanup) => {
      const generation = ++this.generation;
      const owner = this.userSession.session();
      this.dataOwner.set(owner);
      const selection = this.selectionKey();
      this.dataSelection.set(selection);
      this.itemsSignal.set([]);
      this.readErrorSignal.set('');
      this.stateSignal.set('loading');
      try { this.collectionQuery = authorizedQuery(this.firestore, this.collectionPath, [...constraints, ...this.selectionConstraints()], this.userSession.session()?.appUser); }
      catch (error) { console.error(`Consulta no disponible: ${this.collectionPath}`, error); this.collectionQuery = null; this.loadingSignal.set(false); this.stateSignal.set('error'); this.readErrorSignal.set('Consulta no disponible. Solicita revisión del ámbito a Administración General.'); return; }
      if (!this.authService.isAuthenticated() || !this.collectionQuery) {
        this.itemsSignal.set([]);
        this.readErrorSignal.set('');
        this.loadingSignal.set(false);
        this.stateSignal.set('restricted');
        return;
      }

      this.loadingSignal.set(true);
      const initialLoadTimeout = setTimeout(() => {
        if (this.loadingSignal()) {
          this.loadingSignal.set(false);
          this.stateSignal.set('error');
          this.readErrorSignal.set(`La consulta de ${this.collectionPath} tardo demasiado. Intenta recargar la vista.`);
        }
      }, FIRESTORE_READ_TIMEOUT_MS);

      const unsubscribe = onSnapshot(
        this.collectionQuery, { includeMetadataChanges: true },
        (snapshot) => {
          if (generation !== this.generation || owner !== this.userSession.session() || selection !== this.selectionKey()) return;
          if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
          const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
          if (this.retainVerifiedRowsOnRefresh() && !this.acceptsRefreshedRows(rows, this.itemsSignal(), false)) return;
          ++this.snapshotSequence;
          clearTimeout(initialLoadTimeout);
          this.readErrorSignal.set('');
          this.loadingSignal.set(false);
          this.stateSignal.set('ready');
          this.itemsSignal.set(rows);
        },
        (error) => {
          if (generation !== this.generation || owner !== this.userSession.session() || selection !== this.selectionKey()) return;
          ++this.refreshSequence;
          clearTimeout(initialLoadTimeout);
          this.itemsSignal.set([]);
          console.error(`No se pudo leer ${this.collectionPath}`, error);
          this.stateSignal.set(error.code === 'permission-denied' ? 'denied' : 'error');
          this.readErrorSignal.set(this.readMessage());
          this.loadingSignal.set(false);
        },
      );

      onCleanup(() => {
        ++this.generation;
        this.collectionQuery = null;
        this.itemsSignal.set([]);
        clearTimeout(initialLoadTimeout);
        unsubscribe();
      });
    });
  }

  protected selectionKey(): string { return ''; }

  protected selectionConstraints(): QueryConstraint[] { return []; }

  /** Opt-in background refresh. Never retains rows across owner/scope changes. */
  protected retainVerifiedRowsOnRefresh(): boolean { return false; }
  protected acceptsRefreshedRows(_next: T[], _current: T[], newerSnapshot: boolean): boolean { return !newerSnapshot; }

  refreshFromServer(): Promise<void> {
    const generation = this.generation;
    const selection = this.selectionKey();
    const owner = this.userSession.session();
    const request = ++this.refreshSequence;
    const snapshotSequence = this.snapshotSequence;
    if (!this.collectionQuery || this.dataOwner() !== this.userSession.session()) return Promise.reject(new Error('PERMISO_REVOCADO o módulo sin autorización vigente.'));
    const retained = this.retainVerifiedRowsOnRefresh() && this.ready();
    const current = () => generation === this.generation && selection === this.selectionKey()
      && owner === this.userSession.session() && request === this.refreshSequence;
    if (!retained) { this.loadingSignal.set(true); this.stateSignal.set('loading'); }

    return this.withReadTimeout(
      getDocsFromServer(this.collectionQuery),
      `La consulta de ${this.collectionPath} no respondio a tiempo.`,
    )
      .then((snapshot) => {
        if (!current()) throw new Error('La sesión, la selección o la consulta cambiaron. Reintenta la actualización.');
        const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
        if (retained && !this.acceptsRefreshedRows(rows, this.itemsSignal(), snapshotSequence !== this.snapshotSequence)) return;
        this.readErrorSignal.set('');
        this.stateSignal.set('ready');
        this.itemsSignal.set(rows);
      })
      .catch((error) => {
        if (!current()) throw error;
        // A transport failure does not turn the last verified cycle into an
        // empty/historical selection. Permission denial still withdraws data.
        if (retained && error.code !== 'permission-denied') throw error;
        this.itemsSignal.set([]);
        console.error(`No se pudo actualizar ${this.collectionPath} desde servidor`, error);
        this.stateSignal.set(error.code === 'permission-denied' ? 'denied' : 'error');
        this.readErrorSignal.set(this.readMessage());
        throw error;
      })
      .finally(() => {
        if (current() && !retained) this.loadingSignal.set(false);
      });
  }

  /** One-shot reads use the same scope as subscriptions and cannot cross sessions. */
  protected async readAuthorized(...constraints: QueryConstraint[]) {
    const owner = this.userSession.session();
    const target = authorizedQuery(this.firestore, this.collectionPath, constraints, owner?.appUser);
    if (!target || !owner) throw new Error('Acceso denegado o revocado para esta consulta.');
    const snapshot = await getDocsFromServer(target);
    if (owner !== this.userSession.session()) throw new Error('La sesión o sus permisos cambiaron. Repite la consulta.');
    return snapshot;
  }

  private withReadTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(message));
      }, FIRESTORE_READ_TIMEOUT_MS);

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

  protected addDocument(payload: Record<string, unknown>): Promise<unknown> {
    return addDoc(collection(this.firestore, this.collectionPath), payload);
  }

  protected setDocument(id: string, payload: Record<string, unknown>): Promise<void> {
    return setDoc(doc(this.firestore, this.collectionPath, id), payload, { merge: true });
  }

  protected updateDocument(id: string, payload: Record<string, unknown>): Promise<void> {
    return updateDoc(
      doc(this.firestore, this.collectionPath, id),
      payload as UpdateData<Record<string, unknown>>,
    );
  }

  protected deleteDocument(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, this.collectionPath, id));
  }
}
