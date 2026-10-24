import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { config, root } from '../config.mjs';

const source = readFileSync(resolve(root, 'src/app/core/firebase/firebase.runtime.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
mkdirSync(resolve(root, '.local'), { recursive: true });
// Node's test runner loads suites in parallel; never import another process's
// partially written module.
const path = resolve(root, `.local/firebase-runtime-${process.pid}.mjs`);
writeFileSync(path, output);
export const runtime = await import(pathToFileURL(path).href);
export const localConfig = {
  mode: 'local', emulators: config,
  firebase: { projectId: config.projectId, apiKey: 'demo-spai-tup-not-a-real-key', authDomain: config.host, storageBucket: `${config.projectId}.appspot.com`, appId: '1:000000000000:web:demo-spai-tup' },
};
