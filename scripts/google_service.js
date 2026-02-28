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
const credentialsData = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
const { client_secret, client_id, redirect_uris } = credentialsData.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

oAuth2Client.setCredentials({
    access_token: tokenData.token, // Handles python oauthlib's token storage format
    refresh_token: tokenData.refresh_token,
    scope: typeof tokenData.scopes === 'object' ? tokenData.scopes.join(' ') : tokenData.scopes,
    token_type: 'Bearer',
    expiry_date: new Date(tokenData.expiry).getTime()
});

const drive = google.drive({ version: 'v3', auth: oAuth2Client });
const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

export async function getOrCreateFolder(folderName) {
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
    const media = { mimeType: 'image/jpeg', body: fs.createReadStream(filePath) };
    const file = await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: media,
        fields: 'id, webViewLink, webContentLink'
    });
    return file.data;
}

export async function getOrCreateSheet(sheetName) {
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
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [dataRow] }
    });
}
