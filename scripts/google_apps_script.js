/**
 * Sabai Sabai BI Dashboard — Google Apps Script
 *
 * SETUP:
 * 1. Open Google Sheets at sheets.google.com
 * 2. Create a new spreadsheet named "Sabai Sabai BI Dashboard"
 * 3. Go to Extensions > Apps Script
 * 4. Paste this entire file
 * 5. Click Run > setup (authorize when prompted)
 * 6. Data will auto-refresh every hour via trigger
 *
 * The script pulls data directly from your Supabase API.
 */

const SUPABASE_URL = 'https://fehdtfncbutesgadjsxp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mf3Wmwk6mMO-EoYaDxMUvA_CihTsTBF';

function supabaseFetch(table, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const options = {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact',
    },
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}

// ============ SETUP ============

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create sheets if they don't exist
  const sheetNames = ['Listings', 'Visitors', 'Daily Stats', 'Messages', 'Photo Archive'];
  for (const name of sheetNames) {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
    }
  }

  // Remove default Sheet1
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Set up hourly trigger
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshAll')
    .timeBased()
    .everyHours(1)
    .create();

  refreshAll();
  SpreadsheetApp.getUi().alert('Sabai Sabai BI Dashboard set up! Data will refresh every hour.');
}

// ============ REFRESH ALL ============

function refreshAll() {
  refreshListings();
  refreshVisitors();
  refreshDailyStats();
  refreshMessages();
  refreshPhotos();
}

// ============ LISTINGS ============

function refreshListings() {
  const data = supabaseFetch('companions', 'select=id,name,location,city,price,description,phone,hours,line_url,telegram_url,maps_url,source_channel,image_url,tags,mention_count,user_rating,service_tags,created_at,updated_at&order=updated_at.desc.nullsfirst,created_at.desc&limit=500');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Listings');
  if (!sheet) return;

  sheet.clear();

  const headers = [
    'ID', 'Name', 'City', 'Location', 'Price', 'Phone', 'Hours',
    'LINE', 'Telegram', 'Maps', 'Source Channel', 'Tags',
    'Mentions', 'User Rating', 'Service Tags', 'Description',
    'Image URL', 'Created', 'Updated'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1a1a1a')
    .setFontColor('#ffffff');

  if (data.length === 0) return;

  const rows = data.map(r => [
    r.id,
    r.name || '',
    r.city || '',
    r.location || '',
    r.price || '',
    r.phone || '',
    r.hours || '',
    r.line_url || '',
    r.telegram_url || '',
    r.maps_url || '',
    r.source_channel || '',
    (r.tags || []).join(', '),
    r.mention_count || 0,
    r.user_rating || '',
    (r.service_tags || []).join(', '),
    (r.description || '').substring(0, 500),
    r.image_url || '',
    r.created_at || '',
    r.updated_at || '',
  ]);

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 6);

  // Add metadata
  sheet.getRange(1, headers.length + 2).setValue('Last refresh:');
  sheet.getRange(1, headers.length + 3).setValue(new Date().toISOString());
  sheet.getRange(2, headers.length + 2).setValue('Total listings:');
  sheet.getRange(2, headers.length + 3).setValue(rows.length);
}

// ============ VISITORS ============

