/* global process */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrCreateFolder, getOrCreateSheet } from './google_service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');

async function init() {
    console.log('Initializing Google Drive Folder and Google Sheet...');
    try {
        const folderId = await getOrCreateFolder('AirDnD Captures');
        console.log(`✅ Drive Folder ID: ${folderId}`);
        console.log(`View Folder: https://drive.google.com/drive/folders/${folderId}`);

        const sheetId = await getOrCreateSheet('AirDnD Analytics');
        console.log(`✅ Google Sheet ID: ${sheetId}`);
        console.log(`View Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);

        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (!envContent.includes('GOOGLE_DRIVE_FOLDER_ID')) {
            envContent += `\nGOOGLE_DRIVE_FOLDER_ID=${folderId}\n`;
        } else {
            envContent = envContent.replace(/GOOGLE_DRIVE_FOLDER_ID=.*/, `GOOGLE_DRIVE_FOLDER_ID=${folderId}`);
        }
        if (!envContent.includes('GOOGLE_SHEET_ID')) {
            envContent += `GOOGLE_SHEET_ID=${sheetId}\n`;
        } else {
            envContent = envContent.replace(/GOOGLE_SHEET_ID=.*/, `GOOGLE_SHEET_ID=${sheetId}`);
        }
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Saved IDs to .env');
    } catch (e) {
        console.error('Failed to initialize Google Workspace:', e);
    }
}

init();
