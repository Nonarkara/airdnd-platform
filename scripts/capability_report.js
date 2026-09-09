/**
 * A capability that turns itself off must say so.
 *
 * This pipeline degrades rather than crashes — Supabase unreachable, no Gemini
 * key, no Telegram token — and that is the right instinct. What was wrong was
 * doing it in silence. `integrity_check.js` returned from `sendTelegramAlert()`
 * with no log at all when credentials were absent, so an operator who believed
 * alerting was armed had no alarm, and no way to find out. An alarm that
 * quietly disarms itself is worse than none, because you stop checking.
 *
 * tasks/lessons.md records the same shape costing six days: a fallback changed
 * the meaning of a file, wrote it under the same name, and said nothing.
 *
 * The rule: announce the decision once, where an operator reads it, at the
 * moment it is made. Once — not per call — so a 30-second poll loop cannot bury
 * the notice it is trying to deliver.
 */

const announced = new Set();
const failureCounts = new Map();

/**
 * Declare whether a capability is on, and say why if it is not.
 * Returns `enabled`, so it composes as a guard:
 *
 *   if (!reportCapability('x', { enabled, reason, remedy })) return;
 */
export function reportCapability(name, { enabled, reason = '', remedy = '' } = {}) {
  const state = enabled ? 'on' : 'off';
  const key = `${name}:${state}`;
  if (!announced.has(key)) {
    announced.add(key);
    if (enabled) {
      console.log(`[capability] ${name}: ENABLED`);
    } else {
      const fix = remedy ? ` · fix: ${remedy}` : '';
      console.warn(`[capability] ${name}: DISABLED — ${reason}${fix}`);
    }
  }
  return Boolean(enabled);
}

/**
 * Record that a capability which reported ENABLED has failed in use.
 *
 * This is the case a startup check cannot catch: a key that is present but
 * revoked, a quota that ran out at 3am. Announce the first failure immediately,
 * then at widening intervals — a persistent outage must stay visible without a
 * per-cycle retry flooding the log into uselessness.
 *
 * Returns the running failure count so callers can surface it to a health check.
 */
export function reportCapabilityFailure(name, error) {
  const count = (failureCounts.get(name) || 0) + 1;
  failureCounts.set(name, count);
  if (count === 1 || count === 10 || count % 100 === 0) {
    const message = error?.message || String(error ?? 'unknown error');
    console.warn(`[capability] ${name}: FAILING (${count}x) — ${message}`);
  }
  return count;
}

/** Consecutive-ish failure tally for a capability, for heartbeat/health output. */
export function capabilityFailureCount(name) {
  return failureCounts.get(name) || 0;
}

/** Clear the tally after a success, so a recovered capability re-announces. */
export function clearCapabilityFailures(name) {
  failureCounts.delete(name);
}

/** Test seam. */
export function resetCapabilityReport() {
  announced.clear();
  failureCounts.clear();
}
