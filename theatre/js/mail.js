/* asl.cool/theatre: notification emails (Colleen 2026-10-24: "whenever i create or add new information to the app, i want to be able to control if
   company artists, company mentors, or parents get an automatic notification email that there's new information in the portal and a brief description
   of what it is with a link to access it right from the email… parents can also receive an email when something changes on their student's portal like
   a new choreography video… when a student is officially added in as a soloist or chorus member in a musical number… parents can opt in through the app
   to receive copies of notifications that their students receive too").
   How it works:
   - Sender: a small Apps Script web app in Colleen's school Google account (theatre/mail-script/), so emails come from her school address (her choice).
     Teacher mode sends the finished emails to it with its key; it skips anyone who unsubscribed (one click in the email) and reports how many went.
   - Addresses never sit in the show or on the server: the script's address and key, and Company members' school emails, are in the vault
     (V.extra.mail, teacher password); parents' addresses and what they want arrive from the Family portal as sealed notes (kind 'contact',
     portal.js) and are kept in V.extra.portal[actor].contacts. So emails are sent from Teacher mode, at the moment something is saved.
   - What's new: after every save in Teacher mode, the show is compared with the last snapshot (T.show.mail.seen): news for families, volunteer
     needs, dance videos OK'd, a week shown on the calendar, performances, a new role, a song a Company member is now in (chorus or more), a solo line.
     A card asks "Email about this?"; she ticks Artists / Mentors / Parents for each (defaults remembered per kind), or skips. Each person gets ONE
     email listing what is new for them, with a link to the page. Parents choose news and requests (general), changes for their Company member
     (mine), and copies of their Company member's emails (copies).
   - Nothing about sizes, medical or sensory needs is ever put in an email: only titles the teacher wrote, role and song names, and links.
   T.show.mail = { on, seen, picks: { kind: { a, m, p } }, sign, log: [{ at, title, n }] } */
