export function tunnelOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.[a-z0-9-]+\.devtunnels\.ms$/.test(url.hostname)
    || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Usa la URL HTTPS exacta de VS Code, sin rutas ni parametros.');
  return url.origin;
}
export function permittedOrigin(headers, allowed) {
  if (!headers.origin || headers.origin === 'http://127.0.0.1:4206' || (allowed && headers.origin === allowed)) return true;
  // VS Code rewrites Host AND Origin to localhost when proxying. Trust this
  // pair only with the exact configured public forwarded host; no wildcards.
  return Boolean(allowed && headers.host === 'localhost:4206'
    && headers.origin === 'http://localhost:4206'
    && headers['x-forwarded-host'] === new URL(allowed).host);
}
export function target(path, config) {
  // No emulator admin REST APIs and no Auth signup/import/delete endpoints.
  if (/^\/identitytoolkit\.googleapis\.com\/v1\/accounts:(signInWithPassword|lookup)$/.test(path)
    || path === '/securetoken.googleapis.com/v1/token') return config.auth;
  if (/^\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel$/.test(path)) return config.firestore;
  if (/^\/demo-spai-tup\/us-central1\/[A-Za-z][A-Za-z0-9]*$/.test(path)) return config.functions;
  if (/^\/v0\/b\/demo-spai-tup\.appspot\.com\/o(?:\/|$)/.test(path)) return config.storage;
  return null;
}
