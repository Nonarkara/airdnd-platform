import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const TOKEN_PATH = path.join(__dirname, '../token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../google-credentials.json');
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

/**
 * Load Google auth — prefers OAuth (token.json) for user-owned Drive/Sheets,
 * falls back to service account (google-credentials.json).
 */
function getAuth() {
  // Try OAuth first (user's own Google account — has Drive quota + Sheets access)
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      if (token.refresh_token && token.client_id && token.client_secret) {
        const oauth2 = new google.auth.OAuth2(token.client_id, token.client_secret);
        oauth2.setCredentials({
          refresh_token: token.refresh_token,
          access_token: token.token,
        });
        return oauth2;
      }
    } catch {
      // Fall through to service account
    }
  }

  // Fallback: service account
  if (fs.existsSync(CREDENTIALS_PATH)) {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });
  }

  return null;
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

const LISTINGS_TAB = 'Listings';
const VISITORS_TAB = 'Visitors';

const VISITOR_HEADERS = [
  'ID',
  'Session',
  'Page',
  'Event',
  'IP Address',
  'Country',
  'Country Code',
  'Region',
  'City',
  'Latitude',
  'Longitude',
  'Timezone',
  'Org / ISP',
  'Language',
  'Screen',
  'Referrer',
  'User Agent',
  'Timestamp',
];

const VISITOR_RANGE_END = 'R';

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function ensureSheetTab(sheets, tabName, headers, rangeEnd) {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: 'sheets.properties.title',
  });
  const tabs = spreadsheet.data.sheets.map((s) => s.properties.title);

  if (!tabs.includes(tabName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
  }

  const headerCheck = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${tabName}'!A1:A1`,
  });
  if (!headerCheck.data.values?.[0]?.[0]) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${tabName}'!A1:${rangeEnd}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
    console.log(`  Initialized ${tabName} tab headers.`);
  }
}

/**
 * Ensure the Listings tab exists with headers.
 */
async function ensureListingsTab(sheets) {
  try {
    await ensureSheetTab(sheets, LISTINGS_TAB, SHEET_HEADERS, HEADER_RANGE_END);
  } catch (err) {
    console.warn('  Listings tab setup error:', err.message);
  }
}

async function ensureVisitorsTab(sheets) {
  try {
    await ensureSheetTab(sheets, VISITORS_TAB, VISITOR_HEADERS, VISITOR_RANGE_END);
  } catch (err) {
    console.warn('  Visitors tab setup error:', err.message);
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
    await ensureListingsTab(sheets);

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
      range: `'${LISTINGS_TAB}'!A:${HEADER_RANGE_END}`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    console.log(`  Appended ${rows.length} row(s) to Google Sheet.`);
  } catch (err) {
    console.warn('  Failed to write to Google Sheet:', err.message);
  }
}

/**
 * Refresh the Visitors tab from Supabase page_views.
 * Uses a service role key when available so RLS can stay locked down.
 */
export async function syncVisitorLogsToSheet({ limit = 1000 } = {}) {
  const auth = getAuth();
  const supabase = getSupabaseAdmin();

  if (!auth || !SHEET_ID) {
    console.log('Google Sheets not configured — skipping visitor export.');
    return;
  }

  if (!supabase) {
    console.log('Supabase credentials not configured — skipping visitor export.');
    return;
  }

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    await ensureVisitorsTab(sheets);

    const { data, error } = await supabase
      .from('page_views')
      .select('id,session_id,page,event_type,ip_address,country,country_code,region,city,latitude,longitude,timezone,org,language,screen_w,screen_h,referrer,user_agent,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('  Failed to read visitor logs from Supabase:', error.message);
      return;
    }

    const rows = (data || []).map((row) => [
      row.id || '',
      row.session_id || '',
      row.page || '',
      row.event_type || '',
      row.ip_address || '',
      row.country || '',
      row.country_code || '',
      row.region || '',
      row.city || '',
      row.latitude || '',
      row.longitude || '',
      row.timezone || '',
      row.org || '',
      row.language || '',
      row.screen_w && row.screen_h ? `${row.screen_w}x${row.screen_h}` : '',
      row.referrer || '',
      (row.user_agent || '').slice(0, 180),
      row.created_at || '',
    ]);

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `'${VISITORS_TAB}'!A2:${VISITOR_RANGE_END}`,
    });

    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'${VISITORS_TAB}'!A2:${VISITOR_RANGE_END}${rows.length + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: rows },
      });
    }

    console.log(`  Synced ${rows.length} visitor log row(s) to Google Sheet.`);
  } catch (err) {
    console.warn('  Failed to sync visitor logs to Google Sheet:', err.message);
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
  await syncVisitorLogsToSheet();
  console.log('Google export complete.');
}
