/**
 * Posting cadence: aggregate-only stats for the public site.
 *   - new listings per day per channel (Asia/Bangkok day, by first post time)
 *   - per-parlour posting frequency (posts, active days, first/last seen, posts per week)
 * PDPA: no message text, phones, sender IDs or links leave this script — counts,
 * dates and the public listing name only (already shown on the directory).
 *
 * Usage: node scripts/build_posting_stats.js [--days 60]
 * Output: public/data/posting-stats.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { canonicalizePublicListings } from '../src/lib/listing_contract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const daysArg = process.argv.indexOf('--days');
const WINDOW_DAYS = daysArg > -1 ? Number(process.argv[daysArg + 1]) || 60 : 60;
const TZ = 'Asia/Bangkok';
const bkkDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function pageAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

export function summarize(listings, messagesByKey, now = new Date()) {
  const today = bkkDay(now);
  const cutoff = bkkDay(new Date(now.getTime() - (WINDOW_DAYS - 1) * 86400000));
  const daily = new Map();
  const parlours = [];

  for (const l of listings) {
    const firstPost = l.posted_at || l.created_at;
    const channel = l.source_channel || 'unknown';
    const firstSeenRaw = l.created_at || firstPost;
    // A listing is "new" on the day it was first captured.
    const day = firstSeenRaw ? bkkDay(firstSeenRaw) : null;
    if (day && day >= cutoff) {
      const key = `${day}|${channel}`;
      daily.set(key, (daily.get(key) || 0) + 1);
    }

    const ids = Array.isArray(l.source_message_ids) ? l.source_message_ids.map(Number) : [];
    const msgs = ids.map((id) => messagesByKey.get(`${channel}|${id}`)).filter(Boolean);
    const posts = new Set(msgs.map((m) => m.grouped_id || `m${m.telegram_message_id}`));
    const dates = msgs.map((m) => m.message_date).filter(Boolean).sort();
    const first = dates[0] || firstPost;
    const last = dates.at(-1) || l.posted_at || l.updated_at;
    const spanDays = first && last ? Math.max(1, (new Date(last) - new Date(first)) / 86400000) : 1;
    const postCount = Math.max(posts.size, l.mention_count || 1);
    parlours.push({
      id: l.id,
      name: l.name,
      channel,
      posts: postCount,
      activeDays: new Set(dates.map(bkkDay)).size || 1,
      firstSeen: first || null,
      lastSeen: last || null,
      postsPerWeek: +((postCount / spanDays) * 7).toFixed(2),
    });
  }

  const dailyRows = [...daily.entries()]
    .map(([k, count]) => { const [date, channel] = k.split('|'); return { date, channel, count }; })
    .sort((a, b) => (a.date === b.date ? b.count - a.count : a.date < b.date ? 1 : -1));

  parlours.sort((a, b) => b.posts - a.posts || b.postsPerWeek - a.postsPerWeek);
  return {
    generatedAt: now.toISOString(),
    timezone: TZ,
    windowDays: WINDOW_DAYS,
    today,
    todayNew: dailyRows.filter((r) => r.date === today).reduce((s, r) => s + r.count, 0),
    dailyNewListings: dailyRows,
    parlours,
    note: 'Aggregates only. No message text, phone numbers or sender identifiers.',
  };
}

async function main() {
  const rows = await pageAll(() => supabase.from('companions').select('*').order('created_at', { ascending: false }));
  const publicIds = new Set(canonicalizePublicListings(rows, { source: 'snapshot' }).map((l) => String(l.id)));
  const listings = rows.filter((r) => publicIds.has(String(r.id)));

  const wanted = new Map();
  for (const l of listings) for (const id of l.source_message_ids || []) {
    const ch = l.source_channel || 'unknown';
    if (!wanted.has(ch)) wanted.set(ch, new Set());
    wanted.get(ch).add(Number(id));
  }
  const messagesByKey = new Map();
  for (const [ch, idSet] of wanted) {
    const ids = [...idSet];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from('channel_messages')
        .select('telegram_message_id,message_date,grouped_id')
        .eq('channel_id', ch).in('telegram_message_id', ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
      for (const m of data) messagesByKey.set(`${ch}|${m.telegram_message_id}`, m);
    }
  }

  const out = summarize(listings, messagesByKey);
  const dir = path.join(ROOT, 'public', 'data');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'posting-stats.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ todayNew: out.todayNew, days: out.dailyNewListings.length, parlours: out.parlours.length }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
