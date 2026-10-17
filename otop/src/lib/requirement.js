/**
 * The requirement round-trips through the URL so a brief can be sent as a link.
 *
 * Pure URL serialisation: no JSX, no state. Lives here so the App shell stays
 * a shell — data loading and view routing — instead of also owning the link
 * format every shared province dossier depends on.
 */

export const EMPTY = {
  categories: [], provinceCodes: [], regions: [],
  minStars: null, maxFilingAge: null,
  requireContact: false, requireCorroborated: false,
  requireSignal: true,
  query: '',
};

/**
 * The lens picks the default strictness. Without one of these defaults, a
 * 4,288-row province returns 4,288 equally-scored stubs that say nothing
 * the interface can communicate. The user can opt out (showAll) to see the
 * full registry, but should not have to opt in to see the meaningful half.
 */
export const DEFAULTS = {
  b2b: { requireCorroborated: true, requireSignal: true },
  b2c: { requireContact: true, requireSignal: true },
};

export function requirementFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const list = (k) => (p.get(k) ? p.get(k).split(',').filter(Boolean) : []);
  const num = (k) => (p.get(k) ? Number(p.get(k)) : null);
  const lens = p.get('lens') === 'b2c' ? 'b2c' : 'b2b';
  const defaults = DEFAULTS[lens];
  // `all=1` is the explicit opt-out: "show the full registry, not just the
  // attested half". A reader who is doing a completeness audit, or who
  // needs to find a registered name that nobody has filled the dossier in
  // for, asks for it by name.
  const all = p.get('all') === '1';
  return {
    lens,
    requirement: {
      categories: list('cat'),
      provinceCodes: list('prov').map(Number),
      regions: list('region'),
      minStars: num('stars'),
      maxFilingAge: num('age'),
      requireContact: all ? false : (p.get('contact') === '1' || defaults.requireContact),
      requireCorroborated: all ? false : (p.get('corr') === '1' || defaults.requireCorroborated),
      requireSignal: all ? false : (p.get('signal') === '1' || (defaults.requireSignal && p.get('signal') !== '0')),
      query: p.get('q') ?? '',
    },
  };
}

export function requirementToUrl(view, lens, r, code) {
  const p = new URLSearchParams();
  if (view === 'find') p.set('view', 'find');
  if (view === 'atlas') p.set('view', 'atlas');
  if (view === 'story') p.set('view', 'story');
  if (view === 'history') p.set('view', 'history');
  if (view === 'crossrefs') p.set('view', 'crossrefs');
  if (view === 'champions') p.set('view', 'champions');
  if (view === 'tides') p.set('view', 'tides');
  if (view === 'matchmaker') p.set('view', 'matchmaker');
  if (view === 'briefs') p.set('view', 'briefs');
  if (view === 'bank') p.set('view', 'bank');
  if (view === 'province' && code != null) { p.set('view', 'province'); p.set('code', String(code)); }
  // Preserve the active Atlas tab across requirement/lens changes so a user
  // who lands on `?view=atlas&tab=reach` and then changes a filter does
  // not get bounced back to the findings tab.
  const currentTab = new URLSearchParams(window.location.search).get('tab');
  if (view === 'atlas' && currentTab) p.set('tab', currentTab);
  // Preserve the active brief card + province across filter changes so a
  // shared one-pager link does not lose its card when the requirement moves.
  const currentParams = new URLSearchParams(window.location.search);
  if (view === 'briefs') {
    const card = currentParams.get('card');
    const prov = currentParams.get('prov');
    if (card) p.set('card', card);
    if (prov) p.set('prov', prov);
  }
  p.set('lens', lens);
  if (r.categories.length) p.set('cat', r.categories.join(','));
  if (r.provinceCodes.length) p.set('prov', r.provinceCodes.join(','));
  if (r.regions.length) p.set('region', r.regions.join(','));
  if (r.minStars != null) p.set('stars', String(r.minStars));
  if (r.maxFilingAge != null) p.set('age', String(r.maxFilingAge));
  if (r.requireContact) p.set('contact', '1');
  if (r.requireCorroborated) p.set('corr', '1');
  // Only emit the signal flag when the user has toggled it off the default,
  // so the URL stays clean for the common case.
  const defaults = DEFAULTS[lens];
  if (r.requireSignal && !defaults.requireSignal) p.set('signal', '1');
  if (!r.requireSignal && defaults.requireSignal) p.set('signal', '0');
  if (r.query) p.set('q', r.query);
  return `${window.location.pathname}?${p.toString()}`;
}
