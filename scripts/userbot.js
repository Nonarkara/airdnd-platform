import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error('Missing TELEGRAM_API_ID or TELEGRAM_API_HASH in .env.');
  process.exit(1);
}

async function startClient(sessionString) {
  const stringSession = new StringSession(sessionString);
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Phone number (international format e.g. +66812345678): '),
    password: async () => await input.text('Password (if 2FA enabled): '),
    phoneCode: async () => await input.text('Code received on Telegram: '),
    onError: (err) => {
      if (err.errorMessage === 'AUTH_KEY_DUPLICATED') {
        throw err;
      }
      console.error(err);
    },
  });

  return client;
}

(async () => {
  console.log('Loading interactive GramJS session...');

  let client;
  const existingSession = process.env.TELEGRAM_SESSION || '';

  try {
    client = await startClient(existingSession);
  } catch (err) {
    if (err.errorMessage === 'AUTH_KEY_DUPLICATED' || String(err).includes('AUTH_KEY_DUPLICATED')) {
      console.log('\nSession expired (AUTH_KEY_DUPLICATED). Starting fresh login...\n');
      client = await startClient('');
    } else {
      throw err;
    }
  }

  const savedSession = client.session.save();

  console.log('\n=== SUCCESS ===');
  console.log('You are logged in!\n');
  console.log('New TELEGRAM_SESSION:');
  console.log(savedSession);

  // Auto-update .env file
  const envPath = path.join(__dirname, '../.env');
  try {
    let envContent = fs.readFileSync(envPath, 'utf-8');
    if (envContent.includes('TELEGRAM_SESSION=')) {
      envContent = envContent.replace(/^TELEGRAM_SESSION=.*$/m, `TELEGRAM_SESSION=${savedSession}`);
    } else {
      envContent += `\nTELEGRAM_SESSION=${savedSession}\n`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log('\n.env file updated automatically with new session.');
  } catch (writeErr) {
    console.error('\nCould not auto-update .env:', writeErr.message);
    console.log('Please manually update TELEGRAM_SESSION in your .env file.');
  }

  // Quick connection test
  const me = await client.getMe();
  console.log(`\nLogged in as: ${me.firstName || ''} ${me.lastName || ''} (${me.phone || 'no phone'})`);

  const dialogs = await client.getDialogs({ limit: 50 });
  const channels = dialogs.filter(d => d.entity?.broadcast || d.entity?.megagroup);
  console.log(`Found ${channels.length} channels/groups in your Telegram account.`);

  await client.disconnect();
  console.log('\nDone. You can now run: npm run scrape:live');
  process.exit(0);
})();
