import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const CREDENTIALS_PATH = path.join(__dirname, '../google-credentials.json');
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

/**
 * Load Google service account auth.
 * Returns null if credentials file is missing (graceful skip).
 */
function getAuth() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
}

/**
 * Upload a local image file to Google Drive.
 * Returns the Drive file URL, or null on failure.
 */
export async function uploadImageToDrive(localPath, filename) {
  const auth = getAuth();
  if (!auth || !DRIVE_FOLDER_ID) {
    return null;
  }

  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.create({
      requestBody: {
        name: filename || path.basename(localPath),
        parents: [DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(localPath),
      },
      fields: 'id, webViewLink',
    });

    // Make the file viewable by anyone with the link
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    console.log(`  Uploaded to Drive: ${filename} → ${response.data.webViewLink}`);
    return response.data.webViewLink;
  } catch (err) {
    console.warn(`  Failed to upload ${filename} to Drive:`, err.message);
    return null;
  }
}

/**
 * Upload all photos for a set of listings to Google Drive.
 * Mutates listings in place, adding `driveImageUrl`.
 */
export async function uploadListingPhotosToDrive(listings) {
  const auth = getAuth();
  if (!auth || !DRIVE_FOLDER_ID) {
    console.log('Google Drive not configured — skipping photo upload.');
    return;
  }

  const photosDir = path.join(__dirname, '../public');

  for (const listing of listings) {
    if (!listing.imageUrl || listing.imageUrl.startsWith('/mockups/')) {
      continue; // Skip mockup images — only upload real scraped photos
    }

    const localPath = path.join(photosDir, listing.imageUrl);
    if (!fs.existsSync(localPath)) continue;

    const filename = `${listing.name.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}_${Date.now()}.jpg`;
    const driveUrl = await uploadImageToDrive(localPath, filename);
    if (driveUrl) {
      listing.driveImageUrl = driveUrl;
    }
  }
}

// Column headers for the Google Sheet
const SHEET_HEADERS = [
  'Name',
  'Location',
  'City',
  'Price',
  'Description',
  'Tags',
  'Hours',
  'Phone',
  'LINE Link',
  'Telegram Link',
  'Google Maps Link',
  'Image URL (local)',
  'Image URL (Drive)',
  'Scraped At',
];

/**
 * Ensure the sheet has headers in the first row.
 */
async function ensureSheetHeaders(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A1:N1',
  });

  const existingHeaders = res.data.values?.[0];
  if (!existingHeaders || existingHeaders.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1:N1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [SHEET_HEADERS],
      },
    });
    console.log('  Initialized Google Sheet headers.');
  }
}

/**
 * Get contact/link info from a listing.
 * Prefers fields extracted by Gemini, falls back to regex on description text.
 */
function extractLinks(listing) {
  const text = `${listing.description || ''} ${(listing.tags || []).join(' ')}`;

  return {
    phone: listing.phone || (text.match(/\d{2,3}[-.]?\d{3,4}[-.]?\d{4}/) || [])[0] || '',
    hours: listing.hours || (text.match(/\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/) || [])[0] || '',
    line: listing.lineUrl || (text.match(/https?:\/\/line\.me\/\S+/i) || [])[0] || '',
    telegram: listing.telegramUrl || (text.match(/https?:\/\/t\.me\/\S+/i) || [])[0] || '',
    maps: listing.mapsUrl
      || (text.match(/https?:\/\/maps\.app\.goo\.gl\/\S+/i) || [])[0]
      || (text.match(/https?:\/\/goo\.gl\/maps\/\S+/i) || [])[0]
      || '',
  };
}

/**
 * Append listing data as rows to the Google Sheet.
 */
export async function appendListingsToSheet(listings) {
  const auth = getAuth();
  if (!auth || !SHEET_ID) {
    console.log('Google Sheets not configured — skipping sheet export.');
    return;
  }

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    await ensureSheetHeaders(sheets);

    const rows = listings.map((listing) => {
      const links = extractLinks(listing);
      return [
        listing.name || '',
        listing.location || '',
        listing.city || '',
        listing.priceLabel || listing.price || '',
        listing.description || '',
        (listing.tags || []).join(', '),
        links.hours,
        links.phone,
        links.line,
        links.telegram,
        links.maps,
        listing.imageUrl || '',
        listing.driveImageUrl || '',
        listing.updatedAt || new Date().toISOString(),
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:N',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: rows,
      },
    });

    console.log(`  Appended ${rows.length} row(s) to Google Sheet.`);
  } catch (err) {
    console.warn('  Failed to write to Google Sheet:', err.message);
  }
}

/**
 * Full export: upload photos to Drive, then log all data to Sheets.
 */
export async function exportToGoogle(listings) {
  const auth = getAuth();
  if (!auth) {
    console.log(
      'Google credentials not found at google-credentials.json — skipping Google export.\n' +
      'To enable: create a service account at console.cloud.google.com, download the JSON key,\n' +
      'and save it as google-credentials.json in the project root.',
    );
    return;
  }

  console.log('Exporting to Google Drive + Sheets...');
  await uploadListingPhotosToDrive(listings);
  await appendListingsToSheet(listings);
  console.log('Google export complete.');
}
