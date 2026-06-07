import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

export async function getSheetData(range: string): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return (res.data.values as string[][]) || [];
}

export async function appendRow(sheet: string, values: (string | number | null)[]): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

export async function updateRow(sheet: string, rowIndex: number, values: (string | number | null)[]): Promise<void> {
  const sheets = await getSheetsClient();
  const col = String.fromCharCode(64 + values.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A${rowIndex}:${col}${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

export async function deleteRow(sheet: string, rowIndex: number): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetObj = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheet
  );
  if (!sheetObj?.properties?.sheetId) throw new Error(`シート "${sheet}" が見つかりません`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetObj.properties.sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}

export async function ensureSheets(): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

  const required = [
    { title: "settings", headers: ["key", "value"] },
    { title: "parents", headers: ["id", "playerName", "furigana", "jerseyNumber", "group", "carCapacity"] },
    { title: "matches", headers: ["id", "date", "matchType", "matchName", "opponent", "venue", "address", "distanceKm", "carCount", "needsSettlement"] },
    { title: "drivers", headers: ["matchId", "parentName"] },
    { title: "coach_expenses", headers: ["id", "date", "description", "amount", "claimed"] },
    { title: "memos", headers: ["id", "content", "createdAt", "updatedAt"] },
    { title: "links", headers: ["id", "name", "url"] },
    { title: "equipment", headers: ["id", "name", "quantity", "memo", "parentId", "order", "imageUrl"] },
    { title: "fees", headers: ["id", "name", "category", "amount", "date", "description"] },
    { title: "fee_payments", headers: ["feeId", "parentId", "paid", "paidAt"] },
    { title: "export_history", headers: ["id", "exportType", "exportedAt", "dateFrom", "dateTo", "matchCount"] },
  ];

  const toCreate = required.filter((r) => !existing.includes(r.title));

  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: toCreate.map((r) => ({
          addSheet: { properties: { title: r.title } },
        })),
      },
    });
    for (const sheet of toCreate) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheet.title}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [sheet.headers] },
      });
    }
  }

  // settingsのデフォルト値
  const settingsData = await getSheetData("settings!A:B");
  const keys = settingsData.slice(1).map((r) => r[0]);
  const defaults: [string, string][] = [
    ["teamName", "トラヴェッソ 5年生"],
    ["gasPricePerKm", "16"],
    ["accountant", "矢野諒"],
    ["leagueName", "西三河リーグ"],
  ];
  for (const [key, val] of defaults) {
    if (!keys.includes(key)) {
      await appendRow("settings", [key, val]);
    }
  }
}
