import { effect, inject, signal } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  Firestore,
  onSnapshot,
  orderBy,
  query,
  QueryConstraint,
  setDoc,
  UpdateData,
  updateDoc,
} from 'firebase/firestore';
import { AuthService } from '../auth/auth.service';

export abstract class FirestoreRepository<T extends { id: string }> {
  private readonly authService = inject(AuthService);
  private readonly itemsSignal = signal<T[]>([]);
  private readonly readErrorSignal = signal('');

  readonly items = this.itemsSignal.asReadonly();
  readonly readError = this.readErrorSignal.asReadonly();

  protected constructor(
    protected readonly firestore: Firestore,
    protected readonly collectionPath: string,
    ...constraints: QueryConstraint[]
  ) {
    const ref = collection(this.firestore, this.collectionPath);
    const collectionQuery = constraints.length
      ? query(ref, ...constraints)
      : query(ref, orderBy('createdAt', 'desc'));

    effect((onCleanup) => {
      if (!this.authService.isAuthenticated()) {
        this.itemsSignal.set([]);
        this.readErrorSignal.set('');
        return;
      }

      const unsubscribe = onSnapshot(
        collectionQuery,
        (snapshot) => {
          this.readErrorSignal.set('');
          this.itemsSignal.set(
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T),
          );
        },
        (error) => {
          console.error(`No se pudo leer ${this.collectionPath}`, error);
          this.readErrorSignal.set(error.message);
          this.itemsSignal.set([]);
        },
      );

      onCleanup(unsubscribe);
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
