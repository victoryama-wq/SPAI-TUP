import { createServer, request as proxyRequest } from 'node:http';
import { networkInterfaces } from 'node:os';
import { BlockList } from 'node:net';
import { readFileSync, statSync, createReadStream, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { config, root, sessionFile, verifyHub, isolatedTest } from './config.mjs';

const host = process.argv[2];
const lanPort = isolatedTest ? 4203 : 4201;
const iface = Object.values(networkInterfaces()).flat().find((item) => item?.family === 'IPv4' && !item.internal && item.address === host);
if (!iface || !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) throw new Error('Indica una IPv4 privada de este equipo.');
const clients = new BlockList();
clients.addSubnet(iface.cidr.split('/')[0], Number(iface.cidr.split('/')[1]), 'ipv4');
const origin = `http://${host}:${lanPort}`;
const build = resolve(root, 'dist/spai-tup-lan/browser');
statSync(resolve(build, 'index.html'));
const initial = JSON.parse(readFileSync(sessionFile, 'utf8'));
if (initial.synthetic !== true) throw new Error('Inicia emuladores con SPAI_LOCAL_SYNTHETIC=true. No se permite compartir una copia privada.');
await verifyHub();
const health = await fetch(`http://127.0.0.1:${config.control}/health`, { headers: { authorization: `Bearer ${initial.token}` } }).then((r) => r.json());
if (!health.ready) throw new Error('La demo aun no esta lista.');

function target(path) {
  if (path.startsWith('/identitytoolkit.googleapis.com/') || path.startsWith('/securetoken.googleapis.com/')) return config.auth;
  if (path.startsWith('/google.firestore.v1.Firestore/')) return config.firestore;
  if (path.startsWith('/demo-spai-tup/us-central1/')) return config.functions;
  if (path.startsWith('/v0/b/demo-spai-tup.appspot.com/')) return config.storage;
  return null;
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  const fail = (status, message) => { res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }); res.end(message); };
  // Recheck ownership and data mode on every request; restarting a supervisor
  // against a private snapshot must immediately invalidate this LAN gateway.
  try {
    const current = JSON.parse(readFileSync(sessionFile, 'utf8'));
    if (current.synthetic !== true || current.token !== initial.token || current.emulatorPid !== initial.emulatorPid) return fail(503, 'Sesion sintetica cambiada. Reinicia la pasarela.');
  } catch { return fail(503, 'Sesion local no disponible.'); }
  if (!clients.check(req.socket.remoteAddress, 'ipv4') || req.headers.host !== `${host}:${lanPort}`) return fail(403, 'Solo red local.');
  if (req.headers.origin && req.headers.origin !== origin) return fail(403, 'Origen no permitido.');
  if (/^\s*bearer\s+owner\s*$/i.test(req.headers.authorization ?? '')) return fail(403, 'Acceso administrativo no publicado.');
  let path;
  try { path = decodeURIComponent(new URL(req.url, origin).pathname); } catch { return fail(400, 'Ruta invalida.'); }
  const port = target(path);
  if (port) {
    const upstream = proxyRequest({ host: '127.0.0.1', port, path: req.url, method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${port}` } }, (reply) => {
      res.writeHead(reply.statusCode, reply.headers);
      reply.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) fail(502, 'Emulador no disponible.'); else res.destroy(); });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method) || /^\/(emulator|v1|www|\.local|health|reset|stop)(\/|$)/.test(path)) return fail(404, 'No publicado.');
  let file = resolve(build, `.${path}`);
  if (!file.startsWith(build + sep) && file !== build) return fail(403, 'Ruta no permitida.');
  try { if (!statSync(file).isFile()) file = resolve(build, 'index.html'); }
  catch { if (extname(path)) return fail(404, 'Archivo no encontrado.'); file = resolve(build, 'index.html'); }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY' });
  if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
});
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(lanPort, host, () => {
  writeFileSync(resolve(root, isolatedTest ? '.local/lan-session-isolated.json' : '.local/lan-session.json'), JSON.stringify({ pid: process.pid, host, port: lanPort, synthetic: true }));
  console.log(`DEMO LAN lista: ${origin} — solo datos sinteticos; administracion en loopback.`);
});
