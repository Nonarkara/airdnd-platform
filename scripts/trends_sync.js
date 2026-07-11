/**
 * trends_sync.js — Trend intelligence scraper for Sabai Sabai
 *
 * Sources:
 *   - HN Algolia (free, no auth)
 *   - Reddit public JSON (no auth, best-effort)
 *   - Gemini synthesis (GEMINI_API_KEY in .env)
 *
 * /last30days skill integration:
 *   Run `/last30days "Thai massage market Thailand"` in Claude Code,
 *   paste the output text into a file, then:
 *     node scripts/trends_sync.js --import path/to/output.txt --category political --sentiment negative
 *
 * Usage:
 *   node scripts/trends_sync.js              # full sync, all topics
 *   node scripts/trends_sync.js --dry-run    # print without saving
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRENDS_PATH = path.join(__dirname, '..', 'public', 'trends.json');
const DRY_RUN = process.argv.includes('--dry-run');
const IMPORT_FLAG = process.argv.indexOf('--import');

// ── Topics to research ──────────────────────────────────────────────────────

const TOPICS = [
  { query: 'Thai massage market tourism economy Bangkok 2026', category: 'market' },
  { query: 'Thailand wellness industry regulation enforcement', category: 'political' },
  { query: 'Thai massage cultural identity taboo stigma discourse', category: 'cultural' },
  { query: 'massage economy Thailand labor informal sector wages', category: 'economic' },
  { query: 'Thailand sex tourism reform international perception', category: 'international' },
  { query: 'Bangkok massage market price competition grey zone', category: 'market' },
];

// ── Data sources ─────────────────────────────────────────────────────────────

async function fetchHN(query) {
  try {
    const since = Math.floor(Date.now() / 1000) - 30 * 86400; // 30 days ago
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=10`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return d.hits.map(h => ({
      platform: 'HN',
      title: h.title,
      url: h.url,
      score: h.points || 0,
      comments: h.num_comments || 0,
    }));
  } catch {
    return [];
  }
}

async function fetchReddit(query) {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=top&t=month&limit=8`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'SabaiSabai-Research/1.0' },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return d.data.children.map(p => ({
      platform: 'Reddit',
      subreddit: p.data.subreddit,
      title: p.data.title,
      url: `https://reddit.com${p.data.permalink}`,
      score: p.data.score,
      comments: p.data.num_comments,
    }));
  } catch {
    return [];
  }
}

// ── Gemini synthesis ──────────────────────────────────────────────────────────

async function synthesise(topic, posts) {
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const postSummary = posts.length
    ? posts.slice(0, 12).map(p => `[${p.platform}] "${p.title}" (${p.score} pts)`).join('\n')
    : 'No external posts found — synthesise from domain knowledge.';

  const prompt = `You are a research analyst studying the Thai massage and wellness market intelligence.

Topic query: "${topic.query}"
Category: ${topic.category}

Community posts found:
${postSummary}

Produce a market intelligence entry in JSON matching this exact schema:
{
  "title": "Sharp, specific headline (max 80 chars, present tense)",
  "sentiment": "positive|negative|speculative|mixed|neutral",
  "confidence": 0-100,
  "summary": "2-3 sentences of analysis grounded in the Thai massage market context. Be specific. Reference Bangkok, Telegram channels, pricing, operators, enforcement, or cultural dynamics as appropriate.",
  "patterns": ["Specific observable pattern 1", "Specific observable pattern 2", "Specific observable pattern 3"],
  "tags": ["tag1", "tag2", "tag3"]
}

Be analytical, not generic. Draw on the fact that this market operates through Telegram channels, has grey-zone regulatory status, serves a mix of international tourists and local clients, and sits at the intersection of cultural identity, informal labor, and tourism economy.
Respond with only valid JSON. No markdown fences.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  try {
    return JSON.parse(text);
  } catch {
    // Strip possible code fences
    const clean = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(clean);
  }
}

// ── Import /last30days skill output ──────────────────────────────────────────

function importLast30days(filePath, category, sentiment) {
  const text = fs.readFileSync(filePath, 'utf8');
  // Strip the badge line (first line starting with 🌐)
  const lines = text.split('\n').filter(l => !l.startsWith('🌐'));
  const body = lines.join('\n').trim();

  // Extract "What I learned:" section
  const learnedMatch = body.match(/What I learned:\n([\s\S]*?)(?:KEY PATTERNS|$)/i);
  const summary = learnedMatch
    ? learnedMatch[1].trim().slice(0, 500)
    : body.slice(0, 500);

  // Extract key patterns numbered list
  const patternsMatch = body.match(/KEY PATTERNS[^:]*:\n([\s\S]*?)(?:\n\n|$)/i);
  const patterns = patternsMatch
    ? patternsMatch[1].split('\n').filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*\*?\*?/, '').replace(/\*\*$/, '').trim())
    : [];

  return {
    title: path.basename(filePath, '.txt').replace(/-/g, ' '),
    category: category || 'market',
    sentiment: sentiment || 'mixed',
    confidence: 70,
    summary: summary.replace(/\*\*/g, '').replace(/\n/g, ' ').trim(),
    patterns: patterns.slice(0, 4),
    tags: [category || 'market', 'last30days'],
    sources: [{ platform: 'last30days', posts: 0, engagement: 0 }],
    source: 'last30days',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  // ── Import mode ────────────────────────────────────────────────────────────
  if (IMPORT_FLAG !== -1) {
    const importPath = process.argv[IMPORT_FLAG + 1];
    const catFlag = process.argv.indexOf('--category');
    const sentFlag = process.argv.indexOf('--sentiment');
    const cat = catFlag !== -1 ? process.argv[catFlag + 1] : 'market';
    const sent = sentFlag !== -1 ? process.argv[sentFlag + 1] : 'mixed';

    if (!importPath || !fs.existsSync(importPath)) {
      console.error('--import requires a valid file path');
      process.exit(1);
    }

    const entry = importLast30days(importPath, cat, sent);
    const existing = JSON.parse(fs.readFileSync(TRENDS_PATH, 'utf8'));
    const id = `t${Date.now()}`;
    existing.trends.unshift({ id, date: new Date().toISOString().slice(0, 10), ...entry });
    existing.generatedAt = new Date().toISOString();
    if (!DRY_RUN) fs.writeFileSync(TRENDS_PATH, JSON.stringify(existing, null, 2));
    console.log(`Imported: "${entry.title}" → ${TRENDS_PATH}`);
    return;
  }

  // ── Full sync mode ─────────────────────────────────────────────────────────
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY required. Add to .env');
    process.exit(1);
  }

  const newTrends = [];
  for (const topic of TOPICS) {
    console.log(`→ ${topic.category}: ${topic.query.slice(0, 50)}…`);
    const [hnPosts, redditPosts] = await Promise.all([
      fetchHN(topic.query),
      fetchReddit(topic.query),
    ]);
    const posts = [...hnPosts, ...redditPosts];
    console.log(`  sources: HN=${hnPosts.length} Reddit=${redditPosts.length}`);

    let synthesis;
    try {
      synthesis = await synthesise(topic, posts);
    } catch (err) {
      console.error(`  synthesis failed: ${err.message}`);
      continue;
    }

    const totalEngagement = posts.reduce((s, p) => s + (p.score || 0), 0);
    const platformCounts = {};
    for (const p of posts) platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
    const sources = Object.entries(platformCounts).map(([platform, count]) => ({
      platform,
      posts: count,
      engagement: posts.filter(p => p.platform === platform).reduce((s, p) => s + (p.score || 0), 0),
    }));
    if (!sources.length) sources.push({ platform: 'Gemini', posts: 0, engagement: 0 });

    newTrends.push({
      id: `t${Date.now()}_${topic.category}`,
      query: topic.query,
      category: topic.category,
      date: new Date().toISOString().slice(0, 10),
      sources,
      source: 'gemini',
      ...synthesis,
    });

    // Avoid hammering Gemini rate limit
    await new Promise(r => setTimeout(r, 1500));
  }

  if (DRY_RUN) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), trends: newTrends }, null, 2));
    return;
  }

  // Merge: keep existing trends that aren't being replaced (by category match),
  // prepend new ones, cap at 30 total
  const existing = JSON.parse(fs.readFileSync(TRENDS_PATH, 'utf8'));
  const replacedCategories = new Set(newTrends.map(t => t.category));
  const kept = existing.trends.filter(t => !replacedCategories.has(t.category));
  const merged = [...newTrends, ...kept].slice(0, 30);

  const output = {
    generatedAt: new Date().toISOString(),
    version: '1.0',
    trends: merged,
  };

  fs.writeFileSync(TRENDS_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${merged.length} trends → ${TRENDS_PATH}`);
  console.log('Next: npm run build && npx wrangler pages deploy dist --project-name sabaisabai-airdnd');
}

run().catch(err => { console.error(err); process.exit(1); });
