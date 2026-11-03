/** Bound to the classroom spreadsheet. Public read-only session lookup.
 * Sheet: Sessions
 * Class | Session_Code | Lesson | Required_Missions | Bonus_Missions | Active
 * No student identity or completion data is collected by this implementation.
 */
const SESSION_SHEET = 'Sessions';
const DEFAULT_LESSONS = {
  1: { title: 'print 與變量', required: ['c1m1','c1m3','c1m5'], bonus:['c1b1'] },
  2: { title: '數據類型與運算', required: ['c2m1','c2m2','c2m3'], bonus:['c2b1'] },
  3: { title: 'input、轉換與 if / else', required: ['c3m1','c3m2','c3m3'], bonus:['c3b1'] },
  4: { title: 'while 迴圈', required: ['c4m1','c4m2','c4m3'], bonus:['c4b1'] },
  5: { title: '整合挑戰', required: ['c5m2','c5m4','c5m5'], bonus:[] }
};
const VALID_MISSIONS = {
  1:['c1m1','c1m2','c1m3','c1m4','c1m5','c1b1'],
  2:['c2m1','c2m2','c2m3','c2b1'],
  3:['c3m1','c3m2','c3m3','c3b1'],
  4:['c4m1','c4m2','c4m3','c4b1'],
  5:['c5m1','c5m2','c5m3','c5m4','c5m5']
};
function sessionList(value, fallback) {
  return String(value || '').trim() ? String(value).split(',').map(x => x.trim()).filter(Boolean) : fallback.slice();
}
function lookupSession(rows, code) {
  const fail = {success:false, active:false};
  if (!/^[A-Z0-9_-]{4,40}$/.test(code || '') || !rows.length) return fail;
  const headers = rows[0].map(x => String(x).trim());
  const columns = ['Class','Session_Code','Lesson','Required_Missions','Bonus_Missions','Active'];
  if (columns.some(x => !headers.includes(x)) || new Set(headers).size !== headers.length) return fail;
  const get = (row,name) => row[headers.indexOf(name)];
  const matches = rows.slice(1).filter(row => String(get(row,'Session_Code')).trim() === code);
  if (matches.length !== 1) return fail;
  const row = matches[0];
  if (!(get(row,'Active') === true || String(get(row,'Active')).trim().toUpperCase() === 'TRUE')) return fail;
  const lesson = Number(get(row,'Lesson')), plan = DEFAULT_LESSONS[lesson];
  if (!Number.isInteger(lesson) || !plan) return fail;
  const required = sessionList(get(row,'Required_Missions'),plan.required);
  // Blank Bonus_Missions means no bonus; use explicit IDs to enable one.
  const bonus = sessionList(get(row,'Bonus_Missions'),[]);
  const ids = required.concat(bonus);
  if (!required.length || new Set(ids).size !== ids.length || ids.some(x => !VALID_MISSIONS[lesson].includes(x))) return fail;
  return {success:true,active:true,lesson,title:plan.title,required,bonus};
}
// Run once from the spreadsheet-bound editor before deployment. A deployed
// web app does not reliably have an "active" spreadsheet context.
function configureClassroom() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || !spreadsheet.getSheetByName(SESSION_SHEET)) throw new Error('請先建立 Sessions 工作表，再從綁定的指令碼編輯器執行。');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
}
function doGet(e) {
  let result = {success:false,active:false};
  try {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    const sheet = id ? SpreadsheetApp.openById(id).getSheetByName(SESSION_SHEET) : null;
    if (sheet) result = lookupSession(sheet.getDataRange().getValues(),String(e && e.parameter && e.parameter.session || ''));
  } catch (error) {
    // Fail closed. Do not expose spreadsheet details to the public endpoint.
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
