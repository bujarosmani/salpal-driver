// SalPal Driver — Google Apps Script Backend v4
// Replace your existing script with this, save, and redeploy as NEW VERSION

const SHEET_ID = "1vh8a4nIUdwvGrO5ys0by2935-q6D174pRGJNBX_iRjg";

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getDataSheet(ss) {
  return getOrCreateSheet(ss, "data", ["key", "value", "updated_at"]);
}

function doGet(e) {
  let result;
  try {
    const action = e.parameter.action;
    if (action === "ping") result = { ok: true };
    else if (action === "load") result = loadData();
    else if (action === "save") {
      const raw = e.parameter.data;
      const data = JSON.parse(decodeURIComponent(raw));
      result = saveData(data);
    } else result = { error: "Unknown action" };
  } catch (err) { result = { error: err.message }; }
  return buildResponse(result);
}

function doPost(e) {
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === "save") result = saveData(body.data);
    else if (body.action === "load") result = loadData();
    else result = { error: "Unknown action" };
  } catch (err) { result = { error: err.message }; }
  return buildResponse(result);
}

function buildResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function loadData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getDataSheet(ss);
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
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const now = new Date().toISOString();
  const json = JSON.stringify(data);

  // Save raw JSON blob
  const dataSheet = getDataSheet(ss);
  const rows = dataSheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === "state") {
      dataSheet.getRange(i + 1, 2).setValue(json);
      dataSheet.getRange(i + 1, 3).setValue(now);
      found = true;
      break;
    }
  }
  if (!found) dataSheet.appendRow(["state", json, now]);

  // Write readable sheets
  try { writeTasksSheet(ss, data, now); } catch(e) {}
  try { writeUsersSheet(ss, data); } catch(e) {}
  try { writeCompaniesSheet(ss, data); } catch(e) {}

  return { ok: true, updated_at: now };
}

function writeTasksSheet(ss, data, now) {
  const headers = ["AWB", "Order Ref", "Type", "Status", "Company", "City", "Postcode", "Delivery Date", "Time From", "Time To", "Qty", "Driver", "Notes", "Created At", "Updated At"];
  let sheet = ss.getSheetByName("Tasks");
  if (!sheet) {
    sheet = ss.insertSheet("Tasks");
    sheet.setFrozenRows(1);
  }
  sheet.clearContents();
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d9ead3");

  const drivers = {};
  (data.users || []).forEach(u => drivers[u.id] = `${u.firstName} ${u.lastName}`);

  const rows = (data.tasks || []).map(t => [
    t.awb || "",
    t.orderReference || "",
    t.type || "",
    t.status || "",
    t.companyName || "",
    t.city || "",
    t.postcode || "",
    t.deliveryDate || "",
    t.deliveryTimeFrom || "",
    t.deliveryTimeTo || "",
    t.qty || 0,
    t.driverId ? (drivers[t.driverId] || "Unknown") : "Unassigned",
    t.driverNotes || "",
    t.createdAt ? new Date(t.createdAt).toLocaleString("en-GB") : "",
    t.updatedAt ? new Date(t.updatedAt).toLocaleString("en-GB") : "",
  ]);

  if (rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  // Color rows by status
  rows.forEach((row, i) => {
    const status = row[3];
    let color = "#ffffff";
    if (status === "Completed") color = "#d9ead3";
    else if (status === "In Progress") color = "#cfe2f3";
    else if (status === "Open") color = "#fff2cc";
    sheet.getRange(i + 2, 1, 1, headers.length).setBackground(color);
  });

  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
}

function writeUsersSheet(ss, data) {
  const headers = ["Name", "Username", "Role"];
  let sheet = ss.getSheetByName("Users");
  if (!sheet) {
    sheet = ss.insertSheet("Users");
    sheet.setFrozenRows(1);
  }
  sheet.clearContents();
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d9ead3");

  const rows = (data.users || []).map(u => [
    `${u.firstName} ${u.lastName}`,
    u.username || "",
    u.role || "",
  ]);

  if (rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.autoResizeColumns(1, headers.length);
}

function writeCompaniesSheet(ss, data) {
  const headers = ["Company Name", "Address", "City", "Postcode"];
  let sheet = ss.getSheetByName("Companies");
  if (!sheet) {
    sheet = ss.insertSheet("Companies");
    sheet.setFrozenRows(1);
  }
  sheet.clearContents();
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d9ead3");

  const rows = (data.companies || []).map(c => [
    c.name || "",
    c.address || "",
    c.city || "",
    c.postcode || "",
  ]);

  if (rows.length > 0) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.autoResizeColumns(1, headers.length);
}
