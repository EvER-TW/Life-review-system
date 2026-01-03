import { google } from 'googleapis';
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

dotenv.config();

// 根據 key 前綴決定使用哪個工作表
// Key 格式: events_2026-W1, heatmap_2026-W1, weekly_2026-W1, etc.
// 映射關係:
// - events_* -> ReservoirEvents
// - heatmap_* -> ProductivityHeatmap
// - weekly_* -> WeeklyReview
// - status_* -> ReservoirStatus
// - life_* -> LifeCalculator
// - monthly_* -> MonthlySummary
// - 其他 -> Storage (預設)

const SHEET_MAPPING = {
    'events': 'ReservoirEvents',
    'heatmap': 'ProductivityHeatmap',
    'weekly': 'WeeklyReview',
    'status': 'ReservoirStatus',
    'life': 'LifeCalculator',
    'monthly': 'MonthlySummary',
};

function getSheetName(key) {
    const prefix = key.split('_')[0];
    return SHEET_MAPPING[prefix] || 'Storage';
}

async function getSheetsClient() {
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function ensureSheet(sheets, spreadsheetId, sheetName) {
    try {
        await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1`,
        });
    } catch (e) {
        // 建立新工作表
        try {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{ addSheet: { properties: { title: sheetName } } }]
                }
            });
        } catch (createError) {
            // 工作表可能已存在，忽略錯誤
            if (!createError.message.includes('already exists')) {
                console.error('Error creating sheet:', createError.message);
            }
        }
        // 新增標題列
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            resource: { values: [['Key', 'Value', 'UpdatedAt']] }
        });
    }
}

export async function getValue(key) {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) return null;

    const sheetName = getSheetName(key);
    const sheets = await getSheetsClient();

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:C`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return null;

        // 從最後一列往回找（取最新的資料）
        for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i][0] === key) {
                try {
                    return JSON.parse(rows[i][1]);
                } catch (jsonErr) {
                    console.error('JSON parse error for key', key, jsonErr);
                    return rows[i][1];
                }
            }
        }
        return null;

    } catch (error) {
        console.error('Error getting value from', sheetName, ':', error.message);
        if (error.message.includes('Unable to parse range')) {
            return null;
        }
        return null;
    }
}

export async function setValue(key, value) {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) return;

    const sheetName = getSheetName(key);
    const sheets = await getSheetsClient();
    await ensureSheet(sheets, spreadsheetId, sheetName);

    const timestamp = new Date().toISOString();
    const valueStr = JSON.stringify(value);

    // 新增一列資料
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:C`,
        valueInputOption: 'RAW',
        resource: { values: [[key, valueStr, timestamp]] }
    });
}
