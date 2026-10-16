// Bound one intake cycle. A GramJS call can await forever on a half-open
// MTProto socket: the process stays alive, the daemon sees nothing wrong,
// and intake silently stops (11 Oct 2026, ~5 days lost). Rejecting lets the
// caller exit non-zero so daemon.sh restarts a fresh session.
export class CycleTimeoutError extends Error {
  constructor(ms) {
    super(`Intake cycle exceeded ${ms}ms`);
    this.name = 'CycleTimeoutError';
  }
}

export function withCycleTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new CycleTimeoutError(ms)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
