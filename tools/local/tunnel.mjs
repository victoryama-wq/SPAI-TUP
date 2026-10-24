import { createServer, request } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { config, root, sessionFile, recoveryTest, isolatedTest, testOffset, verifyHub } from './config.mjs';
import { tunnelOrigin, target, permittedOrigin } from './tunnel-policy.mjs';

const r02Review = process.argv.includes('--r02');
if (r02Review ? (!isolatedTest || testOffset !== 10000) : !recoveryTest) throw Error('Selecciona explícitamente recuperación histórica o revisión R02 aislada.');
const originFile = resolve(root, '.local/tunnel-recovery/origin.json');
if (process.argv[2] === '--origin') {
  const origin = tunnelOrigin(process.argv[3]);
  writeFileSync(originFile, JSON.stringify({ origin }));
  console.log('Origen HTTPS autorizado: ' + origin);
  process.exit(0);
}
const build = resolve(root, r02Review ? 'dist/spai-tup-r02-tunnel/browser' : 'dist/spai-tup-tunnel/browser');
statSync(resolve(build, 'index.html'));
const initial = JSON.parse(readFileSync(sessionFile));
if (initial.synthetic !== true || (!r02Review && initial.recoveredFrom !== '2026-10-16')) throw Error('Solo sesiones sintéticas autorizadas.');
await verifyHub();
if (r02Review) {
  const marker = await fetch(`http://127.0.0.1:${config.firestore}/v1/projects/demo-spai-tup/databases/(default)/documents/demo_escenario/r02`, {headers:{authorization:'Bearer owner'},signal:AbortSignal.timeout(5000)});
  if (!marker.ok || (await marker.json()).fields?.scenario?.stringValue !== 'r02-two-cycles-v1') throw Error('La sesión no pertenece al escenario R02 de dos ciclos. No se publica.');
}
const health = await fetch(`http://127.0.0.1:${config.control}/health`, {headers:{authorization:`Bearer ${initial.token}`}}).then(r => r.json());
if (!health.ready) throw Error('La sesión aún no está lista.');
const local = 'http://127.0.0.1:4206';
const csp = "default-src 'self'; upgrade-insecure-requests; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon'};
createServer((req, res) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) console.warn(JSON.stringify({status:res.statusCode,path:req.url?.split('?')[0],host:req.headers.host,origin:req.headers.origin,forwardedHost:req.headers['x-forwarded-host']}));
  });
  const fail = (code, message) => { res.writeHead(code, {'content-type':'text/plain; charset=utf-8'}); res.end(message); };
  res.setHeader('cache-control','no-store'); res.setHeader('x-content-type-options','nosniff'); res.setHeader('content-security-policy',csp);
  let allowed;
  try {
    const session = JSON.parse(readFileSync(sessionFile));
    if (session.synthetic !== true || session.token !== initial.token || session.emulatorPid !== initial.emulatorPid) return fail(503,'Sesion cambiada; reinicia la pasarela.');
    allowed = existsSync(originFile) ? tunnelOrigin(JSON.parse(readFileSync(originFile)).origin) : null;
  } catch { return fail(503,'Sesion u origen no disponible.'); }
  if (!['127.0.0.1','::1'].includes(req.socket.remoteAddress)) return fail(403,'Solo reenviador local.');
  const hosts = ['127.0.0.1:4206', 'localhost:4206', ...(allowed ? [new URL(allowed).host] : [])];
  if (!hosts.includes(req.headers.host) || (req.headers['x-forwarded-host'] && !hosts.includes(req.headers['x-forwarded-host']))) return fail(403,'Configura la URL exacta del tunel.');
  if (!permittedOrigin(req.headers, allowed)) return fail(403,'Origen no permitido.');
  if (/^\s*bearer\s+owner\s*$/i.test(req.headers.authorization ?? '')) return fail(403,'Administracion no publicada.');
  let path;
  try { path = decodeURIComponent(new URL(req.url, local).pathname); } catch { return fail(400,'Ruta invalida.'); }
  const port = target(path, config);
  if (port) {
    if (!['GET','POST','PUT','PATCH','DELETE','OPTIONS'].includes(req.method)) return fail(405,'Metodo no permitido.');
    const headers = { ...req.headers, host: `127.0.0.1:${port}` };
    delete headers.cookie; // Tunnel authentication stays at the edge, never in emulators.
    for (const key of Object.keys(headers)) if (key.startsWith('x-forwarded-') || key.startsWith('x-ms-')) delete headers[key];
    const upstream = request({host:'127.0.0.1',port,path:req.url,method:req.method,headers}, reply => { res.writeHead(reply.statusCode,reply.headers); reply.pipe(res); });
    upstream.on('error',()=> { if (!res.headersSent) fail(502,'Emulador no disponible.'); else res.destroy(); });
    req.on('aborted',()=>upstream.destroy()); res.on('close',()=> {if (!res.writableFinished) upstream.destroy();}); req.pipe(upstream); return;
  }
  if (!['GET','HEAD'].includes(req.method) || /^\/(emulator|v1|www|\.local|health|reset|stop|save|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|google\.firestore|demo-spai-tup|v0)(\/|\.|$)/.test(path)) return fail(404,'No publicado.');
  let file = resolve(build, '.' + path);
  if (file !== build && !file.startsWith(build + sep)) return fail(403,'Ruta no permitida.');
  try { if (!statSync(file).isFile()) file = resolve(build,'index.html'); }
  catch { if (extname(path)) return fail(404,'Archivo no encontrado.'); file = resolve(build,'index.html'); }
  res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});
  if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
}).listen(4206,'127.0.0.1',()=>console.log(`PASARELA LISTA http://127.0.0.1:4206 — ${r02Review ? 'R02 dos ciclos / Firestore 18080' : 'recuperación histórica / Firestore 48080'} — reenvía SOLO 4206 en VS Code; configura la URL HTTPS exacta con la tarea de origen.`));
