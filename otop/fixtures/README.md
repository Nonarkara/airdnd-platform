# Development fixture — SYNTHETIC DATA

Every record in this directory is invented. The producer names are placeholders
containing the word "ตัวอย่าง" (example), the tax IDs are checksum-valid but
issued to nobody, and the phone numbers are not in service.

It exists so `scripts/otop/build.js` and everything downstream can be run and
tested without network access to data.go.th. Any build sourced from here writes
`degraded: true` into `otop/public/otop_meta.json` with a reason string, and
the frontend renders a provenance banner on top of the page.

It deliberately exercises the hard paths:

| Path | Where |
|---|---|
| Thai column headers | `fixture_r1.json` |
| Latin column headers, province given as TIS-1099 code | `fixture_r2.json` |
| Cross-agency merge on tax ID | r1#0 + r2#0 |
| Cross-agency merge on phone | r1#2 + r2#1 |
| Buddhist-era and Common-era years in one build | 2563 vs 2020 |
| Category declared as Thai name, as digit, and absent | r1 / r2 / r1#2 |
| `ไม่ผ่าน` (assessed, ungraded) vs missing star rating | r1#2 |
| Quality gate: unresolvable province | r1#4 |
| Quality gate: numeric product name | r1#5 |
| Loud skip of a non-OTOP resource | `fixture_r3.json` |

Never replace the real pull with this. `npm run otop:fetch` is the real thing.
