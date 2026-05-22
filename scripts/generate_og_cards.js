#!/usr/bin/env node
/*
 * Sabai Sabai — OG share-card generator.
 *
 * Reads public/data.json. For each listing, renders a 1200×630 PNG card
 * (cyberpunk crosshatch background, parlour photo, Audiowide headline,
 * Share Tech Mono protocol stamp) and writes it to public/og/listing-<id>.png.
 * Plus a default fallback at public/og/default.png for home/analytics/methodology.
 *
 * Pipeline: satori renders JSX-ish object → SVG, resvg-js rasterises → PNG.
 *
 * Wired into npm run build via package.json so every deploy refreshes cards.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'public', 'data.json');
const OUT_DIR = path.join(ROOT, 'public', 'og');
const FONTS_DIR = path.join(ROOT, 'scripts', 'fonts');

// Google Fonts TTF URLs (stable). Cached locally on first run.
// TTF URLs resolved from Google Fonts CSS API. They are versioned (v22, v13)
// and may rotate; on 404 the script self-heals by re-fetching the CSS.
const FONTS = [
  { name: 'Audiowide', weight: 400, style: 'normal', url: 'https://fonts.gstatic.com/s/audiowide/v22/l7gdbjpo0cum0ckerWCtkQ.ttf', file: 'Audiowide.ttf' },
  { name: 'ChakraPetch', weight: 400, style: 'normal', url: 'https://fonts.gstatic.com/s/chakrapetch/v13/cIflMapbsEk7TDLdtEz1BwkeJI9FQA.ttf', file: 'ChakraPetch-Regular.ttf' },
  { name: 'ChakraPetch', weight: 700, style: 'normal', url: 'https://fonts.gstatic.com/s/chakrapetch/v13/cIf6MapbsEk7TDLdtEz1BwkmmA.ttf', file: 'ChakraPetch-Bold.ttf' },
  { name: 'ShareTechMono', weight: 400, style: 'normal', url: 'https://fonts.gstatic.com/s/sharetechmono/v16/J7aHnp1uDWRBEqV98dVQztYldFc7pA.ttf', file: 'ShareTechMono-Regular.ttf' },
];

const COLOR_BG = '#0a0a0a';
const COLOR_INK = '#f0f0f0';
const COLOR_INK_SOFT = '#a0a0a0';
const COLOR_INK_MUTED = '#808080';
const COLOR_LINE = '#2a2a2a';
const COLOR_ACTION = '#ff7440';
const COLOR_DATA = '#9fc2ff';
const COLOR_STATUS = '#34d399';

async function fetchFontIfMissing(fontDef) {
  const filePath = path.join(FONTS_DIR, fontDef.file);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  fs.mkdirSync(FONTS_DIR, { recursive: true });
  console.log(`  fetching ${fontDef.file}...`);
  const res = await fetch(fontDef.url);
  if (!res.ok) throw new Error(`Failed to fetch font ${fontDef.file}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
  return buf;
}

async function fetchImageAsDataUri(url) {
  if (!url || typeof url !== 'string' || url.startsWith('/mockups/')) return null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function tronGridSvgUri() {
  // 1200×630 SVG with orange crosshatch lines + a subtle horizon scanline
  // band. Used as the right-pane background image — gives the card the
  // instrument-panel cyberpunk feel without 3D perspective (satori won't
  // render perspective transforms, so a flat grid is the cleanest move).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="630" viewBox="0 0 600 630">
    <defs>
      <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${COLOR_ACTION}" stroke-width="1" opacity="0.18"/>
      </pattern>
      <linearGradient id="fade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${COLOR_BG}" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="${COLOR_BG}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${COLOR_BG}" stop-opacity="0.6"/>
      </linearGradient>
    </defs>
    <rect width="600" height="630" fill="${COLOR_BG}"/>
    <rect width="600" height="630" fill="url(#grid)"/>
    <rect width="600" height="630" fill="url(#fade)"/>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function clip(s, max) {
  if (!s) return '';
  const trimmed = String(s).trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

async function buildCardElement(listing, photoDataUri, gridUri) {
  const idLabel = String(listing?.id ?? '—').padStart(3, '0');
  const name = clip(listing?.name, 38);
  const city = clip(listing?.city || 'Bangkok', 28);
  const channel = clip((listing?.sourceChannel || '').replace(/^@/, '').toUpperCase(), 24);
  const hours = clip(listing?.hours, 28);
  const rate = clip(listing?.priceLabel || 'Rate on request', 22);
  const mentions = Number(listing?.mentionCount) || 0;

  return {
    type: 'div',
    props: {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        backgroundColor: COLOR_BG,
        fontFamily: 'ChakraPetch',
        color: COLOR_INK,
      },
      children: [
        // Photo pane (left)
        {
          type: 'div',
          props: {
            style: {
              width: 600,
              height: 630,
              display: 'flex',
              backgroundColor: '#050505',
              position: 'relative',
            },
            children: [
              photoDataUri
                ? {
                    type: 'img',
                    props: {
                      src: photoDataUri,
                      width: 600,
                      height: 630,
                      style: { width: 600, height: 630, objectFit: 'cover', filter: 'saturate(0.78) contrast(0.94) brightness(0.86)' },
                    },
                  }
                : {
                    type: 'div',
                    props: {
                      style: { width: 600, height: 630, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR_INK_MUTED, fontSize: 18, fontFamily: 'ShareTechMono' },
                      children: 'NO MEDIA',
                    },
                  },
              // Subtle vertical separator between panes
              { type: 'div', props: { style: { position: 'absolute', top: 0, right: 0, width: 1, height: 630, backgroundColor: COLOR_ACTION, opacity: 0.55 } } },
            ],
          },
        },
        // Data pane (right) — Tron crosshatch background
        {
          type: 'div',
          props: {
            style: {
              width: 600,
              height: 630,
              display: 'flex',
              flexDirection: 'column',
              padding: '40px 48px',
              backgroundImage: `url(${gridUri})`,
              backgroundSize: '600px 630px',
              backgroundRepeat: 'no-repeat',
              position: 'relative',
            },
            children: [
              // Eyebrow protocol stamp
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontFamily: 'ShareTechMono',
                    fontSize: 16,
                    color: COLOR_ACTION,
                    letterSpacing: '0.18em',
                    marginBottom: 28,
                  },
                  children: `[ SABAI_SABAI / LISTING-${idLabel} ]`,
                },
              },
              // Audiowide headline (note: Audiowide isn't loaded as a satori font here because Thai
              // glyphs aren't covered — we use ChakraPetch Bold for the headline so Thai + Latin
              // both render. The "cyberpunk" character lives in the protocol stamp + grid.)
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontFamily: 'ChakraPetch',
                    fontSize: 56,
                    fontWeight: 700,
                    lineHeight: 1.05,
                    color: COLOR_INK,
                    marginBottom: 24,
                    maxWidth: 504,
                    wordBreak: 'break-word',
                  },
                  children: name || '—',
                },
              },
              // City line
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontFamily: 'ShareTechMono',
                    fontSize: 18,
                    color: COLOR_DATA,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    marginBottom: 36,
                  },
                  children: city.toUpperCase(),
                },
              },
              // Stat row — hours · rate · mentions
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    marginBottom: 'auto',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', flexDirection: 'column', gap: 4 },
                        children: [
                          { type: 'div', props: { style: { display: 'flex', fontFamily: 'ShareTechMono', fontSize: 14, color: COLOR_INK_MUTED, letterSpacing: '0.14em', textTransform: 'uppercase' }, children: 'HOURS' } },
                          { type: 'div', props: { style: { display: 'flex', fontFamily: 'ChakraPetch', fontSize: 24, color: COLOR_INK }, children: hours || '—' } },
                        ],
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', flexDirection: 'column', gap: 4 },
                        children: [
                          { type: 'div', props: { style: { display: 'flex', fontFamily: 'ShareTechMono', fontSize: 14, color: COLOR_INK_MUTED, letterSpacing: '0.14em', textTransform: 'uppercase' }, children: 'RATE' } },
                          { type: 'div', props: { style: { display: 'flex', fontFamily: 'ChakraPetch', fontSize: 24, color: COLOR_ACTION }, children: rate } },
                        ],
                      },
                    },
                    mentions > 0 && {
                      type: 'div',
                      props: {
                        style: { display: 'flex', flexDirection: 'column', gap: 4 },
                        children: [
                          { type: 'div', props: { style: { display: 'flex', fontFamily: 'ShareTechMono', fontSize: 14, color: COLOR_INK_MUTED, letterSpacing: '0.14em', textTransform: 'uppercase' }, children: 'COMMUNITY SIGNAL' } },
                          { type: 'div', props: { style: { display: 'flex', fontFamily: 'ChakraPetch', fontSize: 22, color: COLOR_STATUS }, children: `${mentions}× mentions${channel ? ` on @${channel.toLowerCase()}` : ''}` } },
                        ],
                      },
                    },
                  ].filter(Boolean),
                },
              },
              // Footer wordmark
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    paddingTop: 24,
                    borderTop: `1px solid ${COLOR_LINE}`,
                  },
                  children: [
                    { type: 'div', props: { style: { display: 'flex', fontFamily: 'ChakraPetch', fontSize: 22, fontWeight: 700, color: COLOR_ACTION, letterSpacing: '0.04em' }, children: 'SABAI SABAI' } },
                    { type: 'div', props: { style: { display: 'flex', fontFamily: 'ShareTechMono', fontSize: 13, color: COLOR_INK_MUTED, letterSpacing: '0.12em' }, children: 'sabai-sabai-4uh.pages.dev' } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

async function buildDefaultElement(gridUri) {
  return {
    type: 'div',
    props: {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        padding: '60px 72px',
        backgroundColor: COLOR_BG,
        backgroundImage: `url(${gridUri})`,
        backgroundSize: '1200px 630px',
        backgroundRepeat: 'no-repeat',
        fontFamily: 'ChakraPetch',
      },
      children: [
        { type: 'div', props: { style: { display: 'flex', fontFamily: 'ShareTechMono', fontSize: 18, color: COLOR_ACTION, letterSpacing: '0.18em', marginBottom: 48 }, children: '[ SABAI_SABAI / COMMUNITY INTELLIGENCE PLATFORM ]' } },
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 'auto' }, children: [
          { type: 'div', props: { style: { display: 'flex', fontFamily: 'ChakraPetch', fontSize: 96, fontWeight: 700, color: COLOR_INK, lineHeight: 1, letterSpacing: '0.01em' }, children: 'SABAI SABAI' } },
          { type: 'div', props: { style: { display: 'flex', fontFamily: 'ShareTechMono', fontSize: 22, color: COLOR_DATA, letterSpacing: '0.12em', textTransform: 'uppercase' }, children: 'Thailand wellness intelligence · live community feed' } },
        ] } },
        { type: 'div', props: { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 32, borderTop: `1px solid ${COLOR_LINE}` }, children: [
          { type: 'div', props: { style: { display: 'flex', fontFamily: 'ChakraPetch', fontSize: 24, fontWeight: 700, color: COLOR_ACTION }, children: 'sabai-sabai-4uh.pages.dev' } },
          { type: 'div', props: { style: { display: 'flex', fontFamily: 'ShareTechMono', fontSize: 16, color: COLOR_INK_MUTED, letterSpacing: '0.12em' }, children: 'AI-extracted · zero-marginal-cost' } },
        ] } },
      ],
    },
  };
}

async function renderToPng(element, fonts, width = 1200, height = 630) {
  const svg = await satori(element, { width, height, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  return png;
}

async function main() {
  console.log('=== OG card generator ===');
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Missing ${DATA_PATH}. Run snapshot:refresh first.`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('loading fonts...');
  const fonts = [];
  for (const def of FONTS) {
    const buf = await fetchFontIfMissing(def);
    fonts.push({ name: def.name, data: buf, weight: def.weight, style: def.style });
  }

  const listings = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const safe = listings.filter((l) => l && l.id != null && l.isSafeImage !== false);
  console.log(`generating ${safe.length} listing cards + 1 default...`);

  const gridUriSplit = tronGridSvgUri();        // 600×630 grid for listing cards
  // Wider grid for the default card (1200×630)
  const gridUriWide = (() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <pattern id="g" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="${COLOR_ACTION}" stroke-width="1" opacity="0.16"/>
        </pattern>
      </defs>
      <rect width="1200" height="630" fill="${COLOR_BG}"/>
      <rect width="1200" height="630" fill="url(#g)"/>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  })();

  // Default card
  const defaultEl = await buildDefaultElement(gridUriWide);
  const defaultPng = await renderToPng(defaultEl, fonts);
  fs.writeFileSync(path.join(OUT_DIR, 'default.png'), defaultPng);
  console.log('  ✓ default.png');

  let ok = 0, fail = 0;
  for (const listing of safe) {
    try {
      const photoDataUri = await fetchImageAsDataUri(listing.imageUrl);
      const el = await buildCardElement(listing, photoDataUri, gridUriSplit);
      const png = await renderToPng(el, fonts);
      fs.writeFileSync(path.join(OUT_DIR, `listing-${listing.id}.png`), png);
      ok += 1;
      if (ok % 10 === 0) console.log(`  ${ok}/${safe.length}...`);
    } catch (err) {
      fail += 1;
      console.error(`  ✗ listing-${listing.id}: ${err.message}`);
    }
  }
  console.log(`\nDone. ${ok} card(s) generated, ${fail} failed.`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
