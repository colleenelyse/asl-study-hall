/* ASL Theatre sign-in (Colleen 2026-10-23): a tiny page in the school account whose only job is to say who is signed in, the same way
   ASL Study Hall knows its students. Students already signed into Chrome with their school account open it (asl.cool/theatre sends them
   here for a moment), and it sends them straight back with a scrambled code of their school email (SHA-256 of "theatre:" + the email,
   the same code the theatre app keeps in its cast list). The email itself never leaves Google. Nothing is stored here.
   Published as a web app: execute as the owner, only people in the school domain. */
var BACK = ['https://asl.cool/theatre/', 'http://localhost:8830/theatre/'];      // the only places it sends anyone back to

function doGet(e) {
  var r = String((e && e.parameter && e.parameter.r) || BACK[0]);
  if (!BACK.some(function (b) { return r.indexOf(b) === 0; })) r = BACK[0];
  var email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (err) {}
  var code = email ? hash_('theatre:' + email) : 'none';
  var url = r.split('#')[0] + '#/signin/' + code;
  var t = HtmlService.createTemplate(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="font:18px system-ui,sans-serif;text-align:center;padding:40px 16px;background:#7d0c16;color:#fff">' +
    '<p>Signing you in…</p><p><a id="go" href="<?= url ?>" target="_top" style="display:inline-block;background:#fff;color:#7d0c16;font-weight:700;padding:14px 22px;border-radius:14px;text-decoration:none">Continue to the theatre app</a></p>' +
    '<script>try { window.top.location.href = <?!= JSON.stringify(url) ?>; } catch (e) {}</script></body>');
  t.url = url;
  return t.evaluate().setTitle('ASL Theatre sign-in').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length < 2 ? '0' + v : v; }).join('');
}
