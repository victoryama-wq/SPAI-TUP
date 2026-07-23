import { effect, inject, signal } from '@angular/core';
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
  private readonly collectionQuery: Query;

  readonly items = this.itemsSignal.asReadonly();
  readonly readError = this.readErrorSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  protected constructor(
    protected readonly firestore: Firestore,
    protected readonly collectionPath: string,
    ...constraints: QueryConstraint[]
  ) {
    const ref = collection(this.firestore, this.collectionPath);
    this.collectionQuery = constraints.length
      ? query(ref, ...constraints)
      : query(ref, orderBy('createdAt', 'desc'));

    effect((onCleanup) => {
      if (!this.authService.isAuthenticated()) {
        this.itemsSignal.set([]);
        this.readErrorSignal.set('');
        this.loadingSignal.set(false);
        return;
      }

      this.loadingSignal.set(true);
      const initialLoadTimeout = setTimeout(() => {
        if (this.loadingSignal()) {
          this.loadingSignal.set(false);
          this.readErrorSignal.set(`La consulta de ${this.collectionPath} tardo demasiado. Intenta recargar la vista.`);
        }
      }, FIRESTORE_READ_TIMEOUT_MS);

      const unsubscribe = onSnapshot(
        this.collectionQuery,
        (snapshot) => {
          clearTimeout(initialLoadTimeout);
          this.readErrorSignal.set('');
          this.loadingSignal.set(false);
          this.itemsSignal.set(
            snapshot.docs
              .filter((item) => !item.metadata.hasPendingWrites)
              .map((item) => ({ id: item.id, ...item.data() }) as T),
          );
        },
        (error) => {
          clearTimeout(initialLoadTimeout);
          console.error(`No se pudo leer ${this.collectionPath}`, error);
          this.readErrorSignal.set(error.message);
          this.loadingSignal.set(false);
        },
      );

      onCleanup(() => {
        clearTimeout(initialLoadTimeout);
        unsubscribe();
      });
    });
  }

  refreshFromServer(): Promise<void> {
    this.loadingSignal.set(true);

    return this.withReadTimeout(
      getDocsFromServer(this.collectionQuery),
      `La consulta de ${this.collectionPath} no respondio a tiempo.`,
    )
      .then((snapshot) => {
        this.readErrorSignal.set('');
        this.itemsSignal.set(
          snapshot.docs
            .filter((item) => !item.metadata.hasPendingWrites)
            .map((item) => ({ id: item.id, ...item.data() }) as T),
        );
      })
      .catch((error) => {
        console.error(`No se pudo actualizar ${this.collectionPath} desde servidor`, error);
        this.readErrorSignal.set(error.message);
        throw error;
      })
      .finally(() => {
        this.loadingSignal.set(false);
      });
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
