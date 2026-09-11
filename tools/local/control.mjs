import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { config, sessionFile, assertLocalConfig } from './config.mjs';

export async function control(action) {
  assertLocalConfig();
  if (!['stop', 'reset', 'seed', 'health'].includes(action)) throw new Error('Accion local no reconocida.');
  const session = JSON.parse(readFileSync(sessionFile, 'utf8'));
  if (session.projectId !== config.projectId) throw new Error('La sesion no es DEMO.');
  const response = await fetch(`http://${config.host}:${config.control}/${action}`, {
    method: action === 'health' ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${session.token}` }, signal: AbortSignal.timeout(180000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Fallo del control local.');
  return body;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  control(process.argv[2]).then(console.log).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
