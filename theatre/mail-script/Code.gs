/* asl.cool/theatre notification emails, sent from Colleen's school Google account (her choice, 2026-10-24). See theatre/HANDOFF.md and js/mail.js.
   Teacher mode posts { key, name, messages: [{ to, subject, text, html }] } (at most 40); this sends each one with MailApp, as the account that
   deployed it, and skips any address that clicked "Stop these emails". It keeps no addresses: only the unsubscribe codes
   (HMAC-SHA256(key, address), the same code the app puts in each email's link).
   One time: run setup() in the editor (it asks to send email as you, then logs the key), deploy as a web app (Execute as: Me, Who has access: Anyone),
   and paste the web app address and the key into Teacher mode › Emails.
   Reminders (Colleen 2026-10-24: "a few reminder emails leading up to the date of an obligation"): Teacher mode sends { key, action: 'schedule',
   reminders: [{ id, on: 'YYYY-MM-DD', to, subject, text }] } for about the next month; that replaces the waiting list (one property per reminder,
   'r:<id>'). daily() runs every morning (setup() makes the trigger) and sends what is due, as plain text plus a simple HTML copy; sent ids are
   remembered (SENT) so a later schedule does not send them twice. */
var MAX = 40;
function props_() { return PropertiesService.getScriptProperties(); }
function setup() {
  var p = props_(), k = p.getProperty('KEY');
  if (!k) { k = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); p.setProperty('KEY', k); }
  Logger.log('Your key (paste it into Teacher mode › Emails): ' + k);
  Logger.log('Emails you can still send today: ' + MailApp.getRemainingDailyQuota());
  if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'daily'; })) ScriptApp.newTrigger('daily').timeBased().everyDays(1).atHour(7).create();
  Logger.log('Reminders are sent every morning around 7.');
}
function hex_(bytes) { return bytes.map(function (b) { return ((b + 256) % 256).toString(16); }).map(function (h) { return h.length < 2 ? '0' + h : h; }).join(''); }
function sig_(addr, key) { return hex_(Utilities.computeHmacSha256Signature(String(addr).trim().toLowerCase(), key)); }
function unsubs_() { try { return JSON.parse(props_().getProperty('UNSUB') || '[]'); } catch (e) { return []; } }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function same_(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function sent_() { try { return JSON.parse(props_().getProperty('SENT') || '[]'); } catch (e) { return []; } }
function html_(text) {
  var esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:600px">' +
    esc.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>') + '</div>';
}
function today_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
/* every morning: send the reminders that are due */
function daily() {
  var p = props_(), key = p.getProperty('KEY'), all = p.getProperties(), t = today_(), gone = unsubs_(), sent = sent_(), name = p.getProperty('NAME') || 'Theatre';
  Object.keys(all).filter(function (k) { return k.indexOf('r:') === 0; }).sort().forEach(function (k) {
    var r; try { r = JSON.parse(all[k]); } catch (e) { p.deleteProperty(k); return; }
    if (r.on > t) return;
    if (MailApp.getRemainingDailyQuota() < 1) return;      // tomorrow
    if (sent.indexOf(r.id) < 0 && gone.indexOf(sig_(r.to, key)) < 0) MailApp.sendEmail({ to: r.to, subject: String(r.subject).slice(0, 180), body: r.text, htmlBody: html_(r.text), name: name });
    sent.push(r.id); p.deleteProperty(k);
  });
  p.setProperty('SENT', JSON.stringify(sent.slice(-600)));
}
function doPost(e) {
  var key = props_().getProperty('KEY'), body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'Not readable.' }); }
  if (!key || !same_(String(body.key || ''), key)) return out_({ ok: false, error: 'The key is not right. Copy it again from the script’s setup log.' });
  var name = String(body.name || 'Theatre').slice(0, 80);
  if (body.action === 'schedule') {      // replace the waiting reminders
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      var p = props_(), all = p.getProperties(), done = sent_(), n = 0, add = {};
      Object.keys(all).forEach(function (k) { if (k.indexOf('r:') === 0) p.deleteProperty(k); });
      (Array.isArray(body.reminders) ? body.reminders.slice(0, 400) : []).forEach(function (r) {
        if (!r || !/^[\w-]{6,40}$/.test(r.id || '') || !/^\d{4}-\d{2}-\d{2}$/.test(r.on || '') || done.indexOf(r.id) >= 0) return;
        if (!/^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i.test(String(r.to || '').trim())) return;
        add['r:' + r.on + ':' + r.id] = JSON.stringify({ id: r.id, on: r.on, to: String(r.to).trim(), subject: String(r.subject || name).slice(0, 180), text: String(r.text || '').slice(0, 4000) }); n++;
      });
      if (n) p.setProperties(add);
      p.setProperty('NAME', name);
      var tr = -1; try { tr = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'daily'; }).length; } catch (x) {}      // -1: setup() has not been run again since reminders were added
      return out_({ ok: true, scheduled: n, daily: tr });
    } finally { lock.releaseLock(); }
  }
  var list = Array.isArray(body.messages) ? body.messages.slice(0, MAX) : [], gone = unsubs_(), sent = 0, skipped = 0;
  for (var i = 0; i < list.length; i++) {
    var m = list[i] || {}, to = String(m.to || '').trim();
    if (!/^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i.test(to)) { skipped++; continue; }
    if (gone.indexOf(sig_(to, key)) >= 0) { skipped++; continue; }
    if (MailApp.getRemainingDailyQuota() < 1) return out_({ ok: false, error: 'Today’s email limit is used up; ' + sent + ' sent. Try the rest tomorrow.', sent: sent });
    MailApp.sendEmail({ to: to, subject: String(m.subject || name).slice(0, 180), body: String(m.text || '').slice(0, 20000), htmlBody: String(m.html || '').slice(0, 40000), name: name });
    sent++;
  }
  return out_({ ok: true, sent: sent, skipped: skipped, quota: MailApp.getRemainingDailyQuota() });
}
/* "Stop these emails": ?u=<code>. undo=1 takes it back. */
function doGet(e) {
  var u = String((e && e.parameter && e.parameter.u) || ''), undo = e && e.parameter && e.parameter.undo === '1', page = function (t) { return HtmlService.createHtmlOutput('<div style="font-family:Arial,sans-serif;font-size:18px;max-width:520px;margin:40px auto;line-height:1.5">' + t + '</div>').setTitle('Theatre emails'); };
  if (!/^[0-9a-f]{64}$/.test(u)) return page('<p>This link is not complete.</p>');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var gone = unsubs_().filter(function (x) { return x !== u; });
    if (!undo) gone.push(u);
    props_().setProperty('UNSUB', JSON.stringify(gone.slice(-2000)));
  } finally { lock.releaseLock(); }
  var url = ScriptApp.getService().getUrl() + '?u=' + u;
  return undo ? page('<p>✅ You will get theatre app emails again.</p>') : page('<p>✅ You won’t get any more emails from the theatre app.</p><p>Changed your mind? <a href="' + url + '&undo=1">Get them again</a>.</p>');
}
