# SSDIY — Self-Service + DIY Operator Manual

one·tambon is built to be run by one person from a terminal. No CI, no build
service, no cloud dependency beyond a static host. This is the canonical "how do
I make it do X" reference.

**Everything here is a real command in `package.json`. If a step in this file is
not runnable, the file is wrong — fix the file.**

---

## The commands

```bash
npm run otop:discover   # list what a fetch WOULD pull. Read-only, ~30s. NETWORK
npm run otop:fetch      # pull the whole CKAN catalogue from data.go.th. NETWORK
npm run otop:build      # normalise → resolve → shard → aggregate. PURE, no network
npm run otop:dev        # develop at http://localhost:5180
npm run otop:ship       # build the site + deploy + verify live. ~2 min
npm run otop:verify     # smoke-test the live site. Read-only, ~10s
npm test                # unit tests, including the resolution and scoring traps
```

Two rules hold everything together:

1. **Only `otop:fetch` touches the network.** It writes untouched CKAN responses
   into `otop/data/raw/` and transforms nothing.
2. **`otop:build` is pure.** Same files in, byte-identical artefacts out. So a
   reviewer can reproduce your numbers, and a build never depends on a
   government portal that is frequently slow or down.

> `data.go.th` blocks some cloud egress networks and returns 403 on CONNECT for
> `*.go.th` from a sandbox. Run `otop:fetch` from the Mac or any Thai network,
> commit the resulting JSON, and everything downstream runs anywhere.

---

## Ship a change

```bash
git add <the files you touched>     # never `git add -A`
git commit -m "why, not what"
git push
npm run otop:ship                   # build → deploy → verify
```

`otop:ship` deliberately does **not** commit for you. An auto-commit cannot tell
an intended file from a stray one, and this repo holds two products in one tree.

If `otop:ship` fails, it fails at the step that broke and prints which — the
verify step is a hard gate, so a deploy that uploaded nothing new will not pass
as success.

---

## `npm run otop:verify` — what it actually checks

"The site loads" is not a test. A static site is up and wrong far more often
than it is down, so these are the four ways it goes wrong silently:

| Check | The failure it catches |
|---|---|
| bundle vs local dist | The deploy uploaded nothing and the live site is still yesterday's build. Pages reports success either way. |
| atlas chunk | A lazy import broke, so the Atlas renders as an empty section with no console error a visitor would report. |
| `otop_index.json` · `otop_insights.json` · `p/34.json` | An artefact is truncated or half-written. All three still return 200. |
| SPA fallback | `_redirects` stopped catching deep links, so every shared URL 404s and only the bare domain works. |

It exits non-zero on the first real miss. Point it anywhere:

```bash
BASE=https://otop.pages.dev npm run otop:verify
DIST=some/other/dist npm run otop:verify
```

Expected output:

```
  check                              result
  -----                              ------
  GET /                              200
  bundle vs local dist               match (assets/index-DqRXEG2z.js)
  atlas chunk                        200 (Atlas-12NjkOW_.js)
  otop_index.json                    158864 records · 77/77 provinces
  otop_insights.json                 77 provinces · 80 offices
  province shard                     shard TH-34 · 5784 records
  SPA fallback (_redirects)          200

all checks passed
```

---

## When the data is stale

```bash
npm run otop:discover     # see what is out there first
npm run otop:fetch        # resumable — every resource already on disk is skipped
npm run otop:build
npm run otop:ship
```

An interrupted fetch is resumed by running it again. Useful flags:

| Flag | Effect |
|---|---|
| `--concurrency 6` | in-flight requests, default 4 — be polite to a government portal |
| `--limit 20` | cap resources, for a smoke test |
| `--refetch` | ignore the cache, pull everything again |
| `--max-rows-per-resource N` | cap one enormous resource |

Raw payloads are gitignored; `otop/data/raw/manifest.json` is committed because
it is the provenance record. `git add -f` a payload to preserve a vintage.

---

## When the live site is wrong

1. `npm run otop:verify` — which of the four checks failed?
2. **bundle mismatch** → the deploy did not take. Re-run `npm run otop:ship`.
3. **an artefact failed** → rebuild locally (`npm run otop:build`), confirm
   `otop/public/otop_index.json` parses, then ship.
