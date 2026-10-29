#!/usr/bin/env bash
# Smoke-test the deployed one·tambon site.
#
#   npm run otop:verify                          # the canonical host
#   BASE=https://otop.pages.dev npm run otop:verify
#
# "The site loads" is not a test. This checks the three things that actually
# break: the deploy silently served an OLD bundle, the registry artefacts are
# missing or truncated, and the SPA fallback stopped catching deep links.
# Any of those and the page is up while showing nothing, or showing yesterday.
set -uo pipefail

BASE="${BASE:-https://otop.pages.dev}"
DIST="${DIST:-dist-otop}"
TIMEOUT="${TIMEOUT:-25}"
fail=0

say() { printf "  %-34s %s\n" "$1" "$2"; }
bad() { say "$1" "FAIL — $2"; fail=$((fail + 1)); }

echo "verifying $BASE"
printf "  %-34s %s\n" "check" "result"
printf "  %-34s %s\n" "-----" "------"

html=$(curl -sS --max-time "$TIMEOUT" "$BASE/" || true)
[[ -n "$html" ]] || { bad "GET /" "no response"; echo; echo "$fail failed"; exit 1; }
say "GET /" "200"

# 1. The bundle actually served is the one last built here. A Pages deploy that
#    uploads nothing new still reports success, so compare the hashed filename
#    against the local dist rather than trusting the deploy output.
live_js=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' <<<"$html" | head -1)
if [[ -d "$DIST" ]]; then
  local_js=$(cd "$DIST" && ls assets/index-*.js 2>/dev/null | head -1)
  if [[ -z "$local_js" ]]; then
    say "bundle vs local dist" "skipped — no local build"
  elif [[ "$live_js" == "$local_js" ]]; then
    say "bundle vs local dist" "match ($live_js)"
  else
    bad "bundle vs local dist" "live $live_js != local $local_js"
  fi
else
  say "bundle vs local dist" "skipped — no $DIST"
fi

# 2. The Atlas chunk is split out, so a broken lazy import shows as a blank
#    section rather than a build error. Fetch it directly.
atlas=$(curl -sS --max-time "$TIMEOUT" "$BASE/$live_js" |
  grep -o 'Atlas-[A-Za-z0-9_-]*\.js' | head -1)
if [[ -n "$atlas" ]]; then
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$BASE/assets/$atlas" || echo 000)
  [[ "$code" == "200" ]] && say "atlas chunk" "200 ($atlas)" || bad "atlas chunk" "$atlas -> $code"
else
  bad "atlas chunk" "not referenced by the bundle"
fi

# 2b. The province dossier is the link that gets shared. Its chunk is lazy, and
#     it reads otop_revenue.json — either missing renders a wordmark and nothing.
dossier=$(curl -sS --max-time "$TIMEOUT" "$BASE/$live_js" |
  grep -o 'ProvinceDossier-[A-Za-z0-9_-]*\.js' | head -1)
if [[ -n "$dossier" ]]; then
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$BASE/assets/$dossier" || echo 000)
  [[ "$code" == "200" ]] && say "dossier chunk" "200 ($dossier)" || bad "dossier chunk" "$dossier -> $code"
else
  bad "dossier chunk" "not referenced by the bundle"
fi

# 2c. The briefs view is the forwardable infographic layer. Its chunk is lazy,
#     and it reads otop_briefs.json — either missing renders a wordmark and nothing.
briefs=$(curl -sS --max-time "$TIMEOUT" "$BASE/$live_js" |
  grep -o 'Briefs-[A-Za-z0-9_-]*\.js' | head -1)
if [[ -n "$briefs" ]]; then
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$BASE/assets/$briefs" || echo 000)
  [[ "$code" == "200" ]] && say "briefs chunk" "200 ($briefs)" || bad "briefs chunk" "$briefs -> $code"
else
  bad "briefs chunk" "not referenced by the bundle"
fi

