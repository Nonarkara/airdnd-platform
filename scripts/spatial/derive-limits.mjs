/**
 * DERIVE THE §6 LIMITS FROM THE SITE'S OWN MEASURED DISTRIBUTION.
 *
 * The spatial law says: "A large footprint is a prompt to investigate, not a
 * universal numeric failure." So the limits are not invented — they are read
 * off the site as it actually renders, and then written down with the reason
 * that makes them survive the next change.
 *
 * This script does the reading. It takes the baseline (the receipt of what
 * the site IS) and proposes the limit for each §6 hierarchy law:
 *
 *   titleRatio   the title must be at least this much larger than the next
 *                largest text on the page. FLOOR: the title may not shrink
 *                to a tie with the body.
 *   peerShare    at most this share of the page's characters may be set in
 *                the loud voice. CEILING: the body may not shout over the
 *                title.
 *   chromeTopPct the chrome may take at most this share of the first screen.
 *   sizeSteps    the page may set its text in at most this many type steps.
 *   firstAction  the first thing the reader can DO may be at most this many
 *                pixels down the page.
 *
 * THE MARGIN. A limit set exactly at the worst measured value fails the
 * moment anything moves by a pixel, and a gate that fails on noise is a gate
 * that gets switched off. So each limit is the worst measured value rounded
 * AWAY from the failure, with a stated margin. The margin is part of the
 * law, not a loophole: it says how much the site is allowed to drift before
 * somebody has to look.
 *
 * What this script CANNOT do is decide which views are exempt. An exemption
 * is a judgement about the task, and it is written into the baseline by
 * hand, with its reason, where a reviewer will read it.
 *
 *   node scripts/spatial/derive-limits.mjs [--baseline design/spatial-baseline.json]
 */

import fs from 'node:fs';

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf('--' + name);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const BASELINE = arg('baseline', 'design/spatial-baseline.json');
const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

/**
 * The measurements, as a flat list.
 *
 * The baseline keeps them where a reviewer would look for them — under the
 * route and the width they were taken at — so they have to be gathered back
 * out before anything can be counted across routes.
 */
function flatten(b) {
  if (Array.isArray(b.measurements) && b.measurements.length) return b.measurements;
  const out = [];
  for (const [route, byWidth] of Object.entries(b.routes || {})) {
    for (const [w, rec] of Object.entries(byWidth)) {
      out.push({ route, w: Number(w), ...rec });
    }
  }
  return out;
}

const measurements = flatten(base);
if (!measurements.length) {
  console.error(`FAIL — ${BASELINE} records no measurements. Run the gate with --update first.`);
  process.exit(1);
}

