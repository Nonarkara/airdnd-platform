#!/usr/bin/env bash
# The one³ gates, run locally, in one command.
#
# WHY THIS EXISTS
#
# The GitHub Actions budget for this repository is exhausted. Every push
# produces a run that fails in four seconds with:
#
#   "The job was not started because an Actions budget is preventing
#    further use."
#
# That is not a failure of the gates — it is the gates never being given a
# runner. A gate that cannot run is not a gate, and the honest response to
# "CI will not start" is not to leave the checks in a YAML file nobody can
# execute. It is to make the same checks runnable by one command, on the
# machine that has the browser and the build.
#
# So this script is the CI, locally. It runs the same instruments, in the
# same order, against a real build served over HTTP — and it fails loudly
# and non-zero when any of them fails.
#
#   bash scripts/otop/gates.sh [base-url]
#
# With no argument it builds the site, serves it on a free port, runs every
# gate against that server, and shuts the server down. With a base URL it
# points the gates at an existing server — a preview, or the live site:
#
#   bash scripts/otop/gates.sh https://otop.nonarkara.org
#
# The browser-based gates need Playwright's Chromium:
#
#   npx playwright install chromium

set -uo pipefail

cd "$(dirname "$0")/../.."

BASE="${1:-}"
PORT="${GATE_PORT:-8124}"
OWN_SERVER=0
FAILED=0

say()  { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAILED=1; }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

cleanup() {
  if [[ "$OWN_SERVER" == "1" && -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------- the unit tests
head_ "1. The unit tests"
if node --test test/otop_*.test.js test/listing_contract.test.js test/publicWorks.test.js 2>&1 | tail -12; then
  say "unit tests pass"
else
  fail "unit tests FAILED — the numbers this site prints come from this code"
fi

# ---------------------------------------------------------------- the server
if [[ -z "$BASE" ]]; then
  head_ "2. The build"
  if npm run otop:site >/dev/null 2>&1; then
    say "site built to dist-otop/"
  else
    fail "the build FAILED"
    exit 1
  fi

  # A port that is already in use would make the gates measure somebody
  # else's site — or, worse, a stale build of this one.
  if lsof -ti:"$PORT" >/dev/null 2>&1; then
    fail "port $PORT is already in use — set GATE_PORT to a free one"
    exit 1
  fi

  npx vite preview --config vite.otop.config.js --port "$PORT" --strictPort >/tmp/otop-gates-server.log 2>&1 &
  SERVER_PID=$!
  OWN_SERVER=1
  BASE="http://localhost:$PORT"

  for _ in $(seq 1 40); do
    if curl -sf "$BASE/otop_index.json" >/dev/null 2>&1; then break; fi
    sleep 1
  done
  if ! curl -sf "$BASE/otop_index.json" >/dev/null 2>&1; then
    fail "the preview server did not come up — see /tmp/otop-gates-server.log"
    exit 1
  fi
  say "preview serving on $BASE"
fi

# ---------------------------------------------------------------- the gates
head_ "3. The route sweep — every view renders, names itself, and has no dead ends"
if node scripts/otop-routes-check.mjs "$BASE"; then
  say "every route renders its own view, with a title, a canonical, and no broken link"
else
  fail "the route sweep FAILED"
fi

head_ "4. The route register — the instruments cover the whole site"
if node scripts/otop/routes.mjs --json >/dev/null; then
  say "the register matches the application's own route table"
else
  fail "the route register is STALE — a view exists that no gate measures"
fi

head_ "5. The preservation probe — focus, targets, text size, contrast"
if node scripts/otop-preservation.mjs "$BASE"; then
  say "the product is preserved at every viewport"
else
  fail "the preservation probe FAILED"
fi

head_ "6. The MSH audit — chrome cost, task visibility, hierarchy"
if node scripts/otop-msh-audit.mjs "$BASE" design/msh-evidence/latest; then
  say "no spatial hallucination found at 390 / 1024 / 1440"
else
  fail "the MSH audit FAILED"
fi

head_ "7. The spatial law — the gate against the recorded baseline"
if node scripts/spatial/spatial-check.mjs --dir design/spatial-snapshots --baseline design/spatial-baseline.json; then
  say "the spatial law holds"
else
  fail "the spatial gate FAILED"
fi

head_ "8. The falsifier — proof that the gate above can actually fail"
if node scripts/spatial/spatial-falsify.mjs design/spatial-snapshots; then
  say "the gate bites"
else
  fail "the falsifier FAILED — the gate may not be able to fail at all"
fi

printf '\n'
if [[ "$FAILED" == "0" ]]; then
  printf '\033[32mAll gates pass.\033[0m\n'
else
  printf '\033[31mOne or more gates FAILED.\033[0m\n'
fi
exit "$FAILED"
