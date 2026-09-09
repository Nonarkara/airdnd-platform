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
check_json p/34.json          "Array.isArray(d) ? \`shard TH-34 · \${d.length} records\` : 'ERR shard is not an array'" "province shard"

# 4. The SPA fallback. Without it every deep link 404s and only the bare domain
#    works — which nobody notices until someone shares a link.
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" "$BASE/deep/link/that/does/not/exist" || echo 000)
[[ "$code" == "200" ]] && say "SPA fallback (_redirects)" "200" || bad "SPA fallback (_redirects)" "got $code"

echo
if [[ $fail -eq 0 ]]; then echo "all checks passed"; else echo "$fail check(s) failed"; fi
[[ $fail -eq 0 ]]
