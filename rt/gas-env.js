/* Stand-ins for Google Apps Script's services, so ASL Study's own server code (rt/engine.js, generated from Code.gs) can run a live class game
   inside a LiveRoom on asl.cool (ASL Study 4.145, Colleen 2026-10-21: "yes move all of it for optimization").
   - CacheService / PropertiesService: the room's own store (ENV.store), saved with the room.
   - LockService: one room runs one call at a time, so a lock is always free.
   - Session: the player's number (ⓟ3) or the teacher (ⓣ) for the call being run; "the owner" is the teacher, as on Google.
   - Utilities: ids, dates and base64; SpreadsheetApp only knows the time zone (a live game never reads the sheet: anything that tries gets nothing).
   No names or emails are ever in here: ASL Study swaps them for numbers before the game arrives. */
export const ENV = { store: null, user: '', tz: 'America/Chicago' };

function bucket(name) { const s = ENV.store; s[name] = s[name] || {}; return s[name]; }
const now = () => Date.now();
const cacheObj = {
  get(k) { const c = bucket('cache'), e = c[k]; if (!e) return null; if (e.x && e.x < now()) { delete c[k]; return null; } return e.v; },
  getAll(keys) { const o = {}; (keys || []).forEach(k => { const v = cacheObj.get(k); if (v != null) o[k] = v; }); return o; },
  put(k, v, ttl) { bucket('cache')[k] = { v: String(v), x: now() + Math.min(21600, Number(ttl) || 600) * 1000 }; },
  putAll(o, ttl) { Object.keys(o || {}).forEach(k => cacheObj.put(k, o[k], ttl)); },
  remove(k) { delete bucket('cache')[k]; },
  removeAll(keys) { (keys || []).forEach(k => cacheObj.remove(k)); }
};
export const CacheService = { getScriptCache: () => cacheObj, getUserCache: () => cacheObj, getDocumentCache: () => cacheObj };
const propsObj = {
  getProperty(k) { const p = bucket('props'); return Object.prototype.hasOwnProperty.call(p, k) ? p[k] : null; },
  setProperty(k, v) { bucket('props')[k] = String(v); return propsObj; },
  deleteProperty(k) { delete bucket('props')[k]; return propsObj; },
  getProperties() { return Object.assign({}, bucket('props')); },
  setProperties(o, deleteOthers) { if (deleteOthers) ENV.store.props = {}; Object.keys(o || {}).forEach(k => propsObj.setProperty(k, o[k])); return propsObj; },
  getKeys() { return Object.keys(bucket('props')); },
  deleteAllProperties() { ENV.store.props = {}; return propsObj; }
};
export const PropertiesService = { getScriptProperties: () => propsObj, getDocumentProperties: () => propsObj, getUserProperties: () => propsObj };
const lockObj = { waitLock() {}, tryLock() { return true; }, releaseLock() {}, hasLock() { return true; } };
export const LockService = { getScriptLock: () => lockObj, getDocumentLock: () => lockObj, getUserLock: () => lockObj };
export const Session = {
  getActiveUser: () => ({ getEmail: () => ENV.user || '' }),
  getEffectiveUser: () => ({ getEmail: () => 'ⓣ' }),
  getScriptTimeZone: () => ENV.tz, getTemporaryActiveUserKey: () => ENV.user || ''
};
/* the date patterns ASL Study uses (yyyy-MM-dd, HH:mm, EEE, MMM d ...), in the given time zone */
function fmtDate(d, tz, pat) {
  const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz || ENV.tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false, weekday: 'short' }).formatToParts(new Date(d)).forEach(x => { p[x.type] = x.value; });
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], h24 = (+p.hour) % 24, pad = n => String(n).padStart(2, '0');
  const DAYS = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
  return String(pat).replace(/yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|ss|a|u/g, t => ({ yyyy: p.year, yy: String(p.year).slice(-2), MMMM: new Date(d).toLocaleString('en-US', { month: 'long', timeZone: tz || ENV.tz }), MMM: MON[+p.month - 1], MM: pad(p.month), M: String(+p.month), dd: pad(p.day), d: String(+p.day), EEEE: DAYS[p.weekday] || p.weekday, EEE: p.weekday, HH: pad(h24), H: String(h24), hh: pad(h24 % 12 || 12), h: String(h24 % 12 || 12), mm: pad(p.minute), ss: pad(p.second), a: h24 < 12 ? 'AM' : 'PM', u: String(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1) })[t]);
}
const b64 = s => btoa(unescape(encodeURIComponent(String(s))));
export const Utilities = {
  getUuid: () => crypto.randomUUID(), formatDate: fmtDate, sleep() {},
  base64Encode: s => b64(Array.isArray(s) ? String.fromCharCode(...s.map(x => x & 255)) : s), base64EncodeWebSafe: s => b64(s).replace(/\+/g, '-').replace(/\//g, '_'),
  base64Decode: s => Array.from(atob(String(s)), c => c.charCodeAt(0)), newBlob: (data) => ({ getDataAsString: () => String(data), getBytes: () => [] }),
  computeHmacSha256Signature() { throw new Error('Not in a live room.'); }, zip() { throw new Error('Not in a live room.'); }
};
const none = () => { throw new Error('Not in a live room.'); };
const ss = { getSpreadsheetTimeZone: () => ENV.tz, getSheetByName: () => null, getSheets: () => [], getId: () => 'live', getUrl: () => '' };
export const SpreadsheetApp = { getActive: () => ss, getActiveSpreadsheet: () => ss, openById: () => ss, flush() {}, getUi: none };
export const UrlFetchApp = { fetch: none }, DriveApp = { getFileById: none, getFolderById: none, createFile: none }, HtmlService = {}, ScriptApp = { getService: () => ({ getUrl: () => '' }) };
export const Logger = { log() {} }, MailApp = { sendEmail: none }, GmailApp = {}, ContentService = {}, Browser = {}, CardService = {}, Drive = {}, DocumentApp = {}, FormApp = {}, CalendarApp = {}, Charts = {};