4. **everything failed** → check the Pages project is not paused:
   `npx wrangler pages deployment list --project-name otop`
5. **rollback** → `git revert HEAD && npm run otop:ship`. Cloudflare keeps the
   previous deployment live until the new one completes, so a broken ship does
   not take the site down on its own.

---

## When the page shows nothing

By design. `lib/load.js` and `lib/shards.js` have **no fallback**: if the
registry cannot be loaded the page says so and renders nothing, rather than
quietly showing stale or substitute data under the same headings. That failure
mode has shipped here once already (`tasks/lessons.md` · 2026-08-04).

So an empty page means an artefact is genuinely missing — check `otop:verify`,
not the React code.

---

## Add a new data source

The registry is one CKAN catalogue today. The pattern for a second source:

1. **Fetch.** Add the query or organisation to `otop.config.json`. `fetch.js`
   pages `package_search` to exhaustion and caches every resource by id.
2. **Map, do not assume.** `core/field_map.js` scores every column of every
   resource against an alias dictionary. A resource with no name column or no
   area column is skipped **loudly**, with its columns printed — never silently.
   Add aliases there, not `if` branches in the builder.
3. **Emit every identity signal the row supports** in `core/record.js`. Do not
   rank them. Records sharing any signal are unioned, transitively.
   A per-agency row number (`PRODUCT_ID = "P-002"`) is namespaced by dataset so
   it can never join across agencies — under a ranked key it would outrank a
   telephone number and split one producer into two.
4. **Test the trap before the feature.** Add a fixture case to
   `test/otop_core.test.js`. Every honesty rule in this project is pinned by a
   test because each one was a bug first.
5. `npm run otop:build && npm test && npm run otop:ship`

### What the build refuses to do

| It will not | Because |
|---|---|
| default a missing province to Bangkok | a guess printed as a fact |
| drop a rejected row silently | rejects are counted by reason in `otop_meta.json` |
| construct a record with no provenance | `buildRecord` throws |
| treat `ไม่ผ่าน` as missing | assessed-and-ungraded is `0`; unrecorded is `null` |
| merge on a phone seen in two provinces | that is a switchboard, not an identity |

---

## Add a panel to the Atlas

The Atlas reads `otop_insights.json` and nothing else. To add a panel:

1. Add the aggregate to `scripts/otop/insights.js` — it reads the corpus back
   **out of the shards** and refuses to write if the total disagrees with the
   index, so every build verifies its own output.
2. Render it in `otop/src/components/Atlas.jsx` using the tag surfaces in
   `otop/src/tag.css` (`.t-band`, `.t-zones`, `.t-bar`, `.t-rows`, `.t-ranked`).
3. Add its conservation law to `test/otop_atlas.test.js`. A composition whose
   segments do not sum to its total is a chart lying with true numbers.
4. `npx node ../dr-non-luggage-tag-aesthetic/tools/tag-audit.mjs otop/src/tag.css`
   must stay at 0 errors if you touched the CSS.

Design law for this surface: `otop/src/tag.css` header, and the register is
**Index** — never Console. Do not invent a fourth type rank or a second accent.

---

## Open runbook item — the custom domain

`otop.config.json` declares `otop.nonarkara.org`, but the Pages project has no
custom domain attached and the hostname does not resolve. The live site is
`https://otop.pages.dev` until this is run:

```bash
# needs a token with Pages:Edit on the account; wrangler's OAuth is not enough
curl -sS -X POST \
  "https://api.cloudflare.com/client/v4/accounts/74ad6bf8dfaaccf82de6f0847f7d2d54/pages/projects/otop/domains" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"name":"otop.nonarkara.org"}'
```

Then add the CNAME `otop → otop.pages.dev` (proxied) on the `nonarkara.org`
zone, and change `BASE` in `scripts/otop/verify-live.sh` to the new hostname.

---

## Why there is no CI

One operator, one continent, one static host. `npm run otop:ship` is the whole
pipeline and `npm run otop:verify` is the whole test environment. CI is a tax
that buys nothing while the operator *is* the test environment.

Add CI when any of these becomes true — not before:

- more than one person deploys
- a staging environment exists that is distinct from production
- the site serves an API somebody else depends on
