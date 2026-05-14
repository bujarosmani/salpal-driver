// SalPal Driver — Google Apps Script Backend v3
// Replace your existing script with this, save, and redeploy as NEW VERSION

const SHEET_ID = "1vh8a4nIUdwvGrO5ys0by2935-q6D174pRGJNBX_iRjg";
const SHEET_NAME = "data";

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["key", "value", "updated_at"]);
  }
  return sheet;
}

// Handle all requests - both GET and POST with CORS headers
function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    if (action === "ping") result = { ok: true };
    else if (action === "load") result = loadData();
    else if (action === "save") {
      const raw = e.parameter.data;
      const data = JSON.parse(decodeURIComponent(raw));
      result = saveData(data);
    } else {
      result = { error: "Unknown action" };
    }
  } catch (err) {
    result = { error: err.message };
  }
  return buildResponse(result);
}

function doPost(e) {
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === "save") result = saveData(body.data);
    else if (body.action === "load") result = loadData();
    else result = { error: "Unknown action" };
  } catch (err) {
    result = { error: err.message };
  }
  return buildResponse(result);
}

function buildResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function loadData() {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { data: null };
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === "state") {
      try { return { data: JSON.parse(rows[i][1]) }; }
      catch (e) { return { data: null }; }
    }
  }
  return { data: null };
}

function saveData(data) {
  const sheet = getSheet();
  const now = new Date().toISOString();
  const json = JSON.stringify(data);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === "state") {
      sheet.getRange(i + 1, 2).setValue(json);
      sheet.getRange(i + 1, 3).setValue(now);
      return { ok: true, updated_at: now };
    }
  }
  sheet.appendRow(["state", json, now]);
  return { ok: true, updated_at: now };
}
