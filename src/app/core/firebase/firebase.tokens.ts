import { InjectionToken, Provider } from '@angular/core';
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { Functions } from 'firebase/functions';
import { FirebaseStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';
import { initializeFirebaseRuntime } from './firebase.runtime';

type FirebaseRuntime = ReturnType<typeof initializeFirebaseRuntime>;
const FIREBASE_RUNTIME = new InjectionToken<FirebaseRuntime>('Firebase runtime');
export const FIREBASE_APP = new InjectionToken<FirebaseApp>('Firebase app');
export const FIREBASE_AUTH = new InjectionToken<Auth>('Firebase auth');
export const FIREBASE_DB = new InjectionToken<Firestore>('Cloud Firestore');
export const FIREBASE_FUNCTIONS = new InjectionToken<Functions>('Cloud Functions');
export const FIREBASE_STORAGE = new InjectionToken<FirebaseStorage>('Cloud Storage');

export function provideFirebase(): Provider[] {
  return [
    { provide: FIREBASE_RUNTIME, useFactory: () => initializeFirebaseRuntime(environment) },
    { provide: FIREBASE_APP, useFactory: (runtime: FirebaseRuntime) => runtime.app, deps: [FIREBASE_RUNTIME] },
    { provide: FIREBASE_AUTH, useFactory: (runtime: FirebaseRuntime) => runtime.auth, deps: [FIREBASE_RUNTIME] },
    { provide: FIREBASE_DB, useFactory: (runtime: FirebaseRuntime) => runtime.db, deps: [FIREBASE_RUNTIME] },
    { provide: FIREBASE_FUNCTIONS, useFactory: (runtime: FirebaseRuntime) => runtime.functions, deps: [FIREBASE_RUNTIME] },
    { provide: FIREBASE_STORAGE, useFactory: (runtime: FirebaseRuntime) => runtime.storage, deps: [FIREBASE_RUNTIME] },
  ];
}