function refreshVisitors() {
  const data = supabaseFetch('page_views', 'select=id,session_id,page,event_type,country,city,language,screen_w,screen_h,referrer,user_agent,created_at&order=created_at.desc&limit=1000');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Visitors');
  if (!sheet) return;

  sheet.clear();

  const headers = [
    'ID', 'Session', 'Page', 'Event', 'Country', 'City',
    'Language', 'Screen', 'Referrer', 'User Agent', 'Timestamp'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1a1a1a')
    .setFontColor('#ffffff');

  if (data.length === 0) {
    sheet.getRange(2, 1).setValue('No visitor data yet. The page_views table will populate as users visit the site.');
    return;
  }

  const rows = data.map(r => [
    r.id,
    r.session_id || '',
    r.page || '',
    r.event_type || '',
    r.country || '',
    r.city || '',
    r.language || '',
    r.screen_w && r.screen_h ? `${r.screen_w}x${r.screen_h}` : '',
    r.referrer || '',
    (r.user_agent || '').substring(0, 100),
    r.created_at || '',
  ]);

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
}

// ============ DAILY STATS ============

function refreshDailyStats() {
  const listings = supabaseFetch('companions', 'select=id,city,source_channel,mention_count,created_at&limit=1000');
  const messages = supabaseFetch('channel_messages', 'select=id,message_type,channel_name,message_date&limit=5000');
  const photos = supabaseFetch('photo_archive', 'select=id,channel_name,created_at&limit=5000');
  const visitors = supabaseFetch('page_views', 'select=id,event_type,country,created_at&limit=5000');

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Daily Stats');
  if (!sheet) return;

  sheet.clear();

  // Summary stats
  const stats = [
    ['Sabai Sabai BI Summary', '', new Date().toISOString()],
    [''],
    ['METRIC', 'VALUE', 'DETAIL'],
    ['Total Listings', listings.length, ''],
    ['Total Messages Archived', messages.length, ''],
    ['Total Photos', photos.length, ''],
    ['Total Page Views', visitors.length, ''],
    [''],
    ['MESSAGES BY TYPE', 'COUNT', ''],
  ];

  // Message type breakdown
  const typeCounts = {};
  messages.forEach(m => { typeCounts[m.message_type] = (typeCounts[m.message_type] || 0) + 1; });
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    stats.push([`  ${type}`, count, `${(count / messages.length * 100).toFixed(1)}%`]);
  }

  stats.push(['']);
  stats.push(['MESSAGES BY CHANNEL', 'COUNT', '']);

  const channelCounts = {};
  messages.forEach(m => { const k = m.channel_name || 'unknown'; channelCounts[k] = (channelCounts[k] || 0) + 1; });
  for (const [ch, count] of Object.entries(channelCounts).sort((a, b) => b[1] - a[1])) {
    stats.push([`  ${ch}`, count, `${(count / messages.length * 100).toFixed(1)}%`]);
  }

  stats.push(['']);
  stats.push(['LISTINGS BY CITY', 'COUNT', '']);

  const cityCounts = {};
  listings.forEach(l => { const k = l.city || 'Unknown'; cityCounts[k] = (cityCounts[k] || 0) + 1; });
  for (const [city, count] of Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    stats.push([`  ${city}`, count, '']);
  }

  stats.push(['']);
  stats.push(['VISITORS BY COUNTRY', 'COUNT', '']);

  const countryCounts = {};
  visitors.forEach(v => { const k = v.country || 'Unknown'; countryCounts[k] = (countryCounts[k] || 0) + 1; });
  for (const [country, count] of Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    stats.push([`  ${country}`, count, '']);
  }

  sheet.getRange(1, 1, stats.length, 3).setValues(stats);

  // Style header
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setFontSize(14);
  sheet.getRange(3, 1, 1, 3).setFontWeight('bold').setBackground('#f0f0f0');
  sheet.setFrozenRows(3);
  sheet.autoResizeColumns(1, 3);
}

// ============ MESSAGES ============

function refreshMessages() {
  const data = supabaseFetch('channel_messages', 'select=id,telegram_message_id,channel_name,message_text,message_type,message_date,has_media&order=message_date.desc&limit=500');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages');
  if (!sheet) return;

  sheet.clear();

  const headers = ['ID', 'Msg ID', 'Channel', 'Type', 'Has Media', 'Text (preview)', 'Date'];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1a1a1a')
    .setFontColor('#ffffff');

  if (data.length === 0) return;

  const rows = data.map(r => [
    r.id,
    r.telegram_message_id || '',
    r.channel_name || '',
    r.message_type || '',
    r.has_media ? 'Yes' : '',
    (r.message_text || '').substring(0, 300),
    r.message_date || '',
  ]);

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);
}

// ============ PHOTOS ============

function refreshPhotos() {
  const data = supabaseFetch('photo_archive', 'select=id,channel_name,original_filename,stored_filename,supabase_url,local_path,file_size_bytes,media_type,message_date&order=message_date.desc&limit=500');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Photo Archive');
  if (!sheet) return;

  sheet.clear();

  const headers = ['ID', 'Channel', 'Original Filename', 'Stored Filename', 'Cloud URL', 'Local Path', 'Size (KB)', 'Type', 'Date'];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1a1a1a')
    .setFontColor('#ffffff');

  if (data.length === 0) return;

  const rows = data.map(r => [
    r.id,
    r.channel_name || '',
    r.original_filename || '(Telegram photo)',
    r.stored_filename || '',
    r.supabase_url || '',
    r.local_path || '',
    r.file_size_bytes ? Math.round(r.file_size_bytes / 1024) : '',
    r.media_type || '',
    r.message_date || '',
  ]);

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 4);
}

// ============ MENU ============

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Sabai BI')
    .addItem('Refresh All Data', 'refreshAll')
    .addItem('Refresh Listings Only', 'refreshListings')
    .addItem('Refresh Visitors Only', 'refreshVisitors')
    .addItem('Initial Setup', 'setup')
    .addToUi();
}
