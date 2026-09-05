/**
 * Paste this into Extensions → Apps Script for your private Google Sheet.
 * Then Deploy → New deployment → Web app:
 *   - Execute as: Me
 *   - Who has access: Anyone
 * (The sheet itself stays private; only this append endpoint is callable,
 *  and only with VISIT_LOG_SECRET.)
 *
 * Set EXPECTED_SECRET to the same value as Vercel env VISIT_LOG_SECRET.
 * Put the web app URL in Vercel env VISIT_SHEETS_WEBHOOK.
 */

const EXPECTED_SECRET = "REPLACE_WITH_SAME_SECRET_AS_VERCEL";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!data || data.secret !== EXPECTED_SECRET) {
      return ContentService.createTextOutput("unauthorized");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Visits");
    if (!sheet) {
      sheet = ss.insertSheet("Visits");
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "timestamp",
        "ip",
        "country",
        "state",
        "city",
        "path",
        "referrer",
        "userAgent",
        "language",
      ]);
    }

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.ip || "",
      data.country || "",
      data.state || "",
      data.city || "",
      data.path || "",
      data.referrer || "",
      data.userAgent || "",
      data.language || "",
    ]);

    return ContentService.createTextOutput("ok");
  } catch (err) {
    return ContentService.createTextOutput("error");
  }
}
