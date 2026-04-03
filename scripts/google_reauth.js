/**
 * Re-authenticate Google OAuth for Drive + Sheets access.
 * Run: node scripts/google_reauth.js
 * Opens a browser, you sign in, paste the code back.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credPath = path.join(__dirname, '../credentials.json');
const tokenPath = path.join(__dirname, '../token.json');

if (!fs.existsSync(credPath)) {
  console.error('Missing credentials.json. Download from Google Cloud Console.');
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credPath));
const { client_id, client_secret } = credentials.installed || credentials.web || {};

if (!client_id || !client_secret) {
  console.error('Invalid credentials.json format.');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3847';
const oauth2 = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
  ],
  prompt: 'consent',
});

console.log('\n=== Google Re-Authentication ===\n');
console.log('Opening browser for Google sign-in...\n');

// Start a local server to catch the redirect
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3847');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('No authorization code received.');
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);

    // Save token in a format compatible with google_export.js
    const tokenData = {
      token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_uri: 'https://oauth2.googleapis.com/token',
      client_id,
      client_secret,
      scopes: tokens.scope,
      expiry: new Date(tokens.expiry_date).toISOString(),
    };

    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
    console.log('\nToken saved to token.json');
    console.log('Expires:', tokenData.expiry);

    // Quick test
    oauth2.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const about = await drive.about.get({ fields: 'user' });
    console.log('Authenticated as:', about.data.user.displayName, '(' + about.data.user.emailAddress + ')');

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Sabai Sabai — Google Connected!</h1><p>You can close this tab. Token saved.</p>');
  } catch (err) {
    console.error('Token exchange failed:', err.message);
    res.writeHead(500);
    res.end('Authentication failed: ' + err.message);
  }

  setTimeout(() => {
    server.close();
    process.exit(0);
  }, 1000);
});

server.listen(3847, () => {
  console.log('Waiting for Google redirect on http://localhost:3847...');
  // Try to open browser
  import('child_process').then(cp => {
    cp.exec(`open "${authUrl}"`);
  });
});
