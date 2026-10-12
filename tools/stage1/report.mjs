import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from '../local/config.mjs';

export function reporter(suite) {
  const cases = [];
  return {
    check(id, finding, stage, actual, baseline, expected, evidence) {
      const historicalBaseline = baseline;
      // E2-C01/C01.1/C01.2 replace stage-2 characterization with the approved
      // authorization contract. Keep the former baseline in every report.
      if (stage === 2) {
        if (id === 'CUSTOM-EDIT-GROUP' || id === 'ACADEMIC-LEGACY-FLAGS') expected = false;
        baseline = expected;
      }
      const baselineMatches = JSON.stringify(actual) === JSON.stringify(baseline);
      const contractMatches = expected === null ? null : JSON.stringify(actual) === JSON.stringify(expected);
      cases.push({ historicalBaseline, contractVersion: stage === 2 ? 'E2-v0.4-R01' : 'E1', id, finding, stage, actual, baseline, expected, baselineMatches, contractMatches, evidence });
      console.log(`${!baselineMatches ? 'BASELINE_CHANGED' : contractMatches === false ? 'KNOWN_CONTRACT_FAILURE' : contractMatches === null ? 'DECISION_PENDING' : 'CONTRACT_PASS'} ${id} ${finding}`);
    },
    finish() {
      const directory = resolve(root, '.local/test-results');
      mkdirSync(directory, { recursive: true });
      const summary = { cases: cases.length, characterizationPassed: cases.filter((c) => c.baselineMatches).length, contractPassed: cases.filter((c) => c.contractMatches === true).length, knownContractFailures: cases.filter((c) => c.contractMatches === false).length, decisionsPending: cases.filter((c) => c.contractMatches === null).length };
      writeFileSync(resolve(directory, `${suite}.json`), JSON.stringify({ suite, testedAt: new Date().toISOString(), summary, cases }, null, 2));
      console.log(JSON.stringify(summary));
      assert.ok(cases.every((c) => c.baselineMatches), 'Comportamiento distinto del caracterizado: revisar reporte; no actualizar expectativas sin investigar.');
    },
  };
}
