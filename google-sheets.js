import { google } from 'googleapis';
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

dotenv.config();

// KV Store implementation using Google Sheets
// Sheet Name: "Storage"
// Columns: Key, Value, UpdatedAt

async function getSheetsClient() {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function ensureStorageSheet(sheets, spreadsheetId) {
    try {
        await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Storage!A1',
        });
    } catch (e) {
        // Create sheet
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{ addSheet: { properties: { title: 'Storage' } } }]
            }
        });
        // Add headers
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Storage!A1',
            valueInputOption: 'RAW',
            resource: { values: [['Key', 'Value', 'UpdatedAt']] }
        });
    }
}

export async function getValue(key) {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) return null;

    const sheets = await getSheetsClient();

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Storage!A:C',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return null;

        // Find latest row with this key
        // Iterate backwards
        for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i][0] === key) {
                try {
                    return JSON.parse(rows[i][1]);
                } catch (jsonErr) {
                    console.error('JSON parse error for key', key, jsonErr);
                    return rows[i][1]; // return raw if parse fails
                }
            }
        }
        return null; // Not found

    } catch (error) {
        console.error('Error getting value:', error.message);
        if (error.message.includes('Unable to parse range')) {
            // Sheet missing?
            return null;
        }
        return null;
    }
}

export async function setValue(key, value) {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) return;

    const sheets = await getSheetsClient();
    await ensureStorageSheet(sheets, spreadsheetId);

    const timestamp = new Date().toISOString();
    const valueStr = JSON.stringify(value);

    // Append row
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Storage!A:C',
        valueInputOption: 'RAW',
        resource: { values: [[key, valueStr, timestamp]] }
    });
}
