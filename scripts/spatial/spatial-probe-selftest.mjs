#!/usr/bin/env node
/**
 * THE PROBE'S OWN SELF-TEST — does the instrument measure what it claims?
 *
 * The spatial probe reports a "false hierarchy" measurement: the title's size
 * against the next largest text on the page, and how much of the page is set
 * in the loud voice. Both numbers were TAUTOLOGIES on this site:
 *
 *   - every bilingual title is one <h1> holding two spans, the English line at
 *     the title's own size and the Thai line beneath it at 0.78em. Those spans
 *     are not "the next largest text on the page" — they ARE the title. They
 *     were being counted as the page's competitor, so the ratio was pinned at
 *     1.00 on every view at every width;
 *   - the title's own Thai line was counted as "the page shouting over the
 *     title", so the peer-share measured the title talking to itself.
 *
 * A number that cannot move is not a measurement, and a rule built on it
 * catches nothing. The fix was to measure the title as a SUBTREE. This file
 * proves the fix by feeding the probe three synthetic pages — one where the
 * title is alone, one where the title's own child is the only competitor, and
 * one where something outside the title really does shout — and checking the
 * numbers the probe returns.
 *
 * The gate's falsifier proves a rule BITES. It cannot prove the rule is
 * pointed at the right thing: a rule that measures the wrong quantity can
 * fail loudly forever and still be wrong. This file points the instrument at
 * known pages and checks what it says about them.
 *
 * Usage: node spatial-probe-selftest.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(HERE, "spatial-probe.js");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((c) => existsSync(c));
if (!CHROME) {
  console.error("\nFAIL — no Chrome binary found; the probe could not be asked anything.\n");
  process.exit(1);
}

// The synthetic page. It carries a <main id="content"> because that is where
// the probe looks, and it runs the probe's own measure() and writes the
// hierarchy it got into a <pre> the self-test can read back out of the DOM.
function page(body) {
  const probe = readFileSync(PROBE, "utf8");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>probe self-test</title>
<style>
  body { margin:0; font-family: system-ui, sans-serif; }
  main { display:block; }
  h1,h2,p { margin:0; }
</style></head><body>
<main id="content">${body}</main>
<pre id="out">PENDING</pre>
<script>${probe}</script>
<script>
(function () {
  var rec = window.__SPATIAL_MEASURE__("/", 1024, document);
  var out = document.getElementById("out");
  out.textContent = JSON.stringify({ hierarchy: rec.hierarchy, chars: rec.chars, findings: rec.findings });
})();
</script>
</body></html>`;
}

const WORK = mkdtempSync(path.join(tmpdir(), "probe-selftest-"));

function measure(body) {
  const file = path.join(WORK, "case.html");
  writeFileSync(file, page(body));
  const dom = execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--user-data-dir=" + path.join(WORK, "profile-" + Math.random().toString(36).slice(2)),
      "--virtual-time-budget=4000",
      "--dump-dom",
      "file://" + file,
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
  );
  const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);
  if (!m) throw new Error("the probe wrote nothing back — the page never ran");
  const raw = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  if (raw.trim() === "PENDING") throw new Error("the probe never ran — the measurement is missing");
  return JSON.parse(raw);
}

// ---------------------------------------------------------------- the cases
// The two body strings of the loud-share case. The expectation is computed
// from these, so the test cannot be wrong because somebody mis-counted.
const LOUD = "Loud body text, set in the loud voice of the house style.";
const QUIET = "Quiet body text, set in the ordinary voice of the house style.";

const CASES = [
  {
    name: "the title's own bilingual span is not the page's competitor",
    why:
      "The defect this site actually had. A bilingual title is one <h1> holding two spans: " +
      "the English line at the title's size and the Thai line at 0.78em. Both are the TITLE. " +
      "Counting them made the ratio a constant 1.00 on every view, at every width — a number " +
      "that could never move, and so a rule that could never fire.",
    body: `<h1 style="font-size:32px"><span style="font-size:32px">A title</span><span style="font-size:25px">หัวเรื่อง</span></h1>
           <p style="font-size:16px">Body text that is plainly smaller than the title.</p>`,
    check(h) {
      // The next largest text OUTSIDE the title is the 16px paragraph.
      if (h.largest !== 16) return `the next largest text should be the 16px paragraph, got ${h.largest}px`;
      // 32 / 16 = 2.0. The old measurement returned 1.00.
      if (h.ratio !== 2) return `the title should be 2x the next largest text, got ${h.ratio}`;
      return null;
    },
  },
  {
    name: "a heading outside the title that really does shout",
    why:
      "The positive control. The fix must not have made the rule deaf: a 40px heading beside a " +
      "32px title is a page where the title loses, and the probe has to say so.",
    body: `<h1 style="font-size:32px">A title</h1>
           <h2 style="font-size:40px">A heading that shouts over the title</h2>`,
    check(h) {
      if (h.largest !== 40) return `the next largest text should be the 40px heading, got ${h.largest}px`;
      if (h.ratio !== 0.8) return `the title should be 0.8x the next largest text, got ${h.ratio}`;
      return null;
    },
  },
  {
    name: "the loud share counts the body, not the title",
    why:
      "The second half of the defect. The title's Thai line is loud by the rule's own measure " +
      "(weight >= 600, >= 15px, below the title's size) — but it is the title, and the title is " +
      "allowed to be loud. It must not be counted as the page shouting over itself.",
    body: `<h1 style="font-size:32px;font-weight:700"><span style="font-size:32px">A title</span><span style="font-size:25px;font-weight:700">หัวเรื่อง</span></h1>
           <p style="font-size:16px;font-weight:700">${LOUD}</p>
           <p style="font-size:16px">${QUIET}</p>`,
    check(h) {
      if (!h.titleChars) return "the title's characters were not counted at all";
      if (h.peers !== 1) return `exactly one body element should be in the loud voice, got ${h.peers}`;
      // The share is computed from the strings themselves, not from a count
      // written by hand — a hand-counted expectation is a guess dressed as a
      // fact, and it is exactly how an instrument gets trusted wrongly.
      const bodyTotal = LOUD.length + QUIET.length;
      const withTitle = LOUD.length / (bodyTotal + h.titleChars);
      const bodyOnly = LOUD.length / bodyTotal;
      if (Math.abs(h.share - bodyOnly) > 0.02) {
        return (
          `the loud share should be the loud paragraph over the BODY (${bodyOnly.toFixed(2)}), ` +
          `got ${h.share}; counting the title in the denominator would have read ${withTitle.toFixed(2)}`
        );
      }
      return null;
    },
  },
  {
    name: "a page with no title measures nothing rather than guessing",
    why:
      "A page with no <h1> has no title, so it has no hierarchy to measure. The instrument must " +
      "say so — it must not divide by the largest text it can find and report a ratio for a " +
      "page whose focal point it never located.",
    body: `<p style="font-size:16px">A page that never learned to have a title.</p>`,
    check(h) {
      if (h.ratio !== null) return `a page with no title should report no ratio, got ${h.ratio}`;
      if (h.h1Count !== 0) return `a page with no title should report zero titles, got ${h.h1Count}`;
      return null;
    },
  },
];

let failures = 0;
for (const c of CASES) {
  let problem = null;
  let h = null;
  try {
    h = measure(c.body).hierarchy;
    problem = c.check(h);
  } catch (e) {
    problem = `the instrument could not be asked: ${e.message}`;
  }
  if (problem) {
    console.error(`  ✗ ${c.name}\n      ${problem}`);
    failures++;
  } else {
    console.log(
      `  · measured right: ${c.name}` +
        `\n      title ${h.title}px · next ${h.largest}px · ratio ${h.ratio} · share ${h.share} · peers ${h.peers}` +
        `\n      ${c.why}`,
    );
  }
}

rmSync(WORK, { recursive: true, force: true });

if (failures) {
  console.error(`\nFAIL — ${failures} of ${CASES.length} measurement(s) are wrong. The instrument cannot be trusted.\n`);
  process.exit(1);
}
console.log(`\nThe probe measures what it claims: ${CASES.length}/${CASES.length} cases correct.\n`);
