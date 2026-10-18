// One-time: create a NEW Telegram session for the M3 intake (separate from the
// Render one, so no AUTH_KEY_DUPLICATED). Run in Terminal on the M3:
//   cd /Volumes/Data/AirDnD/intake/airdnd-platform && node telegram_login.mjs
// Needs TELEGRAM_API_ID / TELEGRAM_API_HASH in .env. Writes TELEGRAM_SESSION
// into .env; never prints it.
import fs from 'fs';
import readline from 'readline/promises';
import dotenv from 'dotenv';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
dotenv.config();
const id = Number(process.env.TELEGRAM_API_ID), hash = process.env.TELEGRAM_API_HASH;
if (!id || !hash) { console.error('Fill TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first.'); process.exit(1); }
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const client = new TelegramClient(new StringSession(''), id, hash, { connectionRetries: 5 });
await client.start({
  phoneNumber: () => rl.question('Phone (+66...): '),
  phoneCode: () => rl.question('Login code (sent to your Telegram app, or SMS): '),
  password: () => rl.question('2-step password (blank if none): '),
  onError: (e) => console.error(e.message),
});
const session = client.session.save();
let env = fs.readFileSync('.env', 'utf8');
env = /^TELEGRAM_SESSION=.*$/m.test(env) ? env.replace(/^TELEGRAM_SESSION=.*$/m, `TELEGRAM_SESSION=${session}`) : env + `\nTELEGRAM_SESSION=${session}\n`;
fs.writeFileSync('.env', env, { mode: 0o600 });
console.log('Saved a new session to .env. The intake starts by itself within ~15 seconds.');
await client.disconnect(); rl.close(); process.exit(0);
