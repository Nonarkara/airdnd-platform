/**
 * Share-URL codec for civic live layers.
 *
 * God's Eye View serializes enabled layers into the URL so a view is a
 * handoff, not a bookmark. Atlas currently copies camera/area hash only
 * (`copyDeepLink`). Same grammar, shorter alphabet:
 *
 *   f = flights   q = quakes   e = fires (events)
 *
 * Sabai reads `?pulse=f,q`. Atlas can append `&pulse=` or `#layers=f,q`
 * without colliding with area ids.
 */

export const PULSE_TOKENS = Object.freeze({
  flights: 'f',
  quakes: 'q',
  fires: 'e',
});

const TOKEN_TO_ID = Object.freeze(Object.fromEntries(
  Object.entries(PULSE_TOKENS).map(([id, token]) => [token, id]),
));

export const EMPTY_PULSE = Object.freeze({
  flights: false,
  quakes: false,
  fires: false,
});

export function normalizePulse(flags) {
  return {
    flights: Boolean(flags?.flights),
    quakes: Boolean(flags?.quakes),
    fires: Boolean(flags?.fires),
  };
}

export function encodePulseLayers(flags) {
  const pulse = normalizePulse(flags);
  return Object.entries(PULSE_TOKENS)
    .filter(([id]) => pulse[id])
    .map(([, token]) => token)
    .join(',');
}

export function decodePulseLayers(raw) {
  const pulse = { ...EMPTY_PULSE };
  if (raw == null) return pulse;
  const tokens = String(raw)
    .trim()
    .toLowerCase()
    .split(/[,+\s]+/)
    .filter(Boolean);
  for (const token of tokens) {
    if (TOKEN_TO_ID[token]) pulse[TOKEN_TO_ID[token]] = true;
    else if (Object.hasOwn(PULSE_TOKENS, token)) pulse[token] = true;
  }
  return pulse;
}

export function pulseIsEmpty(flags) {
  const pulse = normalizePulse(flags);
  return !pulse.flights && !pulse.quakes && !pulse.fires;
}

export function readPulseFromHref(href) {
  if (!href) return { ...EMPTY_PULSE };
  try {
    const url = new URL(href, 'https://sabaisabai.local');
    const fromQuery = url.searchParams.get('pulse') || url.searchParams.get('layers');
    if (fromQuery) return decodePulseLayers(fromQuery);
    const hash = (url.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hash.includes('=') ? hash : '');
    const fromHash = hashParams.get('pulse') || hashParams.get('layers');
    if (fromHash) return decodePulseLayers(fromHash);
  } catch {
    return { ...EMPTY_PULSE };
  }
  return { ...EMPTY_PULSE };
}

export function writePulseToHref(href, flags) {
  const url = new URL(href, 'https://sabaisabai.local');
  const encoded = encodePulseLayers(flags);
  if (encoded) url.searchParams.set('pulse', encoded);
  else url.searchParams.delete('pulse');
  url.searchParams.delete('layers');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function syncPulseToWindow(flags, win = typeof window === 'undefined' ? null : window) {
  if (!win?.location || !win.history?.replaceState) return;
  const next = writePulseToHref(win.location.href, flags);
  const current = `${win.location.pathname}${win.location.search}${win.location.hash}`;
  if (next !== current) win.history.replaceState(null, '', next);
}
