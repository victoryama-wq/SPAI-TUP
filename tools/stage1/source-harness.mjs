import ts from 'typescript';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from '../local/config.mjs';

// Execute actual TypeScript members. Only dependency boundaries are substituted;
// no copied permission predicates, state transitions or request algorithms.
export function sourceMembers(path, className, names, context = {}, globals = {}) {
  const code = readFileSync(resolve(root, path), 'utf8');
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find((s) => ts.isClassDeclaration(s) && s.name?.text === className);
  if (!declaration) throw new Error(`Clase no encontrada: ${className}`);
  const members = names.map((name) => {
    const member = declaration.members.find((m) => m.name?.getText(source) === name);
    if (!member) throw new Error(`Miembro no encontrado: ${className}.${name}`);
    return member.getText(source);
  });
  const generated = `class Subject { ${members.join('\n')} }; Subject;`;
  const js = ts.transpileModule(generated, { compilerOptions: { target: ts.ScriptTarget.ES2022, useDefineForClassFields: false } }).outputText;
  const Subject = vm.runInNewContext(js, { computed: (fn) => fn, console, setTimeout, clearTimeout, Date, ...globals }, { filename: path });
  // Property initializers read this.*; inherited fake collaborators are available
  // before construction. Methods and property expressions themselves are original.
  Object.assign(Subject.prototype, context);
  return new Subject();
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  // Observe a deliberately discarded rejection without hiding its outcome.
  const outcome = promise.then(() => 'confirmed', (e) => e.code || e.message);
  return { promise, resolve, reject, outcome };
}
