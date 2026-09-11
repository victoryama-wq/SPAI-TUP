import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './config.mjs';
import { sourceSelection, prepareSnapshot } from './snapshot.mjs';

const mode = process.argv[2];
if (!['snapshot', 'synthetic'].includes(mode)) throw new Error('Elige snapshot o synthetic.');
mkdirSync(resolve(root, '.local'), { recursive: true });
if (mode === 'synthetic') {
  rmSync(sourceSelection, { force: true });
  console.log('Seleccionados datos ficticios. Ejecuta local:reset o inicia local:emulators.');
} else {
  const latest = JSON.parse(readFileSync(resolve(root, '.local/source-data/latest.json'), 'utf8'));
  const pending = `${sourceSelection}.pending`;
  writeFileSync(pending, JSON.stringify({ mode, file: latest.file, sha256: latest.sha256 }, null, 2));
  // Verify the candidate before replacing the previous local choice.
  const { createHash } = await import('node:crypto');
  if (latest.file.includes('/') || latest.file.includes('\\') || latest.file.includes('..')) throw new Error('Nombre de copia invalido.');
  const bytes = readFileSync(resolve(root, '.local/source-data', latest.file));
  if (createHash('sha256').update(bytes).digest('hex') !== latest.sha256) throw new Error('Hash de copia incompatible.');
  const plan = prepareSnapshot(JSON.parse(bytes));
  renameSync(pending, sourceSelection);
  console.log(`Seleccionada copia: ${plan.sourceCount} documentos; ${plan.mappings.filter((a) => a.copiedProfile).length} perfiles vinculados y ${plan.mappings.filter((a) => !a.copiedProfile).length} perfiles DEMO adicionales.`);
  console.log('Ejecuta local:reset o inicia local:emulators. No se vuelve a consultar la BD online.');
}
