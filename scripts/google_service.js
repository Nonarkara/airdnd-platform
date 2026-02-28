/* global process, __dirname */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const credentialsPath = path.join(__dirname, '../credentials.json');
const tokenPath = path.join(__dirname, '../token.json');

// Initialize Google OAuth2 Client
let oAuth2Client = null;
let drive = null;
let sheets = null;

try {
    if (fs.existsSync(credentialsPath) && fs.existsSync(tokenPath)) {
        const credentialsData = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

        const { client_secret, client_id, redirect_uris } = credentialsData.installed || credentialsData.web || {};

        if (client_id && client_secret) {
            oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris ? redirect_uris[0] : 'urn:ietf:wg:oauth:2.0:oob');

            oAuth2Client.setCredentials({
                access_token: tokenData.token || tokenData.access_token, // Handles different token storage formats
                refresh_token: tokenData.refresh_token,
                scope: typeof tokenData.scopes === 'object' ? tokenData.scopes.join(' ') : tokenData.scopes,
                token_type: 'Bearer',
                expiry_date: tokenData.expiry ? new Date(tokenData.expiry).getTime() : tokenData.expiry_date
            });

            drive = google.drive({ version: 'v3', auth: oAuth2Client });
            sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
            console.log("✅ Google Workspace API successfully initialized.");
        }
    } else {
        console.warn("⚠️ Google Workspace credentials.json or token.json missing. Google API integration will be disabled.");
    }
} catch (error) {
    console.error("❌ Failed to initialize Google Workspace API:", error.message);
}

export async function getOrCreateFolder(folderName) {
    if (!drive) return null;
    const res = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
        fields: 'files(id, name)',
    });
    if (res.data.files && res.data.files.length > 0) {
        return res.data.files[0].id;
    }
    const folder = await drive.files.create({
        requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id'
    });
    return folder.data.id;
}

export async function uploadPhoto(filePath, folderId, fileName) {
    if (!drive) return null;
    const media = { mimeType: 'image/jpeg', body: fs.createReadStream(filePath) };
    const file = await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: media,
        fields: 'id, webViewLink, webContentLink'
    });
    return file.data;
}

export async function getOrCreateSheet(sheetName) {
    if (!sheets) return null;
    const res = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and trashed=false`,
        fields: 'files(id, name)',
    });
    if (res.data.files && res.data.files.length > 0) {
        return res.data.files[0].id;
    }
    const spreadsheet = await sheets.spreadsheets.create({
        requestBody: { properties: { title: sheetName } },
        fields: 'spreadsheetId'
    });
    const spreadsheetId = spreadsheet.data.spreadsheetId;

    // Format headers
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:G1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Timestamp', 'Name', 'Age', 'Location', 'Price', 'Rating', 'Tags']] }
    });
    return spreadsheetId;
}

export async function appendToSheet(spreadsheetId, dataRow) {
    if (!sheets) return;
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [dataRow] }
    });
}
