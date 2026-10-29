// Import-only supervisor. No seed, reset, migration, or production access.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as probeServer } from 'node:net';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, statSync, openSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { config, root, localEnvironment, recoveryTest, isolatedTest, testOffset, cliConfigFile, sessionFile, verifyHub, loggingPort, websocketPort, acceptanceSlot } from './config.mjs';

const r02Review = true;
assert(isolatedTest && [43000,44000,46000].includes(acceptanceSlot), 'Solo instancias independientes de aceptación A/B.');
assert.equal(process.versions.node.split('.')[0], '22');
const dir = resolve(root, '.local/acceptance-saved');
const latestFile = resolve(dir, 'latest.json');
assert(existsSync(latestFile), 'Falta exportación propia; no se regeneran fixtures.');
const latest = JSON.parse(readFileSync(latestFile));
const approvedSource = null;
const source = resolve(latest.path);
assert(source.startsWith(dir + '/') || source.startsWith(dir + '\\'), 'Exportación fuera de instancia.');
assert(latest.files, 'Se requieren hashes verificables.');
const metadata = JSON.parse(readFileSync(resolve(source, 'firebase-export-metadata.json')));
for (const service of ['auth', 'firestore', 'storage']) assert(metadata[service], `Falta exportacion ${service}`);
const users = JSON.parse(readFileSync(resolve(source, 'auth_export/accounts.json'))).users;
assert(users?.length, 'Exportacion Auth vacia');
for (const user of users) assert.match(user.email, /^demo\.[a-z0-9.]+@tecplayacar\.edu\.mx$/, 'Solo identidades sinteticas de la captura aprobada');
function manifest(path, base = path) {
  return Object.fromEntries(readdirSync(path).flatMap(name => {
    const file = resolve(path, name);
    return statSync(file).isDirectory() ? Object.entries(manifest(file, base)) : [[relative(base, file), createHash('sha256').update(readFileSync(file)).digest('hex')]];
  }));
}
const originalManifest = manifest(source);
if (latest?.files) assert.deepEqual(originalManifest, latest.files, 'La copia guardada cambió.');
if (process.argv.includes('--check')) {
  console.log(JSON.stringify({ source, users: users.length, files: Object.keys(originalManifest).length, historical: source === approvedSource, noServicesStarted: true }));
  process.exit(0);
}
for (const port of [...Object.entries(config).filter(([key]) => ['auth','firestore','functions','storage','hub','ui','control'].includes(key)).map(([, port]) => port), loggingPort, websocketPort, 9299 + testOffset, 9499 + testOffset]) {
  const socket = probeServer();
  await new Promise((ok, fail) => { socket.once('error', fail); socket.listen(port, '127.0.0.1', ok); });
  await new Promise(ok => socket.close(ok));
}
mkdirSync(dir, { recursive: true });
const cliConfig = JSON.parse(readFileSync(resolve(root, 'firebase.local.json')));
for (const key of ['auth','firestore','functions','storage','hub','ui']) cliConfig.emulators[key].port = config[key];
cliConfig.emulators.logging.port = loggingPort;
cliConfig.emulators.firestore.websocketPort = websocketPort;
cliConfig.emulators.eventarc = { host: config.host, port: 9299 + testOffset };
cliConfig.emulators.tasks = { host: config.host, port: 9499 + testOffset };
writeFileSync(cliConfigFile, JSON.stringify(cliConfig, null, 2));
const env = localEnvironment(), token = randomBytes(32).toString('hex');
const log = openSync(resolve(dir, 'emulators.log'), 'a');
const cli = ['node_modules/firebase-tools/lib/bin/firebase.js'];
const cliBase = ['--project', config.projectId, '--config', cliConfigFile, '--non-interactive'];
const child = spawn(process.execPath, [...cli, 'emulators:start', ...cliBase, '--only', 'auth,firestore,functions,storage', '--import', source], { cwd: root, env, stdio: ['ignore', log, log], detached: true, windowsHide: true });
child.on('error', error => console.error(error.message));
writeFileSync(sessionFile, JSON.stringify({ projectId: config.projectId, pid: process.pid, emulatorPid: child.pid, token, synthetic: true, ...(r02Review ? {scenario:process.env.SPAI_LOCAL_TEST_SLOT} : {recoveredFrom:'2026-10-16'}), source }));
let ready = false, busy = false, timer, stopping = false;
async function save() {
  const destination = resolve(dir, 'saved-' + Date.now());
  // The CLI's project locator is shared by simultaneous emulator sessions.
  // Export directly through the verified hub, never through that locator.
  await verifyHub();
  const response = await fetch(`http://${config.host}:${config.hub}/_admin/export`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:destination,initiatedBy:'SPAI persistent demo',targets:['auth','firestore','storage']}),signal:AbortSignal.timeout(120000)});
  assert.equal(response.status, 200, 'Fallo la exportacion; se conservan servicios y ultima copia.');
  const exported = JSON.parse(readFileSync(resolve(destination, 'firebase-export-metadata.json')));
  for (const service of ['auth','firestore','storage']) assert(exported[service]);
  assert.deepEqual(manifest(source), originalManifest, 'La exportacion de origen cambio.');
  writeFileSync(resolve(dir, 'latest.next.json'), JSON.stringify({ path: destination, at: new Date().toISOString(), files:manifest(destination), ...(r02Review ? {scenario:process.env.SPAI_LOCAL_TEST_SLOT} : {historicalSource:'2026-10-16'}) }));
  renameSync(resolve(dir, 'latest.next.json'), latestFile);
  console.log('Estado guardado: ' + destination);
}
async function stopChild() {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    await new Promise(ok => killer.once('exit', ok));
  } else process.kill(-child.pid, 'SIGINT');
}
const server = createServer(async (req, res) => {
  const reply = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (req.headers.origin || req.headers.authorization !== `Bearer ${token}`) return reply(403, {});
  if (req.method === 'GET' && req.url === '/health') return reply(200, { projectId: config.projectId, ready, ...(r02Review ? {scenario:process.env.SPAI_LOCAL_TEST_SLOT} : {historicalSource:'2026-10-16'}) });
  if (req.method !== 'POST' || !['/stop','/save'].includes(req.url)) return reply(404, { error: 'Reset y seed no disponibles.' });
  if (busy || !ready) return reply(409, { error: 'Guardado o inicio en curso; intenta de nuevo.' });
  busy = true;
  try {
    await save();
    if (req.url === '/stop') { stopping = true; ready = false; clearInterval(timer); await stopChild(); server.close(); }
    reply(200, { exported: true, stopped: stopping });
  } catch (e) { reply(500, { error: e.message }); }
  finally { busy = false; }
});
try {
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw Error('Emuladores terminaron; consulta .local/tunnel-recovery/emulators.log');
    try {
      await verifyHub();
      const r = await fetch(`http://${config.host}:${config.functions}/${config.projectId}/us-central1/syncUserProfileByEmail`, { method: 'POST', headers: {'content-type':'application/json'}, body:'{"data":{}}', signal: AbortSignal.timeout(3000) }).then(r => r.json());
      if (r.error?.status === 'UNAUTHENTICATED') { ready = true; break; }
    } catch {}
    await delay(1000);
  }
  assert(ready, 'Emuladores no listos. Consulta el registro.');
  await save();
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(config.control, config.host, ok); });
  timer = setInterval(async () => { if (busy || stopping) return; busy = true; try { await save(); } catch (e) { console.error(e.message); } finally { busy = false; } }, 300000);
  console.log(`${r02Review ? 'DEMO R02 RESTAURADA' : 'RECUPERACION HISTORICA LISTA'} — sin fixtures ni migración. Guardado cada 5 minutos.`);
  console.log(`Detener guardando: tarea SPAI: Guardar y detener ${r02Review ? 'demo R02' : 'recuperacion'}. No cierres la terminal a la fuerza.`);
} catch (error) {
  console.error(error.message); await stopChild(); server.close(); process.exitCode = 1;
}
async function onSignal() {
  if (stopping || busy || !ready) { console.error('Espera a que termine el guardado y usa la tarea de detencion.'); return; }
  busy = true;
  try { await save(); stopping = true; ready = false; clearInterval(timer); await stopChild(); server.close(); }
  catch (e) { console.error('No se detiene porque el guardado fallo: ' + e.message); }
  finally { busy = false; }
}
process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
