import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_NOTIFY_CHAT_ID = process.env.TELEGRAM_NOTIFY_CHAT_ID;

async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_NOTIFY_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_NOTIFY_CHAT_ID, text: message, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[ALERT] Telegram notification failed:', err.message);
  }
}

async function runIntegrityCheck() {
  console.log('\n=== DATA INTEGRITY CHECK ===');
  console.log(new Date().toISOString());
  console.log('');

  const alerts = [];

  // Load all listings
  const { data: listings, error } = await supabase
    .from('companions')
    .select('id, phone, phone_normalized, canonical_key, latitude, longitude, maps_url')
    .limit(10000);

  if (error) {
    console.error('❌ Failed to fetch listings:', error.message);
    process.exit(1);
  }

  const total = listings.length;
  console.log(`Total listings: ${total}`);

  // Check 1: NULL coordinates
  const noCoords = listings.filter(r => !r.latitude || !r.longitude);
  const noCoordsPercent = Math.round((noCoords.length / total) * 100);
  const coordStatus = noCoordsPercent > 40 ? '⚠️' : '✓';
  console.log(`${coordStatus} No coordinates: ${noCoords.length} / ${total} (${noCoordsPercent}%)`);
  if (noCoordsPercent > 40) {
    alerts.push(`⚠️ ${noCoords.length} listings (${noCoordsPercent}%) have no coordinates (threshold: 40%)`);
  }

  // Check 2: phone_normalized duplicates
  const phoneNorms = listings.map(r => r.phone_normalized).filter(Boolean);
  const phoneCounts = phoneNorms.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {});
  const phoneDups = Object.entries(phoneCounts).filter(([, count]) => count > 1);
  const phoneDupStatus = phoneDups.length === 0 ? '✓' : '❌';
  console.log(`${phoneDupStatus} phone_normalized duplicates: ${phoneDups.length}`);
  if (phoneDups.length > 0) {
    alerts.push(`❌ ${phoneDups.length} duplicate phone_normalized values found — unique constraint may be violated`);
    phoneDups.slice(0, 5).forEach(([phone, count]) => console.log(`   ${phone}: ${count} entries`));
  }

  // Check 3: canonical_key duplicates
  const canonicalKeys = listings.map(r => r.canonical_key).filter(k => k && k !== '');
  const keyCounts = canonicalKeys.reduce((acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const keyDups = Object.entries(keyCounts).filter(([, count]) => count > 1);
  const keyDupStatus = keyDups.length === 0 ? '✓' : '❌';
  console.log(`${keyDupStatus} canonical_key duplicates: ${keyDups.length}`);
  if (keyDups.length > 0) {
    alerts.push(`❌ ${keyDups.length} duplicate canonical_key values found — dedup system may be failing`);
    keyDups.slice(0, 5).forEach(([key, count]) => console.log(`   ${key}: ${count} entries`));
  }

  // Check 4: listings with Maps URL but no coordinates
  const mapsNoCoords = listings.filter(r => r.maps_url && (!r.latitude || !r.longitude));
  const mapsNoCoordsStatus = mapsNoCoords.length > 10 ? '⚠️' : '✓';
  console.log(`${mapsNoCoordsStatus} Maps URL but no coords: ${mapsNoCoords.length}`);
  if (mapsNoCoords.length > 10) {
    alerts.push(`⚠️ ${mapsNoCoords.length} listings have a Maps URL but no resolved coordinates — check geo resolution`);
  }

  // Check 5: listings with no identity signal
  const noIdentity = listings.filter(r => !r.canonical_key && !r.phone_normalized);
  const noIdentityStatus = noIdentity.length > 5 ? '⚠️' : '✓';
  console.log(`${noIdentityStatus} No identity signal: ${noIdentity.length}`);
  if (noIdentity.length > 5) {
    alerts.push(`⚠️ ${noIdentity.length} listings have no canonical_key or phone_normalized — they are invisible to dedup`);
  }

  console.log('');

  // Summary
  if (alerts.length === 0) {
    console.log('✅ ALL CHECKS PASSED — database is clean');
  } else {
    console.log(`🚨 ${alerts.length} ALERT(S) FOUND:`);
    alerts.forEach(a => console.log(`   ${a}`));

    const telegramMsg = [
      '<b>🚨 Sabai Sabai Integrity Alert</b>',
      `<i>${new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })} ICT</i>`,
      '',
      alerts.join('\n'),
      '',
      `Total listings: ${total}`,
    ].join('\n');

    await sendTelegramAlert(telegramMsg);
  }

  console.log('\n=== CHECK COMPLETE ===\n');
}

runIntegrityCheck().catch(err => {
  console.error('❌ Integrity check failed:', err);
  process.exit(1);
});
