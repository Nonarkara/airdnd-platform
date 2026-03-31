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
 * Upload ALL photos for a set of listings to Google Drive.
 * Supports multiple photos per listing via allPhotoUrls array.
 * Mutates listings in place, adding `driveImageUrl` (first) and `drivePhotoUrls` (all).
 */
export async function uploadListingPhotosToDrive(listings) {
  const auth = getAuth();
  if (!auth || !DRIVE_FOLDER_ID) {
    console.log('Google Drive not configured — skipping photo upload.');
    return;
  }

  const photosDir = path.join(__dirname, '../public');

  for (const listing of listings) {
    // Collect all photo URLs: allPhotoUrls (BI array) + imageUrl (single legacy)
    const photoUrls = [];
    if (Array.isArray(listing.allPhotoUrls)) {
      photoUrls.push(...listing.allPhotoUrls);
    }
    if (listing.imageUrl && !photoUrls.includes(listing.imageUrl)) {
      photoUrls.push(listing.imageUrl);
    }

    // Filter to real scraped photos only (skip mockups)
    const realPhotos = photoUrls.filter((url) => url && !url.startsWith('/mockups/'));
    if (realPhotos.length === 0) continue;

    const driveUrls = [];
    const safeName = (listing.name || 'listing').replace(/[^a-zA-Z0-9ก-๙]/g, '_');

    for (let i = 0; i < realPhotos.length; i++) {
      const localPath = path.join(photosDir, realPhotos[i]);
      if (!fs.existsSync(localPath)) continue;

      const filename = `${safeName}_${i + 1}_${Date.now()}.jpg`;
      const driveUrl = await uploadImageToDrive(localPath, filename);
      if (driveUrl) {
        driveUrls.push(driveUrl);
      }
    }

    if (driveUrls.length > 0) {
      listing.driveImageUrl = driveUrls[0]; // backward compatible
      listing.drivePhotoUrls = driveUrls;   // all Drive URLs
    }
  }
}

// Expanded column headers for the Google Sheet (22 columns)
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
  'All Photo URLs',
  'All Drive URLs',
  'Source Channel',
  'Message IDs',
  'User Rating',
  'Service Tags',
  'User Feedback',
  'Raw Text',
  'Scraped At',
];

const HEADER_RANGE_END = 'V'; // Column V = 22nd column

/**
 * Get the current month's tab name (e.g., "2026-03")
 */
function getMonthlyTabName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Ensure the monthly tab exists with headers.
 * Falls back to Sheet1 if tab creation fails.
 */
async function ensureMonthlyTab(sheets) {
  const tabName = getMonthlyTabName();

  try {
    // Check if the tab already exists
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const existingTabs = spreadsheet.data.sheets.map((s) => s.properties.title);

    if (!existingTabs.includes(tabName)) {
      // Create the new monthly tab
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{
            addSheet: { properties: { title: tabName } },
          }],
        },
      });

      // Write headers to the new tab
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'${tabName}'!A1:${HEADER_RANGE_END}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [SHEET_HEADERS] },
      });

      console.log(`  Created new monthly tab: ${tabName}`);
    }

    return tabName;
  } catch (err) {
    console.warn(`  Could not create monthly tab ${tabName}: ${err.message}. Using Sheet1.`);
    // Ensure Sheet1 has headers as fallback
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `Sheet1!A1:${HEADER_RANGE_END}1`,
      });
      if (!res.data.values?.[0]?.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `Sheet1!A1:${HEADER_RANGE_END}1`,
          valueInputOption: 'RAW',
          requestBody: { values: [SHEET_HEADERS] },
        });
      }
    } catch { /* ignore */ }
    return 'Sheet1';
  }
}

/**
 * Get contact/link info from a listing.
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
 * Append listing data as rows to the Google Sheet (22 columns with BI data).
 */
export async function appendListingsToSheet(listings) {
  const auth = getAuth();
  if (!auth || !SHEET_ID) {
    console.log('Google Sheets not configured — skipping sheet export.');
    return;
  }

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const tabName = await ensureMonthlyTab(sheets);

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
        // BI columns
        (listing.allPhotoUrls || []).join(' | '),
        (listing.drivePhotoUrls || []).join(' | '),
        listing.sourceChannel || '',
        (listing.sourceMessageIds || []).join(', '),
        listing.userRating || listing.user_rating || '',
        (listing.serviceTags || listing.service_quality || []).join(', '),
        listing.userFeedbackSummary || listing.user_feedback_summary || '',
        (listing.rawText || '').slice(0, 500), // Truncate to avoid cell size limits
        listing.updatedAt || new Date().toISOString(),
      ];
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `'${tabName}'!A:${HEADER_RANGE_END}`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    console.log(`  Appended ${rows.length} row(s) to Google Sheet tab "${tabName}".`);
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
