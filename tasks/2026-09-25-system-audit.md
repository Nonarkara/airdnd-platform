# Sabai Sabai system audit and repair plan

Audited 25 September 2026, from M5 checkout `558c8a1`. This is an audit and proposed implementation plan, not a claim that repairs have shipped. Existing generated data changes were present before inspection; the collector continues writing them.

## Decision

Make the M3 the sole Telegram collector and durable evidence store. Use the M5 for development, builds, evaluation and optional batch learning. Collecting and displaying fresh evidence must continue when the M5 is asleep, AI is unavailable, or either cloud database fails.

Invariant: every fetched message is durably recorded or explicitly pending before its collection checkpoint advances. Extraction, media download and publication each have separate retryable progress. A public record must retain its source and observation time.

## Verified findings, ordered by impact

1. **P1 — Repository Firestore rules permit all reads and writes.** `firestore.rules:5` grants both operations unconditionally across every collection. `scripts/firestore_sync.js` uses the unauthenticated web client SDK, so simply denying writes would stop that writer. An unauthenticated REST read of one companion succeeded. Reading deployed rule metadata with the available Google account returned HTTP 403; deployed write access remains unverified. No production write attack was attempted. Migrate the writer to a dedicated server identity, test collection-specific rules, and deploy both together. Audit the public document fields and protect visitor/signals collections separately. Firebase web configuration is public client configuration, not an authorization boundary.

2. **P1 — Raw archive loses non-listing evidence.** `scripts/telegram_scraper.js:1347`, `:1360` and `:1517` return and advance the checkpoint before the only raw archive call at `:1541`. Thus an entire batch of discussions, feedback, rejected content or media that produces no accepted listing bypasses raw archival. When Supabase is unavailable, raw archival is skipped altogether. The public snapshot strips raw evidence and cannot substitute for an archive. This directly biases research toward extractable advertisements.

3. **P1 — Failed archival can be reported as success.** `scripts/listing_pipeline.js:727` increments the archived count for errors containing `column` or `channel_messages`. A synthetic, network-free reproduction returned an archived count of **1** after the database returned `relation channel_messages does not exist`. Other archive errors are swallowed and extraction still advances its checkpoint. Checkpoint state also advances before the merged listing snapshot is written in `runTelegramScrape`; a write failure or termination in that interval can strand derived records.

4. **P1 — Automatic gap recovery cannot trigger from saved state.** Fetching sets `state.pendingBackfill`, but `savePersistedState` at `scripts/telegram_scraper.js:1692` saves only message IDs and intake gaps. A VM reproduction of the actual serializer confirmed that `pendingBackfill` disappears. The heartbeat at `scripts/heartbeat.js:323` requires that missing field. Further, the backfill script has only seven hardcoded public channels, ignores the saved gap ranges, and opens another Telegram client. Restoring just the flag would not repair recovery. Recover gaps through the sole session owner, with durable per-range completion evidence.

5. **P1 — Machine ownership differs from the requested arrangement.** This M5 has `/Users/nonarkara/Projects/air-dnd/scripts/daemon.sh` and `node scripts/telegram_scraper.js --watch` running. The collector log and state-file pulse are current. The saved M3 address `axiom@Agentics-Macbook-Air.local` fails DNS resolution. M3 process ownership, revision, storage and backlog remain unverified. Do not start another session or stop this collector until a verified handover is possible. The manual GitHub Actions workflow can also start a collector; it has no shared ownership lock.

6. **P1 — Freshness stops short of the published fallback.** At inspection, the documented site `https://sabaisabai-airdnd.pages.dev/data.json` returned 84 rows with the latest source timestamp September 8. Local data had 99 rows and September 25 timestamps. The deployed feed metadata was built September 8. The second hostname hardcoded in the Pages middleware returned a May 5 snapshot. These are observations of static fallbacks, not proof that the browser's Firestore data is equally stale. Both `/health` routes returned HTML with HTTP 200, not collector health JSON. The Express health handler is not deployed by a static Pages build.

7. **P2 — Realtime work remains coupled and expensive.** The directory reads the full Firestore companion collection every 30 seconds, while its push subscription listens to Supabase. Every nonempty scrape republishes the entire merged Firestore snapshot in batches. AI calls, photo downloads, Firestore commits and Google export are awaited inside collection cycles. Local AI has a 120-second request timeout and up to three attempts. A configured 30-second interval therefore does not guarantee 30-second intake latency. Publish changed records through a durable outbox; subscribe to the actual publication source. Track source-to-archive and archive-to-publication latency separately.

