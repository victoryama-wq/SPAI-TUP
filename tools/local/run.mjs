import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { config, root, sessionFile, localEnvironment, verifyHub, isolatedTest, cliConfigFile, loggingPort, websocketPort } from './config.mjs';
import { seed } from './seed.mjs';

const testMode = process.argv.includes('--test');
const reviewMode = process.argv.includes('--review');
if (reviewMode && (!isolatedTest || testMode)) throw new Error('La revisión humana requiere un entorno aislado independiente de la suite.');
if (isolatedTest && !testMode && !reviewMode) throw new Error('El preset aislado solo admite ensayos sintéticos; no modifica la demo compartida.');
if (isolatedTest) {
  const cli = JSON.parse(readFileSync(resolve(root, 'firebase.local.json'), 'utf8'));
  for (const key of ['auth','firestore','functions','storage','hub','ui']) cli.emulators[key].port = config[key];
  cli.emulators.logging.port = loggingPort; cli.emulators.firestore.websocketPort = websocketPort;
  cli.emulators.eventarc = {host:config.host, port:19299};
  cli.emulators.tasks = {host:config.host, port:19499};
  mkdirSync(resolve(root, '.local'), {recursive:true}); writeFileSync(cliConfigFile, JSON.stringify(cli,null,2));
}
// Environment tests always use fixtures; never ingest the owner's local copy.
if (testMode) process.env.SPAI_LOCAL_SYNTHETIC = 'true';
const token = randomBytes(32).toString('hex');
let child;
let ready = false;
let changing = false;
let stopping = false;

async function assertFree(port) {
  const server = createServer();
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, config.host, ok); });
  await new Promise((ok) => server.close(ok));
}

function saveSession() {
  mkdirSync(resolve(root, '.local'), { recursive: true });
  writeFileSync(sessionFile, JSON.stringify({ projectId: config.projectId, pid: process.pid, emulatorPid: child?.pid, token, synthetic: process.env.SPAI_LOCAL_SYNTHETIC === 'true' }));
}

async function runNode(args) {
  const task = spawn(process.execPath, args, { cwd: root, env: localEnvironment(), stdio: 'inherit', windowsHide: true });
  const code = await new Promise((ok, fail) => { task.once('error', fail); task.once('exit', ok); });
  if (code !== 0) throw new Error(`Comprobacion fallida: ${args.join(' ')} (${code}).`);
}

async function stopEmulators() {
  ready = false;
  const current = child;
  if (!current || current.exitCode !== null) return;
  // Only the process tree launched by this supervisor is stopped, never a port owner.
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(current.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    await new Promise((ok, fail) => { killer.once('error', fail); killer.once('exit', ok); });
  } else {
    process.kill(-current.pid, 'SIGINT');
  }
  if (current.exitCode === null) await Promise.race([new Promise((ok) => current.once('exit', ok)), delay(10000).then(() => { throw new Error('No se pudo detener la sesion local.'); })]);
  child = undefined;
}

async function startEmulators() {
  for (const port of [config.auth, config.firestore, config.functions, config.storage, config.hub, config.ui, loggingPort, websocketPort]) await assertFree(port);
  const args = ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:start', '--project', config.projectId, '--config', cliConfigFile, '--only', 'auth,firestore,functions,storage', '--non-interactive'];
  child = spawn(process.execPath, args, { cwd: root, env: localEnvironment(), stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32' });
  child.once('error', (error) => { console.error(error); });
  saveSession();
  const deadline = Date.now() + 150000;
  let lastError;
  let servicesReady = false;
  while (Date.now() < deadline) {
    if (stopping) return;
    if (child.exitCode !== null) throw new Error(`Firebase CLI termino con codigo ${child.exitCode}.`);
    try {
      await verifyHub();
      const response = await fetch(`http://${config.host}:${config.functions}/${config.projectId}/us-central1/syncUserProfileByEmail`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"data":{}}', signal: AbortSignal.timeout(3000),
      });
      const result = await response.json();
      if (result.error?.status !== 'UNAUTHENTICATED') throw new Error('Functions aun no esta listo.');
      servicesReady = true;
      break;
    } catch (error) { lastError = error; await delay(1000); }
  }
  if (!servicesReady) throw new Error(`Emuladores no disponibles: ${lastError?.message}`);
  await seed(); // Fail once on a data error; never retry a partially loaded snapshot.
  ready = true;
  console.log(`DEMO listo. UI http://127.0.0.1:${config.ui}${isolatedTest ? (reviewMode ? ' — revisión humana aislada; detener con Ctrl+C' : ' — ensayo aislado; cierre automatico al terminar') : ' — web: npm start — detener: npm run local:stop'}`);
}

const server = createHttpServer(async (request, response) => {
  response.setHeader('content-type', 'application/json');
  const reply = (status, body) => { response.writeHead(status); response.end(JSON.stringify(body)); };
  if (request.headers.origin || request.headers.authorization !== `Bearer ${token}`) return reply(403, { error: 'Control local no autorizado.' });
  if (request.method === 'GET' && request.url === '/health') return reply(200, { projectId: config.projectId, ready });
  if (request.method !== 'POST' || !['/stop', '/reset', '/seed'].includes(request.url)) return reply(404, { error: 'Accion no reconocida.' });
  if ((changing || !ready) && request.url !== '/stop') return reply(409, { error: 'La sesion aun no esta lista o esta cambiando.' });
  changing = true;
  try {
    if (request.url === '/stop') {
      await shutdown();
      reply(200, { stopped: true });
    } else {
      if (request.url === '/reset') { await stopEmulators(); await startEmulators(); }
      else await seed();
      reply(200, { ready, action: request.url });
    }
  } catch (error) { reply(500, { error: error.message }); }
  finally { changing = false; }
});

async function shutdown() {
  if (stopping) return;
  stopping = true;
  await stopEmulators();
  rmSync(sessionFile, { force: true });
  server.close();
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void shutdown());

try {
  if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Usa Node.js 22 (ver .nvmrc) antes de iniciar emuladores.');
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(config.control, config.host, ok); });
  if (testMode) await runNode(['--test', 'tools/local/tests/config.test.mjs', 'tools/local/tests/snapshot.test.mjs']);
  await startEmulators();
  if (reviewMode) {
    await runNode(['tools/e2-r01/prepare-demo.mjs']);
    await runNode(['tools/e2-r01/prepare-t10.mjs']);
    console.log('Revisión T10 preparada. En otra terminal: npx ng serve --configuration isolated --host 127.0.0.1 --port 4202. Ctrl+C aquí detiene únicamente esta sesión aislada.');
  }
  if (testMode && !stopping) {
    await runNode(['tools/local/tests/integration.mjs']);
    if (process.argv.includes('--r01')) await runNode(['tools/e2-r01/integration.mjs']);
    if (process.argv.includes('--stage1')) {
      await runNode(['tools/stage1/logic.mjs']);
      await runNode(['tools/stage1/rules.mjs']);
    }
    await runNode(['tools/local/tests/reset.mjs']);
    if (process.argv.includes('--ui')) {
      if (isolatedTest) await runNode(['tools/e2-r01/prepare-demo.mjs']);
      await runNode(['node_modules/@playwright/test/cli.js', 'test', '--config', 'tools/e2-r01/playwright.config.mjs']);
    }
    await stopEmulators();
    await runNode(['tools/local/tests/offline.mjs']);
    await shutdown();
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  await shutdown();
}
