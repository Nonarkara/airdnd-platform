# The spatial limits, and why each one is the number it is

`design/spatial-baseline.json` carries the numbers. This file carries the
reasons, because a limit without a reason is a number that nobody can argue
with and nobody can correct.

The law's own words: *"A large footprint is a prompt to investigate, not a
universal numeric failure."* So a limit here is not an absolute law about
design. It is a **regression limit**: the line the site currently sits on,
written down so that a later change that moves it is caught by a gate rather
than by somebody noticing.

That is why every limit below is derived from the site's own measured
distribution, and not chosen. The derivation is reproducible:

```bash
node scripts/spatial/derive-limits.mjs --baseline design/spatial-baseline.json
```

It reads the baseline — the receipt of what the site IS — and proposes a
limit for each §6 hierarchy law, with the per-route worst and best it found.
The baseline is the measurement; the limit is the ceiling of what was
measured, plus a margin of zero for the ceilings and one step below for the
floor. Nothing here is invented, and nothing is aspirational.

---

## `titleRatio` — **0.95**, a floor

*What it says:* the page's title must be at least 0.95× the size of the next
largest text on the page.

*Measured:* the worst ratio on the site is **1** — on `/` — where the title
and the next-largest text are the same size. The best is 2.6 on `/tides/`.

*Why a floor of 0.95 and not 1:* a title that ties exactly with the body is
a title that has stopped being a title. The floor of 0.95 is one step below
the worst measured, so it does not condemn a page that already exists, and it
catches the failure the law actually names — *"the title may not shrink to a
tie with the body"* — with the smallest margin that still has teeth.

*Why it is not 1.2, which would be tidier:* because the site has pages where
the title is only 1.05× the body, and those pages are not broken. A limit
that condemns the site's own work is a limit that gets raised the first time
it is inconvenient.

## `peerShare` — **0.33**, a ceiling

*What it says:* the largest "peer" text — a body-size element competing with
the title — may take at most 33% of the title's size.

*Measured:* the worst is **0.28**, on `/`, where a large numeral competes with
the title. On eight of the fourteen routes the share is 0.02 or less.

*Why 0.33:* one step above the worst measured. The law's concern is *"do not
make every element shout"* — a peer that reaches the title's own weight
stops being supporting text. 0.33 says a peer may be a third of the title
and no more, which is generous enough to permit the one page that has a
large numeral and tight enough to catch a second one arriving.

## `chromeTopPct` — **8**, a ceiling

*What it says:* the header and any other band pinned to the top of the
screen may take at most 8% of the viewport's height.

*Measured:* **6%** on every route, at every width. The header is 51px, and
51px is 6% of a 844px phone.

*Why 8:* two points of headroom above what the site actually uses. This is
the one limit here that is not tight, and it is tight-by-design on purpose: a
chrome limit that the site fails by a pixel would be a limit that gets
raised every time a font metric moves. The law asks for the chrome cost to
be *reported and small*, and 8% of a phone screen is a band a reader does
not have to think about.

## `sizeSteps` — **6**, a ceiling

*What it says:* a page may set text in at most **6** visually distinct sizes.

*Why not a list of allowed sizes:* this project's titles are
`clamp(1.75rem, 3.6vw, 2.6rem)`. The same rule renders at 28px on a phone and
41.6px on a desk, so a sweep across 43 widths samples 100 different sizes.
An allowed-size set would have to contain every one of them, and then it
would be a photograph of the site rather than a law — it would fail on every
legitimate change and pass on every illegitimate one that happened to land on
a listed size.

*So the rule counts steps a reader can actually tell apart:* two sizes within
a pixel of each other are the same step, because nobody can tell 21.8px from
22px on a screen; and a size that carries fewer than 40 characters is a
one-off, not a step of the ramp.

*Measured:* the worst is **6** steps, on `/matchmaker/` and `/story/`. The
best is 2, on `/champions/`. The limit is 6 — the worst measured, with no
margin, so the gate bites the moment a seventh step appears on any page.

## `firstAction` — **not set**

The derivation proposes a ceiling of **11,870px**: on `/history/`, the first
element the law counts as an action sits 11,870px down the page.

A limit of 11,870px is a number no rule can act on. Setting it would make
the baseline look more complete while changing nothing — the law would
appear to be enforced on a page where it is not. The honest choice is to
leave it unset and say so here, rather than to set a limit that reads as
coverage and is not.

The MSH audit measures the same question differently and does enforce it:
it looks for the first **visible** action in the viewport, and reports
`firstAction 0px a.brand on-screen` on every route — the brand link is
always reachable without scrolling. That is the reading the law wants, and it
is measured on every run.

---

## What "unset" means here, precisely

Every limit in the baseline has a shape:

- a **number** — the line, enforced;
- `null` — the rule exists in the instrument and is **switched off** for this
  project.

A `null` is not a passing grade. It is an admission. The list above says
which admissions are deliberate, and why. `allowedSizes` is the only other
one, and it is off for the reason given under `sizeSteps`: a fluid type ramp
cannot be expressed as a list, and the step count is the rule that can.

## Re-deriving

```bash
node scripts/spatial/spatial-check.mjs --dir design/spatial-snapshots \
     --baseline design/spatial-baseline.json --update
node scripts/spatial/derive-limits.mjs --baseline design/spatial-baseline.json
```

If the derivation proposes a different number, the site has moved. That is
the point: the limit should follow the design, and the gate should say so
before the change is made rather than after.