8. **P2 — Extraction can replace evidence with model output.** `mergeEnrichment` prefers AI-supplied phone, price, location and links over deterministic fields. A JSON response is shape validation, not factual verification. Require source spans for extracted facts, retain field provenance, and preserve deterministic facts when the model disagrees. Route disagreements to review. No claim of measured extraction accuracy is currently supported by an annotated holdout set in the inspected tests.

9. **P2 — Analytics freshness and coverage can mislead.** `Analytics.jsx:198` queries only 1,200 Firestore documents and passes them to analytics without the directory's canonical merge. `useMarketAnalytics.js:186` uses row count as total. The pattern loader stops beyond 100,000 rows; the current pattern metadata reports exactly 101,000 messages, consistent with that ceiling but not proof of total archive size. The two most recent local heartbeat records report `ok: true` while `patternsRegenerated: false`. Explicitly distinguish archive rows, distinct operators, source posts, coverage limits and computation age.

10. **P2 — Health and regression coverage are incomplete.** The Node health check accepts a missing heartbeat as a warning and nonempty snapshots regardless of their age. All 88 tests pass despite the loss paths above. `npm run lint` reports 14 errors and 2 warnings, including an embedded `otop-app` outside the main application and several React hook findings in the main application. `npm audit` reports 26 vulnerable package entries: 8 high, 17 moderate and 1 low. These are dependency advisories, not 26 verified exploitable application vulnerabilities; assess runtime reachability and major-version changes before upgrading.

11. **P2 — The documented snapshot gate is not enforced by the build.** Project instructions say missing photos, stale data and phantom channels fail deployment. The actual `npm run build` invokes `verify_snapshot.js --quiet`, which fails only for no cards; warning failures require `--strict`. Quiet mode also suppresses those warnings. Existing Vite code prunes output photos after compilation; no new pruning was introduced. The 21 local image paths referenced by the inspected directory exist in both public and built output, but that check does not cover every gallery shard or remote photo. Make the pipeline gate match its documented contract and test the finished deployment artifact.

## Evidence collected

- `npm test`: 88 passed, zero failed.
- `npm run build`: passed in 1m 38s; this proves compilation, not pipeline health or a live deployment.
- `npm run verify:snapshot -- --quiet`: passed; this check regenerates `public/funnel.json`.
- `npm run verify:snapshot -- --strict`: failed with two warnings. At that later check the running collector had updated the snapshot to 96 cards, 5/12 represented channels and 5 uncommitted local photo paths. Counts changed during inspection because collection remained active; the earlier build's 21 checked local references were a different snapshot. Channel representation alone does not prove collection failure, but the absent strict gate lets the documented requirements go unenforced.
- `npm run lint`: failed, 14 errors / 2 warnings.
- `npm audit --json`: 26 package entries; report saved locally at `/tmp/air-dnd-npm-audit.json`.
- Synthetic archive-error and checkpoint-serialization reproductions above made no cloud mutations.
- Read-only HTTP probes covered both documented hostnames, snapshots, feed metadata, health routes and one public Firestore record.
- Local pattern metadata: generated `2026-09-24T23:24:53.355Z`, 102 companions, 101,000 messages and 52,770 photo records. These are saved computation counts, not a new exhaustive database census.
- M3 SSH unavailable; deployed Firestore rules inspection denied. Browser interaction, database restore, migration and real crash-recovery tests have not yet been performed.

## Proposed implementation

### Stage 1 — Preserve evidence and establish one collector

Critical decisions: use the M3 as the sole intake owner, keep the existing cloud publication path during repairs, and introduce a local SQLite journal/outbox rather than migrating all databases at once. First inspect any already-running M3 PostgreSQL store so that this does not duplicate an existing durable queue.

- **NEW** `scripts/intake_store.js` and `test/intake_store.test.js`: transactional raw-message journal keyed by channel/message ID, extraction/media/publication job state, retry status and checkpoint commits. Preserve edits as versions and keep source timestamps separate from receipt time. Use a maintained SQLite driver compatible with the verified M3 Node runtime.
- **MODIFY** `scripts/telegram_scraper.js`: record every fetched batch before filtering; separate fetch checkpoints from derived work; recover gaps through the same Telegram session; expose per-channel successful intake and pending counts.
- **MODIFY** `scripts/listing_pipeline.js`, `scripts/photo_storage.js`: report actual storage outcomes, atomic snapshot replacement, idempotent replay and explicit media failures. Preserve photo pipeline ownership and deployment caps.
- **MODIFY** `scripts/daemon.sh`, `scripts/com.sabai.scraper.plist`, `.github/workflows/scraper.yml`: explicit collector role, local process lock, controlled handover and no collection on the coding host by default. Never copy a live Telegram session to another running collector.
- **MODIFY** `scripts/heartbeat.js`: measure successful per-channel intake and backlog age; expose failed analytics jobs; do not launch a competing backfill session or rewrite the collector checkpoint.
- **VERIFY** crash after journal commit, failed archive, failed photo, failed publication, duplicate delivery, unknown/discussion-only batches, restart during an open gap and cloud outage. Replay must recover all queued work without duplicate source records. M3 collection must continue while M5 is disconnected.