(function (root) {
  'use strict';
  var KINDS = {
    news: { icon: '📣', name: 'Announcements', general: true, def: { a: false, m: false, p: true }, page: '#/home' },
    need: { icon: '🤝', name: 'Volunteer and donation needs', general: true, def: { a: false, m: false, p: true }, page: '#/help' },
    week: { icon: '📅', name: 'A new week on the calendar', general: false, def: { a: true, m: true, p: true }, page: '#/today' },
    perf: { icon: '🎟️', name: 'Performances and tickets', general: true, def: { a: true, m: true, p: true }, page: '#/today' },
    video: { icon: '💃', name: 'New dance videos', general: false, def: { a: true, m: true, p: true }, page: '#/songs' },
    role: { icon: '🎭', name: 'A new role', general: false, def: { a: true, m: true, p: true }, page: '#/schedule' },
    song: { icon: '🎵', name: 'Added to a musical number', general: false, def: { a: true, m: true, p: true }, page: '#/songs' },
    solo: { icon: '🎤', name: 'A solo line', general: false, def: { a: true, m: true, p: true }, page: '#/songs' },
    note: { icon: '✉️', name: 'A message you write', general: true, def: { a: false, m: false, p: true }, page: '#/home' } };
  var EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;
  var okEmail = function (e) { return EMAIL.test(String(e || '').trim()) && String(e).length <= 120; };
  var first = function (n) { return String(n || '').trim().split(/\s+/)[0] || ''; };
  /* what people may care about, now. h = { onStage(m, chars), soloSongs(chars) -> [songIds], O, isGuest(a) } */
  function snapshot(show, h) {
    var O = h.O, prod = show.production || {}, cast = {};
    (show.cast || []).forEach(function (a) {
      if (!a || !a.id || a.guest) return;
      var chars = (a.chars || []).slice().sort();
      var songs = O.moments.filter(function (m) { return m.song && chars.length && h.onStage(m, chars); }).map(function (m) { return m.song; });
      cast[a.id] = { chars: chars, songs: songs.filter(function (x, i) { return songs.indexOf(x) === i; }).sort(), solos: chars.length ? h.soloSongs(chars).slice().sort() : [] };
    });
    return { news: ((show.portal || {}).news || []).map(function (n) { return n.id; }),
      need: ((show.helpBoard || {}).posts || []).filter(function (p) { return !p.closed; }).map(function (p) { return p.id; }),
      video: (show.videos || []).filter(function (v) { return v.ok; }).map(function (v) { return v.id; }),
      week: (prod.shown || []).slice(), perf: (prod.performances || []).map(function (p) { return p.id; }), cast: cast };
  }
  /* what is new since the last snapshot, as events { id, kind, title, text, page, actors|null } */
  function diff(seen, now, show, h) {
    var out = [], O = h.O, added = function (k) { var was = seen[k] || []; return (now[k] || []).filter(function (x) { return was.indexOf(x) < 0; }); };
    var castById = {}; (show.cast || []).forEach(function (a) { castById[a.id] = a; });
    var song = function (id) { return O.songs.find(function (s) { return s.id === id; }) || { title: 'a song' }; };
    var char = function (id) { return O.characters.find(function (c) { return c.id === id; }) || { name: id, short: id }; };
    added('news').forEach(function (id) { var n = show.portal.news.find(function (x) { return x.id === id; }); out.push({ id: 'news:' + id, kind: 'news', title: n.title, text: n.text || '', page: '#/notifications', actors: null, to: n.to || 'parents' }); });
    added('need').forEach(function (id) { var p = show.helpBoard.posts.find(function (x) { return x.id === id; }); out.push({ id: 'need:' + id, kind: 'need', title: 'The show needs: ' + p.title, text: p.detail || '', page: KINDS.need.page, actors: null }); });
    added('video').forEach(function (id) {
      var v = show.videos.find(function (x) { return x.id === id; }), so = song(v.song), m = O.moments.find(function (x) { return x.song === v.song; });
      var who = Object.keys(now.cast).filter(function (a) { return now.cast[a].songs.indexOf(v.song) >= 0; });
      out.push({ id: 'video:' + id, kind: 'video', title: 'New dance video: ' + so.title, text: (v.title && v.title !== 'Dance video' ? v.title + '. ' : '') + 'Watch it on the song’s page to practice the dance.', page: '#/song/' + v.song, actors: m && who.length ? who : null });
    });
    added('week').forEach(function (d) { out.push({ id: 'week:' + d, kind: 'week', title: 'A new week is on the calendar', text: 'The plan for the week of ' + h.dayName(d) + ' is ready. See what you do each day.', page: KINDS.week.page, actors: null }); });
    added('perf').forEach(function (id) {
      var p = show.production.performances.find(function (x) { return x.id === id; });
      out.push({ id: 'perf:' + id, kind: 'perf', title: (p.kind === 'evening' ? 'Evening show' : 'School-day show') + ': ' + h.dayName(p.date) + (p.time ? ' at ' + h.time12(p.time) : ''), text: (p.tickets ? 'Free tickets: ' + p.tickets + '. ' : '') + (p.notes || ''), page: KINDS.perf.page, actors: null });
    });
    Object.keys(now.cast).forEach(function (aid) {
      var a = castById[aid], was = seen.cast && seen.cast[aid], n = now.cast[aid]; if (!a) return;
      var w = was || { chars: [], songs: [], solos: [] }, name = first(a.name);
      var roles = n.chars.filter(function (c) { return w.chars.indexOf(c) < 0; });
      var songsNew = n.songs.filter(function (s) { return w.songs.indexOf(s) < 0; }), solosNew = n.solos.filter(function (s) { return w.solos.indexOf(s) < 0; });
      if (roles.length) {
        out.push({ id: 'role:' + aid + ':' + roles.join('+'), kind: 'role', actors: [aid], page: KINDS.role.page,
          title: name + ' has a role: ' + roles.map(function (c) { return char(c).name; }).join(' and '),
          text: (n.songs.length ? 'Songs: ' + n.songs.map(function (s) { return song(s).title; }).join(', ') + '. ' : '') + 'My Schedule shows when ' + name + ' is on stage.' });
        return;      // a new role already lists the songs
      }
      songsNew.forEach(function (s) {
        var lead = n.chars.some(function (c) { var x = char(c); return x.group && x.group !== 'ensemble'; });
        out.push({ id: 'song:' + aid + ':' + s, kind: 'song', actors: [aid], page: '#/song/' + s, title: name + ' is in “' + song(s).title + '”' + (lead ? '' : ' (chorus)'), text: 'Practice it on My Songs, with the tracks.' });
      });
      solosNew.forEach(function (s) { out.push({ id: 'solo:' + aid + ':' + s, kind: 'solo', actors: [aid], page: '#/song/' + s, title: name + ' sings a solo line in “' + song(s).title + '”', text: 'Practice it on My Songs. The lit-up lines show it.' }); });
    });
    return out;
  }
  /* who gets what. picks[eventId] = { a, m, p }; P = { cast:[{ id, name, company, guest }], student: { id: email }, contacts: { id: [{ email, name, opts }] } }.
     One email per address: { to, name, items: [{ e, copyOf }] }. A parent who asked for copies gets a copy of what their Company member got. */
  function plan(events, picks, P) {
    var by = {}, castIds = P.cast.filter(function (a) { return !a.guest; }).map(function (a) { return a.id; }), A = {};
    P.cast.forEach(function (a) { A[a.id] = a; });
    var give = function (to, name, e, copyOf) {
      if (!okEmail(to)) return;
      var k = to.trim().toLowerCase(), r = by[k] = by[k] || { to: to.trim(), name: name || '', items: [] };
      var have = r.items.find(function (x) { return x.e.id === e.id; });
      if (have) { if (!copyOf) have.copyOf = ''; return; }      // a direct email wins over a copy
      r.items.push({ e: e, copyOf: copyOf || '' });
    };
    events.forEach(function (e) {
      var pk = picks[e.id]; if (!pk || !(pk.a || pk.m || pk.p)) return;
      var who = (e.actors || castIds).filter(function (id) { return A[id]; });
      who.forEach(function (id) {
        var a = A[id], co = a.company, student = (co === 'artist' && pk.a) || (co === 'mentor' && pk.m) || (!co && (pk.a || pk.m));
        if (student) {
          if (P.student[id]) give(P.student[id], first(a.name), e, '');
          (P.contacts[id] || []).forEach(function (c) { if (c.opts && c.opts.copies) give(c.email, c.name, e, first(a.name)); });
        }
        if (pk.p) (P.contacts[id] || []).forEach(function (c) { if (c.opts && c.opts[KINDS[e.kind].general ? 'general' : 'mine']) give(c.email, c.name, e, ''); });
      });
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }
  var escH = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  /* the email itself: plain text and simple HTML, a link for every item, and how to stop them */
  function compose(r, ctx) {
    var n = r.items.length, title = ctx.title;
    var subject = title + ': ' + (n === 1 ? r.items[0].e.title : n + ' updates');
    var link = function (e) { return ctx.base + e.page; };
    var hello = r.name ? 'Hello ' + first(r.name) + ',' : 'Hello,';
    var lines = r.items.map(function (x) { return '• ' + (x.copyOf ? '(A copy of ' + x.copyOf + '’s email) ' : '') + x.e.title + (x.e.text ? '\n  ' + x.e.text : '') + '\n  Open it: ' + link(x.e); });
    var foot = 'You get these emails from the ' + title + ' app' + (ctx.sign ? ' (' + ctx.sign + ')' : '') + '. Stop these emails: ' + ctx.unsub;
    var text = hello + '\n\nThere is something new in the ' + title + ' app:\n\n' + lines.join('\n\n') + (ctx.sign ? '\n\n' + ctx.sign : '') + '\n\n—\n' + foot;
    var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:600px">' +
      '<p>' + escH(hello) + '</p><p>There is something new in the <b>' + escH(title) + '</b> app:</p>' +
      r.items.map(function (x) {
        return '<div style="border-left:4px solid #b4232a;padding:6px 12px;margin:12px 0">' + (x.copyOf ? '<div style="color:#666;font-size:13px">A copy of ' + escH(x.copyOf) + '’s email</div>' : '') +
          '<b>' + escH(x.e.title) + '</b>' + (x.e.text ? '<div style="white-space:pre-wrap">' + escH(x.e.text) + '</div>' : '') +
          '<div style="margin-top:8px"><a href="' + escH(link(x.e)) + '" style="display:inline-block;background:#b4232a;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none">Open it in the app</a></div></div>';
      }).join('') + (ctx.sign ? '<p>' + escH(ctx.sign) + '</p>' : '') +
      '<p style="color:#777;font-size:12px;border-top:1px solid #ddd;padding-top:8px">You get these emails from the ' + escH(title) + ' app. <a href="' + escH(ctx.unsub) + '" style="color:#777">Stop these emails</a></p></div>';
    return { to: r.to, subject: subject.slice(0, 180), text: text, html: html };
  }
  /* ---------- reminders (Colleen 2026-10-24: "i want the committments parents make to result in a few reminder emails leading up to the date of an
     obligation"): before every date a family committed to (the show-week dates, for families who signed the commitment; the date of a need they signed
     up for, with what they're bringing), an email `days` days before. One email per address per date and lead time. Only the next `horizon` days are
     scheduled each time; Teacher mode sends the list to the school-account script, which sends them each morning. ---------- */
  var DEF_DATES = [{ date: '2027-11-29', what: 'The final rehearsal weeks begin: please make being at school every day a priority, through Friday, December 10' },
    { date: '2027-12-07', what: 'The full dress rehearsal, after school (required)' }, { date: '2027-12-09', what: 'The school-day show' },
    { date: '2027-12-10', what: 'Evening show at 7:00 PM' }, { date: '2027-12-11', what: 'Evening show at 7:00 PM' }];
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  var addDays = function (s, n) { var a = s.split('-'), d = new Date(+a[0], +a[1] - 1, +a[2]); d.setDate(d.getDate() + n); return ymd(d); };
  var dayLong = function (s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); };
  /* "12/7/2027 Full dress rehearsal" or "2027-12-07 …", one per line -> [{ date, what }] (lines without a readable date are returned in bad) */
  function parseDates(text) {
    var out = [], bad = [];
    String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l) {
      var m = l.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s*[-–:,]?\s*(.*)$/), d;
      if (m) d = m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);
      else { m = l.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-–:,]?\s*(.*)$/); if (m) d = (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad2(+m[1]) + '-' + pad2(+m[2]); }
      var ok = d && !isNaN(new Date(d + 'T12:00:00')) && +d.slice(5, 7) <= 12 && +d.slice(8) <= 31;
      if (ok && m[4].trim()) out.push({ date: d, what: m[4].trim().slice(0, 200) }); else bad.push(l);
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return { dates: out, bad: bad };
  }
  var datesText = function (l) { return l.map(function (x) { var a = x.date.split('-'); return +a[1] + '/' + +a[2] + '/' + a[0] + ' ' + x.what; }).join('\n'); };
  function hashId(s) { var h1 = 0x811c9dc5, h2 = 0; for (var i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 16777619) >>> 0; h2 = (h2 * 31 + s.charCodeAt(i)) >>> 0; } return 'r' + h1.toString(36) + h2.toString(36); }
  /* R = { today, days: [7, 2, 1], horizon, dates: [{ date, what }], title, base, sign,
          families: [{ actor, name (first), committed, contacts: [{ email, name }] }], signups: [{ to, name, date, title, what, qty, note, page }] }
     -> [{ id, on, to, subject, text }] ({UNSUB} in text is filled in by the page) */
  function reminders(R) {
    var by = {}, last = addDays(R.today, R.horizon || 35);
    var add = function (to, name, date, line, page) {
      to = String(to || '').trim(); if (!okEmail(to)) return;
      (R.days || [7, 2, 1]).forEach(function (n) {
        var on = addDays(date, -n); if (on <= R.today || on > last) return;
        var k = to.toLowerCase() + '|' + date + '|' + n, r = by[k] = by[k] || { to: to, name: name || '', date: date, n: n, lines: [], page: page };
        if (r.lines.indexOf(line) < 0) r.lines.push(line); if (!r.name && name) r.name = name;
      });
    };
    (R.families || []).forEach(function (f) {      // a date marked "(all families)" goes to every family with an email; the others to families who signed the commitment
      (R.dates || []).forEach(function (d) { if (!f.committed && !/\(all families\)\s*$/i.test(d.what)) return; (f.contacts || []).forEach(function (c) { add(c.email, c.name, d.date, d.what.replace(/\s*\(all families\)\s*$/i, '') + ' (' + f.name + ')', '#/today'); }); });
    });
    (R.signups || []).forEach(function (s) {
      if (!s.date) return;
      add(s.to, s.name, s.date, 'You signed up for “' + s.title + '”' + (s.what && s.what !== s.title ? ': ' + s.what : '') + (+s.qty > 1 ? ' ×' + s.qty : '') + (s.note ? ' (' + s.note + ')' : ''), s.page || '#/help');
    });
    return Object.keys(by).sort().map(function (k) {
      var r = by[k], when = r.n === 1 ? 'tomorrow' : r.n === 7 ? 'in one week' : 'in ' + r.n + ' days';
      // a family with two Company members in the show gets one line per date: "(Sam)" and "(Ana)" joined
      var lines = [], seen = {};
      r.lines.forEach(function (l) { var m = l.match(/^(.*) \(([^()]*)\)$/); if (m && r.page === '#/today' && !/^You signed up/.test(l)) { if (seen[m[1]] !== undefined) { lines[seen[m[1]]] = lines[seen[m[1]]].replace(/\)$/, ' and ' + m[2] + ')'); return; } seen[m[1]] = lines.length; } lines.push(l); });
      var subject = R.title + ': reminder for ' + dayLong(r.date).replace(/,.*$/, '') + ', ' + dayLong(r.date).split(', ')[1] + ' (' + when + ')';
      var text = (r.name ? 'Hello ' + String(r.name).split(/\s+/)[0] + ',' : 'Hello,') + '\n\nA reminder for ' + dayLong(r.date) + ' (' + when + '):\n\n' + lines.map(function (l) { return '• ' + l; }).join('\n') +
        '\n\nThank you for your commitment to the show!\n\nOpen the app: ' + R.base + r.page + (R.sign ? '\n\n' + R.sign : '') + '\n\n—\nYou get this reminder because of your commitment in the ' + R.title + ' app. Stop these emails: {UNSUB}';
      return { id: hashId(k + '|' + lines.join('|')), on: addDays(r.date, -r.n), to: r.to, subject: subject.slice(0, 180), text: text, date: r.date, n: r.n, gk: r.date + '|' + r.n, lines: lines };
    });
  }
  /* reminders grouped for the teacher's OK (Colleen 2026-10-24: "i want it to ask me on log in before it sends a reminder email if i want it sent"):
     one group per date and lead time; ok = { 'date|n': 'yes' | 'no' | 'sent' }. Waiting = no answer yet, sending within `ahead` days, date still to come. */
  function remGroups(list, ok, today, ahead) {
    var last = addDays(today, ahead == null ? 7 : ahead), by = {};
    list.forEach(function (r) {
      var g = by[r.gk] = by[r.gk] || { gk: r.gk, date: r.date, n: r.n, on: r.on, to: [], whats: [], sample: r };
      if (g.to.indexOf(r.to.toLowerCase()) < 0) g.to.push(r.to.toLowerCase());
      r.lines.forEach(function (l) { var w = l.replace(/ \([^()]*\)$/, ''); if (/^You signed up/.test(l)) w = 'Volunteer and dinner sign-ups'; if (g.whats.indexOf(w) < 0) g.whats.push(w); });
    });
    return Object.keys(by).map(function (k) { return by[k]; }).filter(function (g) { return !(ok || {})[g.gk] && g.date > today && g.on <= last; })
      .sort(function (a, b) { return a.on < b.on ? -1 : a.on > b.on ? 1 : a.date < b.date ? -1 : 1; });
  }
  /* dates the app knows about that are not on the reminder list yet: performances and field trips in the next `days` days */
  function suggest(show, dates, today, days, off) {
    var last = addDays(today, days || 60), have = (dates || []).map(function (d) { return d.date; }), out = [], prod = (show && show.production) || {};
    var t12 = function (t) { if (!t) return ''; var a = t.split(':'), h = +a[0]; return ' at ' + (h % 12 || 12) + (a[1] === '00' ? '' : ':' + a[1]) + (h < 12 ? ' AM' : ' PM'); };
    (prod.performances || []).forEach(function (p) { if (p.date > today && p.date <= last) out.push({ date: p.date, what: (p.kind === 'evening' ? 'Evening show' : 'School-day show') + t12(p.time) + (p.kind === 'evening' ? ' (all families)' : '') }); });
    Object.keys(prod.days || {}).forEach(function (d) { if (d > today && d <= last && (prod.days[d].groups || []).some(function (g) { return g.focus === 'trip'; })) { var g = prod.days[d].groups.find(function (x) { return x.focus === 'trip'; }); out.push({ date: d, what: 'Field trip' + (g.where ? ' to ' + g.where : '') + ' (all families)' }); } });
    return out.filter(function (x, i) { return have.indexOf(x.date) < 0 && (off || []).indexOf(x.date) < 0 && out.findIndex(function (y) { return y.date === x.date; }) === i; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  var core = { KINDS: KINDS, okEmail: okEmail, snapshot: snapshot, diff: diff, plan: plan, compose: compose, DEF_DATES: DEF_DATES, parseDates: parseDates, datesText: datesText, reminders: reminders, remGroups: remGroups, suggest: suggest, dayLong: dayLong, addDays: addDays };
  root.MailCore = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);

(function () {
  'use strict';
  if (typeof document === 'undefined' || !window.T) return;
  var T = window.T, C = window.MailCore, esc = T.esc, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  function M() { var m = T.show.mail = T.show.mail || {}; m.picks = m.picks || {}; m.log = m.log || []; return m; }
  var dayName = function (s) { var a = String(s).split('-'); return new Date(+a[0], +a[1] - 1, +a[2]).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); };
  var time12 = function (t) { var a = String(t).split(':'), h = +a[0]; return (h % 12 || 12) + (a[1] === '00' ? '' : ':' + a[1]) + (h < 12 ? ' AM' : ' PM'); };
  function helpers() {
    return { O: T.O(), dayName: dayName, time12: time12, onStage: T.onStage,
      soloSongs: function (chars) {      // songs where a sung line belongs to one of these characters alone
        var out = [], O = T.O(); if (!T.show.script || !T.labelChars) return out;
        O.scenes.forEach(function (sc) {
          var src = T.scriptScene(sc); if (!src) return;
          src.items.forEach(function (it) {
            if (it.type !== 'song') return;
            var so = O.songs.find(function (s) { return String(s.num) === String(it.num); }); if (!so || out.indexOf(so.id) >= 0) return;
            if (it.lyrics.some(function (l) { var ids = T.labelChars(l.who); return ids.length === 1 && chars.indexOf(ids[0]) >= 0; })) out.push(so.id);
          });
        });
        return out;
      } };
  }
  var snap = function () { return C.snapshot(T.show, helpers()); };
  function vaultMail() { return T.openVault().then(function (V) { var m = V.extra.mail || {}; return { url: m.url || '', key: m.key || '', student: m.students || {}, portal: V.extra.portal || {} }; }); }
  function people(vm) {
    var contacts = {}; Object.keys(vm.portal).forEach(function (id) { contacts[id] = vm.portal[id].contacts || []; });
    return { cast: (T.show.cast || []).map(function (a) { return { id: a.id, name: a.name, company: a.company, guest: a.guest }; }), student: vm.student, contacts: contacts };
  }
  /* the unsubscribe link: HMAC-SHA256(key, address) in hex, which the script recognizes (no address in the link) */
  function sig(key, email) {
    var te = new TextEncoder();
    return crypto.subtle.importKey('raw', te.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (k) { return crypto.subtle.sign('HMAC', k, te.encode(String(email).trim().toLowerCase())); })
      .then(function (b) { return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); });
  }
  /* send through the school-account script, 40 at a time. Result { sent, skipped, quota } */
  function post(vm, msgs) {
    var sent = 0, skipped = 0, quota = null, chunks = [];
    for (var i = 0; i < msgs.length; i += 40) chunks.push(msgs.slice(i, i + 40));
    return chunks.reduce(function (p, ch) {
      return p.then(function () {
        return fetch(vm.url, { method: 'POST', body: JSON.stringify({ key: vm.key, name: M().sign || T.O().title, messages: ch }) })
          .then(function (r) { return r.json(); }, function () { throw new Error('Could not reach the email script. Check its address on the Emails page.'); })
          .then(function (d) { if (!d || !d.ok) throw new Error((d && d.error) || 'The email script said no.'); sent += d.sent || 0; skipped += d.skipped || 0; quota = d.quota; });
      });
    }, Promise.resolve()).then(function () { return { sent: sent, skipped: skipped, quota: quota }; });
  }
  /* events + picks -> emails, sent; the log keeps only the date, the titles and how many (no addresses) */
  function send(events, picks) {
    return vaultMail().then(function (vm) {
      if (!vm.url || !vm.key) throw new Error('Set up the email script first (Teacher mode › Emails).');
      var list = C.plan(events, picks, people(vm));
      if (!list.length) return { sent: 0, skipped: 0, none: true };
      var base = location.origin + '/theatre/';
      return Promise.all(list.map(function (r) { return sig(vm.key, r.to).then(function (s) { return C.compose(r, { title: T.O().title, base: base, sign: M().sign || '', unsub: vm.url + '?u=' + s }); }); }))
        .then(function (msgs) { return post(vm, msgs); })
        .then(function (res) {
          var chosen = events.filter(function (e) { var p = picks[e.id]; return p && (p.a || p.m || p.p); });
          M().log.unshift({ at: new Date().toISOString(), title: chosen.map(function (e) { return e.title; }).join(' · ').slice(0, 200), n: res.sent });
          M().log = M().log.slice(0, 40);
          return res;
        });
    });
  }
  T.sendMail = send;

  /* ---------- reminders: build the next month's list and give it to the school-account script (only when it changed) ---------- */
  var todayS = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var remDates = function () { return M().dates && M().dates.length ? M().dates : C.DEF_DATES; };
  var remDays = function () { return M().remDays && M().remDays.length ? M().remDays : [7, 2, 1]; };
  function remList(vm) {
    var d = new Date(), today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), b = T.show.helpBoard || {}, help = vm.help || {};
    var families = (T.show.cast || []).filter(function (a) { return !a.guest; }).map(function (a) {
      var r = vm.portal[a.id] || {};
      return { actor: a.id, name: String(a.name || '').split(/\s+/)[0], committed: !!r.commit, contacts: (r.contacts || []).filter(function (c) { return c.opts && (c.opts.general || c.opts.mine || c.opts.copies); }) };
    });
    var signups = (b.signups || []).map(function (s) {
      var p = (b.posts || []).find(function (x) { return x.id === s.post; }), c = help[s.id]; if (!p || !p.when || p.closed || !c) return null;
      var it = p.kind === 'meal' && (p.items || []).find(function (i) { return i.id === s.item; });
      return { to: c.contact, name: c.name, date: p.when, title: p.title, what: it ? 'bringing ' + it.name : '', qty: s.qty, note: s.note, page: p.kind === 'meal' ? '#/help/dinner/' + p.id : '#/help' };
    }).filter(Boolean);
    return C.reminders({ today: today, days: remDays(), horizon: 35, dates: remDates(), title: T.O().title, base: location.origin + '/theatre/', sign: M().sign || '', families: families, signups: signups });
  }
  var remBusy = null;
  T.syncReminders = function (force) {
    if (!T.proof || !M().on || M().remOff || !T.openVault) return Promise.resolve(null);
    if (remBusy) return remBusy;
    remBusy = T.openVault().then(function (V) {
      var m = V.extra.mail || {}; if (!m.url || !m.key) return null;
      var ok = M().remOk || {}, today = todayS(), vm = { url: m.url, key: m.key, portal: V.extra.portal || {}, help: V.extra.help || {} }, list = remList(vm).filter(function (r) { return ok[r.gk] === 'yes' && r.on > today; });      // only what the teacher said yes to
      var h = JSON.stringify(list.map(function (r) { return r.id + r.on; }));
      if (!force && T.ls('remHash') === h) return null;
      return Promise.all(list.map(function (r) { return sig(vm.key, r.to).then(function (s) { r.text = r.text.replace('{UNSUB}', vm.url + '?u=' + s); return r; }); }))
        .then(function (rs) { return fetch(vm.url, { method: 'POST', body: JSON.stringify({ key: vm.key, action: 'schedule', name: M().sign || T.O().title, reminders: rs }) }); })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (!d || !d.ok) throw new Error((d && d.error) || 'The email script said no.'); T.ls('remHash', h); T.ls('remLast', { at: Date.now(), n: d.scheduled, daily: d.daily, list: list.map(function (r) { return { on: r.on, to: r.to, subject: r.subject }; }) }); return d; });
    }).finally(function () { remBusy = null; });
    return remBusy;
  };

  /* ---------- after every save in Teacher mode: anything new to email about? ---------- */
  var busy = false, pending = [];
  /* ---------- the teacher's OK, asked when Teacher mode opens ---------- */
  function htmlOf(text) { return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:600px">' + esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>') + '</div>'; }
  function remState() {      // { vm, list (all reminders, unfiltered), waiting groups, suggestions }
    return T.openVault().then(function (V) {
      var m = V.extra.mail || {}, vm = { url: m.url || '', key: m.key || '', portal: V.extra.portal || {}, help: V.extra.help || {} };
      var list = remList(vm), today = todayS();
      return { vm: vm, list: list, waiting: C.remGroups(list, M().remOk, today, 7), sugg: C.suggest(T.show, remDates(), today, 60, M().sugOff) };
    });
  }
  /* yes / no for a group; a yes whose day has come (or passed) is sent right now */
  function decide(st, gk, yes) {
    var ok = M().remOk = M().remOk || {}, today = todayS();
    if (!yes) { ok[gk] = 'no'; return Promise.resolve(0); }
    var now = st.list.filter(function (r) { return r.gk === gk && r.on <= today; });
    ok[gk] = now.length ? 'sent' : 'yes';
    if (!now.length) return Promise.resolve(0);
    return Promise.all(now.map(function (r) { return sig(st.vm.key, r.to).then(function (s) { var t = r.text.replace('{UNSUB}', st.vm.url + '?u=' + s); return { to: r.to, subject: r.subject, text: t, html: htmlOf(t) }; }); }))
      .then(function (msgs) { return post(st.vm, msgs); }).then(function (res) { return res.sent; });
  }
  var lead = function (n) { return n === 1 ? 'the day before' : n === 7 ? 'one week before' : n + ' days before'; };
  var short = function (d) { return C.dayLong(d).replace(/^(\w+), (\w+) (\d+)$/, function (m, w, mo, dd) { return w.slice(0, 3) + ', ' + mo.slice(0, 3) + ' ' + dd; }); };
  function groupRow(g) {
    return '<div style="border-bottom:1px solid var(--line);padding:8px 0" data-gk="' + esc(g.gk) + '"><b>' + esc(short(g.date)) + '</b>: ' + esc(g.whats.join('; ')) +
      '<br><span class="small">Reminder ' + esc(lead(g.n)) + ' · ' + (g.on <= todayS() ? '<b>sends right away</b>' : 'sends ' + esc(short(g.on)) + ' morning') + ' · to ' + g.to.length + ' famil' + (g.to.length === 1 ? 'y' : 'ies') + '</span>' +
      '<div class="row" style="flex-wrap:wrap;gap:8px;margin-top:6px"><button class="btn small primary" data-yes>✓ Send</button><button class="btn small" data-no>✕ Don’t send</button><button class="btn small quiet" data-see>Preview</button></div><pre class="small" data-pre hidden style="white-space:pre-wrap;background:var(--hi);padding:10px;border-radius:10px;font-family:inherit"></pre></div>';
  }
  function suggRow(x) {
    return '<div style="border-bottom:1px solid var(--line);padding:8px 0" data-sd="' + esc(x.date) + '"><b>' + esc(short(x.date)) + '</b>: ' + esc(x.what.replace(/\s*\(all families\)$/, '')) + (/\(all families\)$/.test(x.what) ? ' <span class="tag">all families</span>' : '') +
      '<div class="row" style="flex-wrap:wrap;gap:8px;margin-top:6px"><button class="btn small primary" data-add>+ Add to reminder dates</button><button class="btn small" data-off>Not this one</button></div></div>';
  }
  /* wire the rows in a container; done() after each change */
  function wireRem(host, st, done) {
    host.querySelectorAll('[data-gk]').forEach(function (row) {
      var gk = row.dataset.gk, g = st.waiting.find(function (x) { return x.gk === gk; });
      row.querySelector('[data-see]').onclick = function () { var pre = row.querySelector('[data-pre]'); pre.hidden = !pre.hidden; pre.textContent = g.sample.text.replace('{UNSUB}', '(a Stop these emails link)') + (g.to.length > 1 ? '\n\n(' + g.to.length + ' families get this, each with their own Company members and sign-ups)' : ''); };
      var go = function (yes) { row.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); decide(st, gk, yes).then(function (n) { return T.saveShow(yes ? (n ? n + ' reminder' + (n === 1 ? '' : 's') + ' sent' : 'Reminder approved') : 'Reminder skipped'); }).then(function () { return T.syncReminders(true); }).then(done, function (e) { T.toast(e.message || String(e), 5000); done(); }); };
      row.querySelector('[data-yes]').onclick = function () { go(true); };
      row.querySelector('[data-no]').onclick = function () { go(false); };
    });
    host.querySelectorAll('[data-sd]').forEach(function (row) {
      var x = st.sugg.find(function (y) { return y.date === row.dataset.sd; });
      row.querySelector('[data-add]').onclick = function () { M().dates = remDates().concat([x]).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); T.saveShow('Added to the reminder dates').then(done); };
      row.querySelector('[data-off]').onclick = function () { (M().sugOff = M().sugOff || []).push(x.date); T.saveShow('Saved').then(done); };
    });
  }
  T.remApprovals = function (host) {      // the list on Teacher › Emails
    if (!host || !M().on) return;
    remState().then(function (st) {
      host.innerHTML = '<h4>Waiting for your OK (the next week)</h4>' + (st.waiting.length ? st.waiting.map(groupRow).join('') : '<p class="muted small">Nothing waiting. Reminders for the coming week will ask here and when you open Teacher mode.</p>') +
        (st.sugg.length ? '<h4>Suggested dates (coming up in the app)</h4>' + st.sugg.map(suggRow).join('') : '');
      wireRem(host, st, function () { T.remApprovals(host); });
    }).catch(function () {});
  };
  T.reminderPrompt = function () {      // Teacher mode opened: ask about the reminders for the coming week, once per visit
    var asked = false; try { asked = sessionStorage.getItem('remAsked') === '1'; } catch (e) {}
    if (asked || !T.proof || !M().on || M().remOff || document.querySelector('dialog[open]')) return;
    remState().then(function (st) {
      if (!st.vm.url || (!st.waiting.length && !st.sugg.length)) return;
      try { sessionStorage.setItem('remAsked', '1'); } catch (e) {}
      T.dialog('<h2>' + sym('⏰') + 'Reminder emails</h2><p class="small">' + (st.waiting.length ? 'These reminders are coming up. Nothing is sent unless you say so.' : 'Nothing to send this week.') + '</p><div id="rq"></div>' +
        '<div class="row end"><button class="btn" id="rqlater">Decide later</button><button class="btn primary" id="rqall"' + (st.waiting.length ? '' : ' hidden') + '>✓ Send all of them</button></div>', function (d) {
        var host = d.querySelector('#rq'), redraw = function () { remState().then(function (s2) { st = s2; host.innerHTML = (st.waiting.length ? st.waiting.map(groupRow).join('') : '<p class="muted">All decided. Thank you!</p>') + (st.sugg.length ? '<h3>Suggested dates</h3><p class="small muted">Coming up in the app, not on the reminder list yet.</p>' + st.sugg.map(suggRow).join('') : ''); d.querySelector('#rqall').hidden = !st.waiting.length; wireRem(host, st, redraw); }); };
        redraw();
        d.querySelector('#rqlater').onclick = function () { d.close(); };
        d.querySelector('#rqall').onclick = function () {
          var b = d.querySelector('#rqall'); b.disabled = true;
          st.waiting.reduce(function (p, g) { return p.then(function () { return decide(st, g.gk, true); }); }, Promise.resolve())
            .then(function () { return T.saveShow('Reminders approved'); }).then(function () { return T.syncReminders(true); }).then(function () { b.disabled = false; redraw(); }, function (e) { b.disabled = false; T.toast(e.message || String(e), 5000); });
        };
      });
    }).catch(function () {});
  };
  var remTimer = null;
  T.mailAfterSave = function () {
    clearTimeout(remTimer); remTimer = setTimeout(function () { T.syncReminders().catch(function () {}); }, 8000);      // reminders follow what was just saved
    if (busy || !T.show || !T.proof || !M().on) return;
    var now = snap(), seen = M().seen;
    if (!seen) { M().seen = now; return; }
    var ev = C.diff(seen, now, T.show, helpers()).filter(function (e) { return !pending.some(function (p) { return p.id === e.id; }); });
    if (!ev.length && !pending.length) return;
    pending = pending.concat(ev); card();
  };
  function done(list) {      // mark as seen (sent or skipped) and save quietly
    busy = true; var now = snap(), seen = M().seen || now;
    ['news', 'need', 'video', 'week', 'perf'].forEach(function (k) { seen[k] = now[k]; });
    seen.cast = now.cast; M().seen = seen; pending = [];
    var c = document.getElementById('mailcard'); if (c) c.remove();
    return T.saveShow(list).finally(function () { busy = false; });
  }
  function card() {
    var c = document.getElementById('mailcard');
    if (!c) { c = document.createElement('div'); c.id = 'mailcard'; c.className = 'card'; c.setAttribute('role', 'status'); c.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:50;width:min(560px,94vw);box-shadow:0 8px 30px rgba(0,0,0,.35);margin:0'; document.body.appendChild(c); }
    c.innerHTML = '<b>' + sym('📧') + 'Email about what’s new?</b><div class="small" style="margin:6px 0">' + pending.slice(0, 4).map(function (e) { return esc(C.KINDS[e.kind].icon + ' ' + e.title); }).join('<br>') + (pending.length > 4 ? '<br>and ' + (pending.length - 4) + ' more' : '') + '</div>' +
      '<div class="row end"><button class="btn" id="mskip">Not this time</button><button class="btn primary" id="mpick">Choose who gets it</button></div>';
    c.querySelector('#mskip').onclick = function () { done('No emails sent'); };
    c.querySelector('#mpick').onclick = function () { chooser(pending.slice()); };
  }
  function chooser(events) {
    var picks = {};
    events.forEach(function (e) {
      var d = M().picks[e.kind] || C.KINDS[e.kind].def; picks[e.id] = { a: !!d.a, m: e.actors ? !!d.a : !!d.m, p: !!d.p };
      if (e.to) { var st = e.to !== 'parents', pa = e.to !== 'students'; picks[e.id] = { a: st, m: st, p: pa }; }      // an announcement: the people it was posted for
    });
    var box = function (e, k, label) { return '<label style="display:inline-flex;gap:6px;align-items:center;margin-right:14px;font-weight:400"><input type="checkbox" data-e="' + esc(e.id) + '" data-k="' + k + '"' + (picks[e.id][k] ? ' checked' : '') + ' style="width:24px;height:24px">' + label + '</label>'; };
    T.dialog('<h2>' + sym('📧') + 'Who gets an email?</h2><p class="muted small">Everyone ticked gets one email with everything new for them, and a link to open it. Parents only get what they asked for in the Family portal; parents who asked for copies get a copy of what their Company member gets.</p>' +
      events.map(function (e) {
        var K = C.KINDS[e.kind];
        return '<div style="border-bottom:1px solid var(--line);padding:8px 0"><b>' + esc(K.icon + ' ' + e.title) + '</b>' + (e.text ? '<div class="small muted">' + esc(e.text) + '</div>' : '') +
          '<div style="margin-top:6px">' + (e.actors ? box(e, 'a', e.actors.length > 1 ? 'The ' + e.actors.length + ' Company members in it' : 'The Company member') : box(e, 'a', 'Company Artists') + box(e, 'm', 'Company Mentors')) + box(e, 'p', e.actors ? 'Their parents' : 'Parents') + '</div></div>';
      }).join('') +
      '<label class="switch"><span>Remember these choices for next time</span><input type="checkbox" id="mrem" checked></label>' +
      '<p id="mst" class="small" role="status"></p><div class="row end"><button class="btn" id="mx">Back</button><button class="btn" id="mno">Send nothing</button><button class="btn primary" id="mgo">Send</button></div>', function (d) {
      d.querySelectorAll('input[data-e]').forEach(function (i) { i.onchange = function () { var p = picks[i.dataset.e]; p[i.dataset.k] = i.checked; if (i.dataset.k === 'a' && events.some(function (e) { return e.id === i.dataset.e && e.actors; })) p.m = i.checked; }; });      // one box for the Company members an email is about
      d.querySelector('#mx').onclick = function () { d.close(); };
      d.querySelector('#mno').onclick = function () { d.close(); done('No emails sent'); };
      d.querySelector('#mgo').onclick = function () {
        var st = d.querySelector('#mst'), go = d.querySelector('#mgo'); go.disabled = true; st.textContent = 'Sending…';
        if (d.querySelector('#mrem').checked) events.forEach(function (e) { M().picks[e.kind] = picks[e.id]; });
        send(events, picks).then(function (r) {
          d.close(); done(r.none ? 'Nobody to email yet (no addresses for those people)' : r.sent + ' email' + (r.sent === 1 ? '' : 's') + ' sent' + (r.skipped ? ', ' + r.skipped + ' unsubscribed' : ''));
        }, function (e) { go.disabled = false; st.textContent = e.message || String(e); st.className = 'err'; });
      };
    });
  }

  /* ---------- Teacher › Emails ---------- */
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.emails = function () {
    T.setBar('Emails', '#/teacher');
    var vm = null;
    function draw() {
      var m = M(), cast = (T.show.cast || []).filter(function (a) { return !a.guest; }).slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      var nPar = 0; Object.keys(vm.portal).forEach(function (id) { nPar += (vm.portal[id].contacts || []).length; });
      app.innerHTML = '<div class="card"><h2 style="margin-top:0">' + sym('📧') + 'Notification emails</h2>' +
        '<p class="small">When you save something new (news for families, a volunteer need, a dance video you OK, a week shown on the calendar, a performance, a role, a song or a solo line), a card asks whether to email about it, and to whom: Company Artists, Company Mentors, parents. Emails come from your school Google account and have a link straight to the page.</p>' +
        '<label class="switch"><span><b>Ask me after I save something new</b></span><input type="checkbox" id="eon"' + (m.on ? ' checked' : '') + '></label>' +
        '<label class="f">Sign the emails as<input id="esign" maxlength="80" value="' + esc(m.sign || '') + '" placeholder="e.g. Ms. Elyse, Theatre"></label></div>' +
        '<div class="card"><h3 style="margin-top:0">' + sym('🔧') + 'The email script (one time)</h3>' +
        '<p class="small">' + (vm.url && vm.key ? '✅ Connected.' : 'Not connected yet. Follow the steps you were given to set up the email script in your school Google account, then paste its two pieces here.') + '</p>' +
        '<label class="f">Web app address<input id="eurl" value="' + esc(vm.url) + '" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>' +
        '<label class="f">Key (from the script’s “setup” log)<input id="ekey" value="' + esc(vm.key) + '" autocomplete="off" autocapitalize="off" spellcheck="false"></label>' +
        '<div class="row end"><button class="btn primary" id="esave" data-save>Save</button></div>' +
        '<div class="row" style="flex-wrap:wrap"><label class="f grow" style="margin:0">Send a test email to<input id="etest" type="email" placeholder="you@school.org"></label><button class="btn" id="etgo">Send a test</button></div><p id="est" class="small" role="status"></p></div>' +
        '<div id="gcard"></div><div class="card"><h3 style="margin-top:0">' + sym('✍️') + 'Write an email now</h3>' +
        '<label class="f">Subject<input id="wt" maxlength="120" placeholder="e.g. Costume pieces due Friday"></label><label class="f">Message<textarea id="wx" maxlength="1500"></textarea></label>' +
        '<label class="f">The link opens<select id="wp">' + [['#/home', 'Their home page'], ['#/today', 'Today'], ['#/calendar', 'Calendar'], ['#/schedule', 'My Schedule'], ['#/songs', 'My Songs'], ['#/costumes', 'My Costumes'], ['#/help', 'Volunteer and donate (parents)']].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<div class="row end"><button class="btn primary" id="wgo">Choose who gets it…</button></div></div>' +
        '<div class="card"><h3 style="margin-top:0">' + sym('👥') + 'Who can get emails</h3><p class="small">' + nPar + ' parent address' + (nPar === 1 ? '' : 'es') + ' from the Family portal (parents add or change theirs there). Company members’ school emails, typed once here (only Teacher mode sees them):</p>' +
        '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Company member</th><th>School email</th><th>Parents</th></tr></thead><tbody>' + cast.map(function (a) {
          var cs = (vm.portal[a.id] || {}).contacts || [];
          return '<tr><td><b>' + esc(a.name) + '</b> ' + T.companyTag(a) + '</td><td><input data-se="' + esc(a.id) + '" type="email" value="' + esc(vm.student[a.id] || '') + '" placeholder="' + esc(a.emailHint || '') + '" style="width:100%;min-width:180px;min-height:40px;border-radius:10px;border:2px solid var(--line);background:var(--card);padding:4px 8px"></td>' +
            '<td class="small">' + (cs.length ? cs.map(function (c) { return esc(c.name || '') + ' &lt;' + esc(c.email) + '&gt;' + (c.google ? ' <span class="tag ok-tag" title="Signed in with Google">G ✓</span>' : '') + ' <span class="muted">' + ['general', 'mine', 'copies'].filter(function (k) { return c.opts && c.opts[k]; }).map(function (k) { return { general: 'news', mine: 'changes', copies: 'copies' }[k]; }).join(', ') + '</span>'; }).join('<br>') : '<span class="muted">—</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div><div class="row end"><button class="btn primary" id="ese" data-save>Save school emails</button></div><p id="esst" class="small" role="status"></p></div>' +
        '<div class="card" id="remcard"><h3 style="margin-top:0">' + sym('⏰') + 'Reminder emails</h3>' +
        '<p class="small">Families get a reminder before each date they committed to: the show-week dates below (families who signed the show-week commitment; a date ending in “(all families)” goes to every family with an email) and the date of any need they signed up for on Volunteer and donate (with what they’re bringing). <b>Nothing is sent until you OK it</b>: when you open Teacher mode, the app asks about the reminders for the coming week. Your school account sends the ones you OK’d that morning.</p><div id="rappr"></div>' +
        '<label class="switch"><span><b>Send reminder emails</b></span><input type="checkbox" id="ron"' + (m.remOff ? '' : ' checked') + '></label>' +
        '<label class="f">Days before each date<input id="rdays" value="' + esc(remDays().join(', ')) + '" placeholder="7, 2, 1"></label>' +
        '<label class="f">Show-week dates (one per line: the date, then what it is)<textarea id="rdates" rows="6">' + esc(C.datesText(remDates())) + '</textarea></label>' +
        '<div class="row end"><button class="btn" id="rreset">Back to the starting dates</button><button class="btn primary" id="rsave" data-save>Save and update the reminders</button></div>' +
        '<p id="rst" class="small" role="status"></p><div id="rlist"></div></div>' +
        '<div class="card"><h3 style="margin-top:0">' + sym('🗂️') + 'Sent</h3>' + (m.log.length ? m.log.map(function (l) { return '<p class="small"><b>' + esc(new Date(l.at).toLocaleString()) + '</b> · ' + l.n + ' email' + (l.n === 1 ? '' : 's') + '<br>' + esc(l.title) + '</p>'; }).join('') : '<p class="muted small">Nothing sent yet.</p>') + '</div>';
      if (T.googleCard) T.googleCard(document.getElementById('gcard'));
      var remShow = function (msg) {
        var L = T.ls('remLast'), st = document.getElementById('rst'), box = document.getElementById('rlist'); if (!st) return;
        st.textContent = msg || (L ? 'Last updated ' + new Date(L.at).toLocaleString() + ': ' + L.n + ' reminder' + (L.n === 1 ? '' : 's') + ' you OK’d waiting to be sent.' : '');
        if (L && L.daily === -1) st.innerHTML += ' <b class="err">The email script needs one more OK: open it, choose “setup”, click Run, and allow it (this turns on the morning sending).</b>';
        else if (L && L.daily === 0) st.innerHTML += ' <b class="err">The morning sending is not on yet: open the email script, choose “setup”, and click Run.</b>';
        box.innerHTML = L && L.list && L.list.length ? '<details class="small"><summary>See the reminders you OK’d</summary><table class="tbl"><thead><tr><th>Sends</th><th>To</th><th>Subject</th></tr></thead><tbody>' +
          L.list.map(function (r) { return '<tr><td>' + esc(r.on) + '</td><td>' + esc(r.to) + '</td><td>' + esc(r.subject) + '</td></tr>'; }).join('') + '</tbody></table></details>' : '';
      };
      remShow(); if (T.remApprovals) T.remApprovals(document.getElementById('rappr'));
      document.getElementById('ron').onchange = function () { if (this.checked) delete M().remOff; else M().remOff = true; T.saveShow(this.checked ? 'Reminder emails on' : 'Reminder emails off'); };
      document.getElementById('rreset').onclick = function () { document.getElementById('rdates').value = C.datesText(C.DEF_DATES); document.getElementById('rdays').value = '7, 2, 1'; };
      document.getElementById('rsave').onclick = function () {
        var pd = C.parseDates(document.getElementById('rdates').value), days = document.getElementById('rdays').value.split(/[^\d]+/).map(Number).filter(function (n) { return n > 0 && n <= 60; });
        if (pd.bad.length) { remShow('These lines need a date first, like 12/7/2027: ' + pd.bad.join(' · ')); return; }
        if (!days.length) { remShow('Type how many days before, like 7, 2, 1.'); return; }
        M().dates = pd.dates; M().remDays = days.filter(function (n, i, a) { return a.indexOf(n) === i; }).sort(function (a, b) { return b - a; });
        remShow('Saving…');
        T.saveShow('Reminder dates saved').then(function () { return T.syncReminders(true); }).then(function (d) { remShow(d ? null : 'Connect the email script above first.'); T.remApprovals(document.getElementById('rappr')); }, function (e) { remShow(e.message || String(e)); });
      };
      document.getElementById('eon').onchange = function () { var on = this.checked; M().on = on; if (on && !M().seen) M().seen = snap(); T.saveShow(on ? 'You will be asked after saving something new' : 'Emails off'); };
      document.getElementById('esign').onchange = function () { M().sign = this.value.trim().slice(0, 80); T.saveShow('Saved'); };
      document.getElementById('esave').onclick = function () {
        var u = document.getElementById('eurl').value.trim(), k = document.getElementById('ekey').value.trim();
        if (u && !/^https:\/\/script\.google\.com\/|^http:\/\/localhost[:/]/.test(u)) { T.toast('That address should start with https://script.google.com/', 4000); return; }
        T.withVault(function (V) { var x = V.extra.mail = V.extra.mail || {}; x.url = u; x.key = k; })
          .then(function () { if (u && k && !M().on) { M().on = true; M().seen = snap(); } return T.saveShow('Email script saved'); }).then(load);
      };
      document.getElementById('etgo').onclick = function () {
        var to = document.getElementById('etest').value.trim(), st = document.getElementById('est');
        if (!C.okEmail(to)) { st.textContent = 'Type an email address first.'; return; }
        if (!vm.url || !vm.key) { st.textContent = 'Save the web app address and key first.'; return; }
        st.textContent = 'Sending…';
        sig(vm.key, to).then(function (s) { return post(vm, [C.compose({ to: to, name: '', items: [{ e: { title: 'A test email', text: 'If you can read this, notification emails work.', page: '#/home' }, copyOf: '' }] }, { title: T.O().title, base: location.origin + '/theatre/', sign: M().sign || '', unsub: vm.url + '?u=' + s })]); })
          .then(function (r) { st.textContent = r.sent ? '✅ Sent. Check that inbox (and its spam folder).' + (r.quota != null ? ' You can send about ' + r.quota + ' more today.' : '') : 'Not sent: that address unsubscribed.'; }, function (e) { st.textContent = e.message || String(e); });
      };
      document.getElementById('wgo').onclick = function () {
        var t = document.getElementById('wt').value.trim(); if (!t) { T.toast('Type a subject first.'); return; }
        chooser([{ id: 'note:' + Date.now().toString(36), kind: 'note', title: t.slice(0, 120), text: document.getElementById('wx').value.trim().slice(0, 1500), page: document.getElementById('wp').value, actors: null }]);
      };
      document.getElementById('ese').onclick = function () {
        var bad = [], vals = {};
        app.querySelectorAll('[data-se]').forEach(function (i) { var v = i.value.trim(); if (v && !C.okEmail(v)) bad.push(v); else if (v) vals[i.dataset.se] = v; });
        if (bad.length) { document.getElementById('esst').textContent = 'These don’t look like email addresses: ' + bad.join(', '); return; }
        T.withVault(function (V) { var x = V.extra.mail = V.extra.mail || {}; x.students = vals; }).then(function () { return T.saveShow('School emails saved'); }).then(load);
      };
    }
    function load() { return vaultMail().then(function (x) { vm = x; draw(); }); }
    app.innerHTML = '<p class="card muted">Opening…</p>';
    load().catch(function (e) { app.innerHTML = '<p class="card err">' + esc(e.message || e) + '</p>'; });
  };
})();
