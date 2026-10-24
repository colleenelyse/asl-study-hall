/* asl.cool/theatre notification emails, sent from Colleen's school Google account (her choice, 2026-10-24). See theatre/HANDOFF.md and js/mail.js.
   Teacher mode posts { key, name, messages: [{ to, subject, text, html }] } (at most 40); this sends each one with MailApp, as the account that
   deployed it, and skips any address that clicked "Stop these emails". It keeps no addresses: only the unsubscribe codes
   (HMAC-SHA256(key, address), the same code the app puts in each email's link).
   One time: run setup() in the editor (it asks to send email as you, then logs the key), deploy as a web app (Execute as: Me, Who has access: Anyone),
   and paste the web app address and the key into Teacher mode › Emails. */
var MAX = 40;
function props_() { return PropertiesService.getScriptProperties(); }
function setup() {
  var p = props_(), k = p.getProperty('KEY');
  if (!k) { k = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); p.setProperty('KEY', k); }
  Logger.log('Your key (paste it into Teacher mode › Emails): ' + k);
  Logger.log('Emails you can still send today: ' + MailApp.getRemainingDailyQuota());
}
function hex_(bytes) { return bytes.map(function (b) { return ((b + 256) % 256).toString(16); }).map(function (h) { return h.length < 2 ? '0' + h : h; }).join(''); }
function sig_(addr, key) { return hex_(Utilities.computeHmacSha256Signature(String(addr).trim().toLowerCase(), key)); }
function unsubs_() { try { return JSON.parse(props_().getProperty('UNSUB') || '[]'); } catch (e) { return []; } }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function same_(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function doPost(e) {
  var key = props_().getProperty('KEY'), body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'Not readable.' }); }
  if (!key || !same_(String(body.key || ''), key)) return out_({ ok: false, error: 'The key is not right. Copy it again from the script’s setup log.' });
  var list = Array.isArray(body.messages) ? body.messages.slice(0, MAX) : [], gone = unsubs_(), sent = 0, skipped = 0;
  var name = String(body.name || 'Theatre').slice(0, 80);
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