### Stage 2 — Secure publication and reduce delay

- **MODIFY** `scripts/firestore_sync.js`, `firestore.rules`, `src/lib/tracker.js`: dedicated authenticated server writer; changed-record publication; public-safe projection; explicit collection rules; controlled telemetry ingress. Inventory other users of this Firebase project before deploying restrictive rules.
- **NEW** Firestore emulator rule tests and outbox fault tests. Anonymous directory reads must work, unauthorized writes and private telemetry reads must fail, and the collector must publish successfully.
- **MODIFY** `src/App.jsx`: consume Firestore updates directly, including deletion and reconnect behavior; retain labeled snapshot fallback. Avoid a full refetch for each change.
- **MODIFY** `src/components/Analytics.jsx`, `src/lib/useMarketAnalytics.js`, `scripts/compute_patterns.js`: shared canonical entity counting, explicit dataset coverage and independent computation timestamps.
- **NEW** `functions/api/health.js`: report bounded collector/publication status from a published status record; HTTP 503 when stale or unavailable, never SPA HTML.
- **MODIFY** deployment workflow and README: one verified canonical hostname, M5 build/push, separate continuously updated data, revision manifest and rollback instructions.
- **MODIFY** `package.json`, `scripts/verify_snapshot.js` and related snapshot tests: enforce the documented freshness/media/coverage gate and verify references against the final artifact. Repair asset handling through the existing photo pipeline only.
- **VERIFY** synthetic source message through archive → listing → public subscriber; establish baseline and then target p95 under 10 seconds for durable capture and under 30 seconds for deterministic publication when services are healthy. These are proposed targets, not measured current performance. Test offline/reconnect, stale status, media screening, mobile directory, map, modal and analytics.

### Stage 3 — Learn from the corpus with measured outcomes

The inspected research engines currently compute deterministic fingerprints, thresholds and statistics. No trained unsupervised or reinforcement-learning loop was identified. Useful existing research should be retained and labeled accurately.

1. Establish a versioned, human-reviewed evaluation set stratified by channel, language, discussion/listing class and time. Hold out later time periods and whole operator groups so reposts do not leak across training and evaluation. Measure field accuracy, false merges, missed records, safety false negatives and latency.
2. On the M5, evaluate multilingual text embeddings for duplicate suggestions and topic clusters. Evaluate incremental anomaly/drift detection for changes in channel volume, field coverage and extraction failures. Output review candidates with source examples; anomalies are not proof of wrong data or misconduct.
3. Store accepted/rejected corrections with reason, source evidence and parser/model version. Recompute derived views from preserved evidence. Promote a model only after it beats the deterministic baseline on the held-out set.
4. Consider a constrained contextual bandit for choosing which uncertain records deserve enrichment/review. Reward verified correction value minus latency/compute cost. Do not reward raw message count, clicks or the model's own confidence as factual accuracy. Keep minimum coverage of every channel; learning must never suppress archival. Use offline evaluation and shadow operation before any adaptive policy controls production.

M3: durable capture, bounded deterministic processing, publication retries and lightweight drift statistics. M5: embedding batches, experiments, evaluation, builds and releases. M5 availability must not gate intake. No training run or new service has been started during this audit.

## Preservation and release gates

- Keep the horizontal directory rows, live maps, gallery, charts, Thai typography, amber accent and screening behavior. No redesign is proposed.
- No file shrinkage over 30%; preserve all earned content and existing data changes.
- Separate commits for storage, identity/security and frontend publication. Each gets failure-focused tests, then commit → push → deploy → live verification where applicable.
- Take a verified backup and document rollback before the M3 handover or security-rule deployment. Require a successful authorized write before denying the old writer.

## References

- [Firebase security model](https://firebase.google.com/docs/firestore/security/overview): server IAM and browser security rules are different boundaries.
- [Firestore realtime listeners](https://firebase.google.com/docs/firestore/query-data/listen): listeners provide initial data and subsequent updates; cached data needs explicit handling.
- [GramJS update implementation](https://github.com/gram-js/gramjs/blob/master/gramjs/client/updates.ts): event delivery should be combined with durable catch-up checkpoints.
- [River](https://github.com/online-ml/river): existing incremental learning, clustering, anomaly and drift tooling to evaluate before inventing a framework.
- [OpenAI reinforcement-learning concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html): policies optimize a reward signal; defining that signal is a prerequisite.