// ---- the margins -----------------------------------------------------------
// How much drift each law allows before a human has to look at the page.
// A limit set exactly at the worst measured value fails the moment anything
// moves by a pixel, and a gate that fails on noise is a gate that gets
// switched off — so each limit is rounded AWAY from the failure and then
// given a stated margin.
//
// A route can be EXCLUDED from the derivation, but only by name, and the
// exclusion is visible in the command that produced the number. An excluded
// route still gets measured by the gate; it is the limit that does not
// apply to it, and the reason lives in the baseline where a reviewer reads
// it — not in a flag on a command line.
const EXCLUDE = new Set(
  String(arg('exclude', ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
if (EXCLUDE.size) {
  console.log(`# excluding from the derivation: ${[...EXCLUDE].join(', ')}\n`);
}

const byRoute = new Map();
for (const m of measurements) {
  if (EXCLUDE.has(m.route)) continue;
  if (!byRoute.has(m.route)) byRoute.set(m.route, []);
  byRoute.get(m.route).push(m);
}

/** The measured value of one law on one measurement. */
function valueOf(m, law) {
  switch (law) {
    case 'titleRatio':
      return m.hierarchy && m.hierarchy.ratio !== null && m.hierarchy.ratio !== undefined
        ? m.hierarchy.ratio
        : null;
    case 'peerShare':
      return m.hierarchy && m.hierarchy.share !== undefined && m.hierarchy.share !== null
        ? m.hierarchy.share
        : null;
    case 'chromeTopPct':
      return m.chrome && m.chrome.topPct !== null && m.chrome.topPct !== undefined ? m.chrome.topPct : null;
    case 'sizeSteps':
      return m.hierarchy && m.hierarchy.ramp ? stepsOf(m) : null;
    case 'firstAction':
      return m.firstAction && m.firstAction.y !== null && m.firstAction.y !== undefined ? m.firstAction.y : null;
    default:
      return null;
  }
}

/**
 * The number of type steps a reader can tell apart.
 *
 * Two sizes within a pixel of each other are the SAME step, and a size
 * carrying fewer than 40 characters is a one-off rather than a step of the
 * ramp. This must match the gate's own rule exactly, or the derivation and
 * the receipt will disagree about the same page.
 */
function stepsOf(m) {
  const limits = { sizeStepTolerance: 1, sizeStepChars: 40 };
  const sizes = Object.entries(m.hierarchy.ramp)
    .map(([sz, n]) => ({ sz: Number(sz), n }))
    .filter((e) => e.n >= limits.sizeStepChars)
    .sort((a, b) => a.sz - b.sz);
  let steps = 0;
  let last = null;
  for (const e of sizes) {
    if (last === null || e.sz - last > limits.sizeStepTolerance) steps++;
    last = e.sz;
  }
  return steps;
}

const LAWS = [
  { law: 'titleRatio', dir: 'floor', margin: 0.05, round: (v) => Math.round(v * 100) / 100 },
  { law: 'peerShare', dir: 'ceiling', margin: 0.05, round: (v) => Math.round(v * 100) / 100 },
  { law: 'chromeTopPct', dir: 'ceiling', margin: 2, round: (v) => Math.round(v) },
  { law: 'sizeSteps', dir: 'ceiling', margin: 0, round: (v) => Math.round(v) },
  { law: 'firstAction', dir: 'ceiling', margin: 0, round: (v) => Math.round(v) },
];

console.log(`# derived limits from ${BASELINE}`);
console.log(`# ${measurements.length} measurements, ${byRoute.size} routes\n`);

const derived = {};

for (const { law, dir, margin, round } of LAWS) {
  const perRoute = [];
  for (const [route, ms] of byRoute) {
    const vals = ms.map((m) => valueOf(m, law)).filter((v) => v !== null);
    if (!vals.length) continue;
    perRoute.push({
      route,
      n: vals.length,
      worst: dir === 'floor' ? Math.min(...vals) : Math.max(...vals),
      best: dir === 'floor' ? Math.max(...vals) : Math.min(...vals),
    });
  }
  if (!perRoute.length) {
    console.log(`${law}: NO MEASUREMENT — the law cannot be switched on.`);
    continue;
  }
  perRoute.sort((a, b) => (dir === 'floor' ? a.worst - b.worst : b.worst - a.worst));
  const globalWorst = dir === 'floor'
    ? Math.min(...perRoute.map((r) => r.worst))
    : Math.max(...perRoute.map((r) => r.worst));

  // Round AWAY from the failure, then add the margin, then round to something
  // a human would write down.
  let limit;
  if (dir === 'floor') {
    limit = round(globalWorst - margin);
  } else {
    limit = round(globalWorst + margin);
  }
  derived[law] = limit;

  console.log(`## ${law} — a ${dir}; worst measured ${globalWorst}, proposed limit ${limit}`);
  for (const r of perRoute) {
    const over = dir === 'floor' ? r.worst < limit : r.worst > limit;
    console.log(
      `   ${over ? 'OVER ' : '     '}${r.route.padEnd(13)} worst ${String(r.worst).padEnd(8)} best ${String(r.best).padEnd(8)} n=${r.n}`,
    );
  }
  console.log('');
}

console.log('# the block to paste into the baseline\'s "limits":');
console.log(JSON.stringify(derived, null, 2));
