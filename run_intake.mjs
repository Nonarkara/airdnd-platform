// launchd entry for org.nonarkara.airdnd-intake.
// Waits until telegram_login.mjs has written TELEGRAM_SESSION into .env, then
// runs the Telegram intake. Exits with the scraper's code so KeepAlive restarts it.
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const ENV = new URL('./.env', import.meta.url);
let warned = false;
const hasSession = () => { try { return /^TELEGRAM_SESSION=\S{20,}/m.test(fs.readFileSync(ENV, 'utf8')); } catch (e) { if (!warned) { warned = true; console.log(`cannot read .env: ${e.message}`); } return false; } };
const ts = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' });
if (!hasSession()) {
  console.log(`[${ts()}] waiting for TELEGRAM_SESSION (run: node telegram_login.mjs)`);
  while (!hasSession()) await new Promise((r) => setTimeout(r, 15_000));
}
console.log(`[${ts()}] session found — starting intake`);
const child = spawn(process.execPath, ['scripts/telegram_scraper.js', '--watch'], { stdio: 'inherit' });
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => child.kill(sig));
child.on('exit', (code, signal) => { console.log(`[${ts()}] intake exited code=${code} signal=${signal}`); process.exit(code ?? 1); });
