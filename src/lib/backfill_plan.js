// Pure helpers for scripts/backfill_local.js (no I/O, unit-tested).
//
// The backfill walks each channel backwards from the newest message, one page
// at a time, and keeps only messages inside [since, until]. Progress is kept in
// a small JSON state file so an interrupted run resumes where it stopped.

// macOS `sysctl vm.swapusage` →
//   "total = 18432.00M  used = 17496.38M  free = 935.62M  (encrypted)"
// Returns { totalMb, usedMb, pct } or null when the line cannot be parsed.
export function parseSwapUsage(text) {
  const num = (label) => {
    const m = new RegExp(`${label}\\s*=\\s*([\\d.]+)([KMGT])`, 'i').exec(String(text || ''));
    if (!m) return null;
    const scale = { K: 1 / 1024, M: 1, G: 1024, T: 1024 * 1024 }[m[2].toUpperCase()];
    return Number(m[1]) * scale;
  };
  const totalMb = num('total');
  const usedMb = num('used');
  if (totalMb === null || usedMb === null) return null;
  return { totalMb, usedMb, pct: totalMb > 0 ? (usedMb / totalMb) * 100 : 0 };
}

// Swap gate. No swap configured (total 0) is fine; an unreadable reading is
// treated as unsafe so the backfill never runs blind on a swapping machine.
export function swapGate(usage, maxPct = 90) {
  if (!usage) return { ok: false, reason: 'could not read swap usage' };
  if (usage.totalMb === 0) return { ok: true, reason: 'no swap in use' };
  const pct = Math.round(usage.pct * 10) / 10;
  return usage.pct > maxPct
    ? { ok: false, reason: `swap ${pct}% used (> ${maxPct}%)` }
    : { ok: true, reason: `swap ${pct}% used (<= ${maxPct}%)` };
}

// GramJS raises FloodWaitError with `.seconds`; raw RPC errors carry
// "FLOOD_WAIT_<n>" / "FLOOD_PREMIUM_WAIT_<n>" in errorMessage/message.
// Returns the wait in seconds, or 0 when the error is not a flood wait.
export function floodWaitSeconds(error) {
  if (!error) return 0;
  if (Number.isFinite(error.seconds) && error.seconds > 0 && /flood/i.test(`${error.errorMessage || ''} ${error.message || ''} ${error.constructor?.name || ''}`)) {
    return error.seconds;
  }
  const m = /FLOOD(?:_PREMIUM)?_WAIT_(\d+)/i.exec(`${error.errorMessage || ''} ${error.message || ''}`);
  return m ? Number(m[1]) : 0;
}

// Split one page (newest first, as getMessages returns it) against the window.
// `inWindow` are messages with since <= date <= until; `reachedStart` means the
// page already went older than `since`, so this channel is finished; `nextOffsetId`
// is the id to page back from next time (oldest id on the page).
export function slicePage(messages, sinceSec, untilSec) {
  const list = Array.isArray(messages) ? messages.filter((m) => Number(m?.id) > 0) : [];
  const inWindow = list.filter((m) => Number(m.date) >= sinceSec && Number(m.date) <= untilSec);
  const oldest = list.reduce((acc, m) => (acc === null || Number(m.id) < Number(acc.id) ? m : acc), null);
  const reachedStart = list.length === 0 || (oldest && Number(oldest.date) < sinceSec);
  return { inWindow, reachedStart: Boolean(reachedStart), nextOffsetId: oldest ? Number(oldest.id) : 0 };
}

// Messages whose (id) is not yet stored. `storedIds` is a Set of numbers.
export function missingMessages(messages, storedIds) {
  return (messages || []).filter((m) => !storedIds.has(Number(m.id)));
}

export function isImageMessage(msg) {
  return Boolean(msg?.media?.photo) || Boolean(msg?.media?.document?.mimeType?.startsWith?.('image/'));
}

// State is keyed by window so a run for a different window starts fresh.
export function windowKey(sinceIso, untilIso) {
  return `${sinceIso}..${untilIso}`;
}

export function emptyChannelState() {
  return { offsetId: 0, done: false, pages: 0, seen: 0, archived: 0, photos: 0, photoErrors: 0 };
}

export function channelState(state, key, token) {
  const win = state?.windows?.[key];
  return { ...emptyChannelState(), ...(win?.channels?.[token] || {}) };
}

export function withChannelState(state, key, token, patch) {
  const base = state && typeof state === 'object' ? state : {};
  const windows = { ...(base.windows || {}) };
  const win = { channels: {}, ...(windows[key] || {}) };
  win.channels = { ...win.channels, [token]: { ...emptyChannelState(), ...(win.channels[token] || {}), ...patch } };
  win.updatedAt = new Date().toISOString();
  windows[key] = win;
  return { ...base, windows };
}

// Parse "--since 2026-10-11T00:00:00+07:00"-style ISO times to epoch seconds.
export function parseIsoToSec(value, label) {
  const ms = Date.parse(String(value || ''));
  if (!Number.isFinite(ms)) throw new Error(`${label} must be an ISO date/time, got: ${value}`);
  return Math.floor(ms / 1000);
}
