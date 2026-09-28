import assert from 'node:assert/strict';
import test from 'node:test';

import {
  capabilityFailureCount,
  clearCapabilityFailures,
  reportCapability,
  reportCapabilityFailure,
  resetCapabilityReport,
} from '../scripts/capability_report.js';

/** Capture console output for the duration of `run`. */
function captured(run) {
  const lines = [];
  const realWarn = console.warn;
  const realLog = console.log;
  console.warn = (...a) => lines.push(['warn', a.join(' ')]);
  console.log = (...a) => lines.push(['log', a.join(' ')]);
  try {
    run();
  } finally {
    console.warn = realWarn;
    console.log = realLog;
  }
  return lines;
}

test('a disabled capability announces once, not per call', () => {
  resetCapabilityReport();
  const lines = captured(() => {
    for (let i = 0; i < 50; i += 1) {
      reportCapability('telegram-alerting', {
        enabled: false,
        reason: 'no token',
        remedy: 'set TELEGRAM_BOT_TOKEN',
      });
    }
  });
  assert.equal(lines.length, 1, 'a 30s poll loop must not bury its own notice');
  assert.equal(lines[0][0], 'warn');
  assert.match(lines[0][1], /DISABLED/);
  assert.match(lines[0][1], /no token/);
  assert.match(lines[0][1], /set TELEGRAM_BOT_TOKEN/, 'the notice must carry the remedy');
});

test('reportCapability returns the flag so it composes as a guard', () => {
  resetCapabilityReport();
  captured(() => {
    assert.equal(reportCapability('x', { enabled: false, reason: 'r' }), false);
    assert.equal(reportCapability('y', { enabled: true }), true);
  });
});

test('recovering re-announces, so an operator sees the state change', () => {
  resetCapabilityReport();
  const lines = captured(() => {
    reportCapability('gemini-enrichment', { enabled: false, reason: 'no key' });
    reportCapability('gemini-enrichment', { enabled: true });
  });
  assert.equal(lines.length, 2);
  assert.match(lines[0][1], /DISABLED/);
  assert.match(lines[1][1], /ENABLED/);
});

test('first failure is loud, then the notice widens instead of flooding', () => {
  resetCapabilityReport();
  const lines = captured(() => {
    for (let i = 0; i < 250; i += 1) {
      reportCapabilityFailure('gemini-enrichment', new Error('API key not valid'));
    }
  });
  // 1st, 10th, 100th, 200th — visible while persistent, never per-cycle spam.
  assert.equal(lines.length, 4);
  assert.match(lines[0][1], /FAILING \(1x\).*API key not valid/);
  assert.match(lines[3][1], /FAILING \(200x\)/);
  assert.equal(capabilityFailureCount('gemini-enrichment'), 250);
});

test('failure tally survives for health output and clears on success', () => {
  resetCapabilityReport();
  captured(() => {
    reportCapabilityFailure('telegram-alerting', new Error('boom'));
    reportCapabilityFailure('telegram-alerting', new Error('boom'));
  });
  assert.equal(capabilityFailureCount('telegram-alerting'), 2);
  clearCapabilityFailures('telegram-alerting');
  assert.equal(capabilityFailureCount('telegram-alerting'), 0);
});

test('a non-Error rejection still produces a readable notice', () => {
  resetCapabilityReport();
  const lines = captured(() => {
    reportCapabilityFailure('gemini-enrichment', 'ECONNRESET');
    resetCapabilityReport();
    reportCapabilityFailure('gemini-enrichment', undefined);
  });
  assert.match(lines[0][1], /ECONNRESET/);
  assert.match(lines[1][1], /unknown error/);
});