# 3. The published artefacts, checked for shape rather than status code — a
#    truncated or half-written JSON still returns 200.
check_json() { # url  node-expression-returning-a-string  label
  local out
  out=$(curl -sS --max-time "$TIMEOUT" "$BASE/$1" | node -e "
    let raw = ''; process.stdin.on('data', (c) => { raw += c; });
    process.stdin.on('end', () => {
      let d; try { d = JSON.parse(raw); } catch { console.log('ERR unparseable or empty'); return; }
      try { console.log($2); } catch (e) { console.log('ERR ' + e.message); }
    });
  " 2>&1)
  [[ "$out" == ERR* ]] && bad "$3" "${out#ERR }" || say "$3" "$out"
}
check_json otop_index.json    "\`\${d.totals.records} records · \${d.totals.provincesWithRecords}/\${d.totals.provincesTotal} provinces\`" "otop_index.json"
check_json otop_insights.json "d.byProvince.length === d.national.provincesCovered ? \`\${d.national.provincesCovered} provinces · \${d.contributors.length} offices\` : 'ERR only ' + d.byProvince.length + ' provinces'" "otop_insights.json"
check_json otop_meta.json     "d.counts.resourcesAggregateEconomic != null ? \`\${d.counts.resourcesAggregateEconomic} economic aggregates · \${d.counts.resourcesExcludedByTitle} excluded by title\` : 'ERR resourcesAggregateEconomic missing — old build served'" "otop_meta.json"
check_json otop_revenue.json  "d.degraded ? 'ERR degraded: ' + d.reason : \`\${d.coverage.provincesWithData}/\${d.coverage.provinces} provinces · \${d.byCategory ? d.byCategory.years.length + ' category years · gap ' + d.reconciliation.medianGapPct + '%' : 'no category table'}\`" "otop_revenue.json"
check_json otop_tambons.json  "d.coverage && d.tambons.length > 5000 ? \`\${d.coverage.placed.toLocaleString()} records placed across \${d.tambons.length} tambons (\${d.coverage.placedShare}%)\` : 'ERR tambon layer missing or truncated'" "otop_tambons.json"
check_json otop_graph.json    "d.nodes.length > 100 && d.edges.length > 100 ? \`\${d.nodes.length} nodes · \${d.edges.length} edges\` : 'ERR universe graph missing or truncated'" "otop_graph.json"
check_json otop_insights.json "d.certification && d.certification.certified > 10000 ? \`\${d.certification.certified.toLocaleString()} certified · \${d.certification.valid.toLocaleString()} valid\` : 'ERR certification join missing — old build served'" "certification join"
check_json p/34.json          "Array.isArray(d) ? \`shard TH-34 · \${d.length} records\` : 'ERR shard is not an array'" "province shard"
check_json otop_briefs.json   "d.cards && d.cards.snapshot && d.provinces.length === 77 ? \`6 cards · \${d.provinces.length} one-liners\` : 'ERR briefs cards missing — old build served'" "otop_briefs.json"
check_json otop_province_faces.json "d.provinces && d.provinces.length === 77 ? \`\${d.provinces.length} signature packs · \${d.counts.withNamedProducts} with named products\` : 'ERR province faces missing'" "otop_province_faces.json"
check_json media/provinces/index.json "d.counts && d.counts.provinces >= 1 ? \`\${d.counts.withPhotos}/\${d.counts.provinces} provinces with licensed photos\` : 'ERR province media index missing'" "province media index"
check_json otop_datasets.json "d.totals && d.totals.discovered > 500 && d.groups.length >= 7 ? \`\${d.totals.discovered} discovered · \${d.totals.pulled} pulled · \${d.groups.length} shelves\` : 'ERR data bank missing — old build served'" "otop_datasets.json"

# 4. THE SPA fallback. Without it every deep link 404s and only the bare domain
#    works — which nobody notices until someone shares a link.
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$BASE/deep/link/that/does/not/exist" || echo 000)
[[ "$code" == "200" ]] && say "SPA fallback (_redirects)" "200" || bad "SPA fallback (_redirects)" "got $code"

# 5. THE DOCUMENTS. The site is a register with fifteen documents in it, and
#    each one has to BE a document: a path that serves 200 but hands back the
#    SPA shell says nothing to a reader who does not run JavaScript — and
#    most of the web's readers, and every crawler, do not.
#
#    This is where a deploy that shadows the prerendered files with the
#    redirect rule shows up. It fails loudly rather than shipping a
#    prerender that nothing ever sees.
#
#    The route list is read from the shared register, which reads the app's
#    own route table — so this checks the documents the app actually has.
routes_json=$(node scripts/otop/routes.mjs --json 2>/dev/null)
if [[ -z "$routes_json" ]]; then
  bad "document sweep" "the route register could not be read"
else
  doc_report=$(ROUTES_JSON="$routes_json" BASE="$BASE" TIMEOUT="$TIMEOUT" node --input-type=module -e '
    const routes = JSON.parse(process.env.ROUTES_JSON);
    const BASE = process.env.BASE;
    let bad = 0, checked = 0, noTitle = 0, noContent = 0, noCanon = 0, noLd = 0;
    for (const r of routes) {
      const res = await fetch(BASE + r.path, { redirect: "follow" }).catch(() => null);
      if (!res) { console.log(`  FAIL ${r.path} — no response`); bad++; continue; }
      const html = await res.text();
      checked++;
      // A document that is only the SPA shell: the empty root div the
      // application ships. (No apostrophes in here — an apostrophe inside a
      // single-quoted shell string ends the string, and the whole verifier
      // stops parsing. It did, once.)
      const shellOnly = /<div id="root"><\/div>/.test(html);
      // The heading the view is known to carry. Its absence means the path
      // rendered something other than the document it claims to be.
      const hasContent = !shellOnly && (r.h1 ? html.includes(r.h1) : html.length > 2000);
      if (shellOnly || !hasContent) { noContent++; bad++; }
      const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
      if (!t || (r.title && !t.includes(r.title))) { noTitle++; bad++; }
      const c = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || "";
      if (!c) { noCanon++; bad++; }
      if (!/application\/ld\+json/.test(html)) { noLd++; bad++; }
    }
    console.log(`  ${checked} documents · ${noContent} without content · ${noTitle} without a subject title · ${noCanon} without a canonical · ${noLd} without structured data`);
    process.exit(bad ? 1 : 0);
  ' 2>&1)
  if [[ $? -eq 0 ]]; then say "documents (15 paths)" "$doc_report"; else bad "documents (15 paths)" "$doc_report"; fi
fi

# 6. THE CARD. The site is shared in messages, and what appears there is one
#    image. If it is missing the share shows a blank rectangle.
og_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$BASE/og/otop.png" || echo 000)
[[ "$og_code" == "200" ]] && say "og:image" "200" || bad "og:image" "got $og_code"

# 7. THE CRAWLER'S TWO FILES. Both were served as the SPA shell before the
#    prerender wrote them — a sitemap that is an HTML page is not a sitemap,
#    and a robots.txt that is an HTML page tells a crawler nothing.
sm=$(curl -sS --max-time "$TIMEOUT" "$BASE/sitemap.xml" || true)
if [[ "$sm" == \<?xml* && "$sm" == *"<urlset"* ]]; then
  n=$(grep -c "<loc>" <<<"$sm")
  say "sitemap.xml" "$n urls"
else
  bad "sitemap.xml" "not an XML urlset — the SPA shell is being served instead"
fi
rb=$(curl -sS --max-time "$TIMEOUT" "$BASE/robots.txt" || true)
if [[ "$rb" == *"User-agent:"* && "$rb" == *"Sitemap:"* ]]; then
  say "robots.txt" "ok"
else
  bad "robots.txt" "not a robots file — the SPA shell is being served instead"
fi

# 8. THE LINK GRAPH. A crawler follows links and cannot press buttons, so a
#    header made of <button> elements is a header a crawler cannot use. The
#    nav must be anchors in the SERVED HTML, not anchors the script builds.
navlinks=$(grep -o 'class="hdr-nav"' <<<"$html" | wc -l | tr -d ' ')
anchor_count=$(node -e '
  let raw=""; process.stdin.on("data",(c)=>{raw+=c;});
  process.stdin.on("end",()=>{
    const m = raw.match(/<nav class="hdr-nav"[\s\S]*?<\/nav>/);
    console.log(m ? (m[0].match(/<a /g)||[]).length : 0);
  });
' <<<"$html")
if [[ "$anchor_count" -ge 6 ]]; then
  say "nav link graph" "$anchor_count anchors in the served HTML"
else
  bad "nav link graph" "$anchor_count anchors in the served HTML (need 6) — the nav is not crawlable"
fi

echo
if [[ $fail -eq 0 ]]; then echo "all checks passed"; else echo "$fail check(s) failed"; fi
[[ $fail -eq 0 ]]
