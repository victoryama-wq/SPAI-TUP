import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { NavigationError, provideRouter, withNavigationErrorHandler } from '@angular/router';

import { routes } from './app.routes';
import { provideFirebase } from './core/firebase/firebase.tokens';

const STALE_CHUNK_RELOAD_KEY = 'spai:stale-chunk-reload-at';
const STALE_CHUNK_RELOAD_WINDOW_MS = 30_000;

function recoverFromStaleChunk(error: NavigationError): void {
  const message = stringifyNavigationError(error.error);

  if (!isStaleChunkError(message) || typeof window === 'undefined') {
    return;
  }

  const lastReload = Number(window.sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) ?? '0');
  const now = Date.now();

  if (Number.isFinite(lastReload) && now - lastReload < STALE_CHUNK_RELOAD_WINDOW_MS) {
    console.error('SPAI no pudo cargar un modulo actualizado despues de recargar.', error.error);
    return;
  }

  window.sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(now));
  window.location.reload();
}

function stringifyNavigationError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase();
  }

  return String(error).toLowerCase();
}

function isStaleChunkError(message: string): boolean {
  return message.includes('failed to fetch dynamically imported module')
    || message.includes('importing a module script failed')
    || message.includes('loading chunk')
    || message.includes('chunkloaderror')
    || message.includes('mime type');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withNavigationErrorHandler(recoverFromStaleChunk)),
    provideFirebase(),
  ],
};
