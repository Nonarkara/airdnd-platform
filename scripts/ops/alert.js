/**
 * Messages to the owner's Telegram, through the bot (TELEGRAM_BOT_TOKEN →
 * TELEGRAM_NOTIFY_CHAT_ID). Every alert is also appended to logs/alerts.jsonl,
 * so nothing is lost when Telegram is unreachable.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function sendOwnerAlert(text, { env = process.env, logDir, fetchImpl = fetch } = {}) {
  if (logDir) {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'alerts.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), text })}\n`);
  }
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_NOTIFY_CHAT_ID;
  if (!token || !chatId) return { sent: false, reason: 'TELEGRAM_BOT_TOKEN or TELEGRAM_NOTIFY_CHAT_ID missing' };
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    return { sent: res.ok, reason: res.ok ? null : `HTTP ${res.status}` };
  } catch (error) {
    return { sent: false, reason: error.message };
  }
}

/**
 * Dead-man's switch: an outside service (e.g. healthchecks.io, free) that
 * emails you when the pings stop — the one alarm that still works when the
 * Mac itself is off, asleep or offline.
 */
export async function pingHealthcheck(ok, { env = process.env, fetchImpl = fetch } = {}) {
  const url = String(env.HEALTHCHECK_URL || '').replace(/\/+$/, '');
  if (!url) return { pinged: false };
  try {
    const res = await fetchImpl(ok ? url : `${url}/fail`, { signal: AbortSignal.timeout(10_000) });
    return { pinged: res.ok };
  } catch {
    return { pinged: false };
  }
}

// npm run ops:test-alert — proves the path to your phone works.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: path.join(root, '.env'), quiet: true });
  const result = await sendOwnerAlert(`Sabai · ${os.hostname()}\nTest alert — if you can read this, alerts reach you.`, { logDir: path.join(root, 'logs') });
  console.log(result.sent ? 'Sent — check Telegram.' : `Not sent: ${result.reason}`);
  const ping = await pingHealthcheck(true);
  if (process.env.HEALTHCHECK_URL) console.log(ping.pinged ? 'Outside alarm pinged.' : 'Outside alarm NOT reached — check HEALTHCHECK_URL.');
  process.exit(result.sent ? 0 : 1);
}
