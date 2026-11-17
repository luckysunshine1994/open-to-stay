/**
 * @OnlyCurrentDoc
 */
// Open to Stay — "Wall of places" backend.
// Bound to the Google Sheet "Open to Stay - Wall of places" (Extensions > Apps Script).
// @OnlyCurrentDoc above means this script can only ever open THIS one spreadsheet.
// To remove a post: delete its row in the sheet, or type x in the Hide column.

var MAX_CHARS = 140;           // per box (about 20 words)
var MAX_POSTS_PER_10_MIN = 30; // simple flood protection for the whole wall
var BLOCKED = ['nigger','nigga','paki','fuck','cunt','go home','send them back','invaders','kill','rape']; // edit freely

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('Wall') || ss.getSheets()[0];
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(s) {
  s = String(s || '').replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.slice(0, MAX_CHARS);
}

function doGet() {
  var rows = sheet_().getDataRange().getValues().slice(1);
  var out = [];
  for (var i = rows.length - 1; i >= 0 && out.length < 300; i--) {
    var r = rows[i];
    if (String(r[3]).trim() !== '' || (!r[1] && !r[2])) continue;
    out.push({ here: String(r[1]), before: String(r[2]), t: r[0] instanceof Date ? r[0].toISOString() : '' });
  }
  return json_({ ok: true, posts: out });
}

function doPost(e) {
  var data = {};
  try { data = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad request' }); }
  if (data.website) return json_({ ok: true }); // honeypot field: bots fill it, people don't
  var here = clean_(data.here), before = clean_(data.before);
  if (!here) return json_({ ok: false, error: 'Please write a place.' });
  var lower = (here + ' ' + before).toLowerCase();
  for (var i = 0; i < BLOCKED.length; i++) {
    if (new RegExp('\\b' + BLOCKED[i] + '\\b').test(lower)) return json_({ ok: false, error: 'This message could not be posted.' });
  }
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('count') || 0);
  if (n >= MAX_POSTS_PER_10_MIN) return json_({ ok: false, error: 'Many people are posting right now. Please try again in a few minutes.' });
  cache.put('count', String(n + 1), 600);
  var lock = LockService.getScriptLock(); lock.waitLock(5000);
  try { sheet_().appendRow([new Date(), here, before, '']); } finally { lock.releaseLock(); }
  return json_({ ok: true });
}
