/* asl.cool/theatre/crew: the Tech Week Crew questionnaire, for volunteers from other classes (no password). The questions come from api.js crew/form;
   the answers are sealed here with the teacher's public key (CrewCore.seal) and sent to crew/in. A copy stays in this browser (localStorage
   theatre:crewDraft) so a volunteer can come back and change their answers; sending again replaces the earlier ones (same email). See js/crew.js. */
(function () {
  'use strict';
  var C = window.CrewCore, app = document.getElementById('app'), API = '/theatre/api/', F = null;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ls = function (k, v) { try { if (v === undefined) { var s = localStorage.getItem('theatre:' + k); return s ? JSON.parse(s) : null; } if (v === null) localStorage.removeItem('theatre:' + k); else localStorage.setItem('theatre:' + k, JSON.stringify(v)); } catch (e) { return null; } };
  var a = ls('crewDraft') || { ans: {}, why: {}, jobs: [] };
  a.ans = a.ans || {}; a.why = a.why || {}; a.jobs = a.jobs || [];
  var longDay = function (d) { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); };

  fetch(API + 'crew/form', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (f) {
    if (!f || !f.pub) { app.innerHTML = '<div class="card"><h2>Not open yet</h2><p>This form isn’t ready yet. Please check back soon, or ask the theatre teacher.</p></div>'; return; }
    F = f; document.title = 'Tech Week Crew · ' + f.title; document.getElementById('title').textContent = 'Tech Week Crew';
    if (!f.open) { app.innerHTML = '<div class="card"><h2>Thank you!</h2><p>Our crew is full for ' + esc(f.title) + '. Thank you for wanting to help!</p></div>'; return; }
    draw();
  }, function () { app.innerHTML = '<div class="card"><h2>No connection</h2><p>The form could not load. Check the internet and try again.</p></div>'; });

  function dateQ(d, thu) {
    var ch = thu ? C.THU_CHOICE : C.CHOICE, v = a.ans[d.id];
    return '<div class="q" data-q="' + esc(d.id) + '"><p style="margin:0 0 8px"><b>' + esc(longDay(d.date)) + '</b><br>' + esc(d.what) + (d.optional ? ' <span class="muted small">(optional)</span>' : '') + '</p>' +
      '<div class="seg" role="group">' + ['y', 'm', 'n'].map(function (k) { return '<button type="button" data-v="' + k + '" aria-pressed="' + (v === k) + '">' + esc(ch[k]) + '</button>'; }).join('') + '</div>' +
      '<label class="f" data-why' + (v && v !== 'y' ? '' : ' hidden') + '>Why? What gets in the way? <span class="need">(required)</span><input maxlength="200" value="' + esc(a.why[d.id] || '') + '"></label></div>';
  }
  function draw() {
    var f = F;
    app.innerHTML =
      '<div class="card"><h2>' + esc(f.title) + ': Tech Week Crew</h2><p>' + esc(f.intro) + '</p>' + (f.due ? '<p><b>Please answer by ' + esc(longDay(f.due)) + '.</b></p>' : '') +
      '<p class="muted small">🔒 Your answers go only to the theatre teachers.</p></div>' +
      '<div class="card"><h3>About you</h3>' +
      '<label class="f">Your first and last name <span class="need">*</span><input id="nm" maxlength="80" autocomplete="name" value="' + esc(a.name || '') + '"></label>' +
      '<label class="f">Grade<select id="gr">' + ['', '9', '10', '11', '12', 'Other'].map(function (g) { return '<option' + (a.grade === g ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Your school email <span class="need">*</span><input id="em" type="email" maxlength="120" autocomplete="email" value="' + esc(a.email || '') + '"></label>' +
      '<div class="q" data-q="src"><p style="margin:0"><b>How did you hear about the crew?</b> <span class="need">*</span></p><div class="src">' +
      C.SOURCES.map(function (s) { return '<label><input type="radio" name="src" value="' + s[0] + '"' + (a.src === s[0] ? ' checked' : '') + '>' + esc(s[1]) + '</label>'; }).join('') + '</div>' +
      '<label class="f" id="srcT"' + (a.src === 'rec' || a.src === 'other' ? '' : ' hidden') + '><span id="srcL">' + (a.src === 'rec' ? 'Which teacher?' : 'Tell us more') + '</span> <span class="need">(required)</span><input maxlength="120" value="' + esc(a.srcText || '') + '"></label></div></div>' +
      (f.rehearsals.length ? '<div class="card"><h3>Rehearsals</h3><p class="small">Please answer every date.</p>' + f.rehearsals.map(function (d) { return dateQ(d); }).join('') + '</div>' : '') +
      (f.thu.length ? '<div class="card"><h3>The school-day shows</h3><p class="small">Crew members are excused from their classes for this one day. Can you miss the whole school day?</p>' + f.thu.map(function (d) { return dateQ(d, true); }).join('') + '</div>' : '') +
      (f.shows.length ? '<div class="card"><h3>Evening performances</h3>' + f.shows.map(function (d) { return dateQ(d); }).join('') + '</div>' : '') +
      '<div class="card"><h3>Ways you could help</h3><p class="small">Read the whole list, then tick anything you’d like to do.</p><div class="jobs">' +
      f.jobs.map(function (j) { return '<label><input type="checkbox" value="' + esc(j.id) + '"' + (a.jobs.indexOf(j.id) >= 0 ? ' checked' : '') + '><span>' + esc(j.name) + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="q" data-q="story" style="border:0;padding:0"><label class="f">Tell us about yourself <span class="need">*</span><span class="small" style="display:block;font-weight:400">In a few sentences: what you’re good at, what you’d like to do from the list, and any experience you have. None is fine!</span><textarea id="st" maxlength="2000">' + esc(a.story || '') + '</textarea></label></div>' +
      '<label class="f">Is there anything you know you would really NOT enjoy, or would not be good at? (optional)<textarea id="nf" maxlength="600" style="min-height:80px">' + esc(a.notFor || '') + '</textarea></label>' +
      '<label class="f">Food allergies or a special diet, for the crew dinners (optional)<input id="fo" maxlength="300" value="' + esc(a.food || '') + '"></label>' +
      '<label class="f">Anything else? (optional)<textarea id="cm" maxlength="600" style="min-height:80px">' + esc(a.comments || '') + '</textarea></label>' +
      '<label class="hp" aria-hidden="true">Leave this empty<input id="hp" tabindex="-1" autocomplete="off"></label>' +
      '<p id="err" class="err" role="alert"></p><div class="row end"><button class="btn primary" id="send">Send my answers</button></div></div>';

    app.querySelectorAll('.q[data-q] .seg').forEach(function (seg) {
      var q = seg.closest('.q'), id = q.dataset.q;
      seg.querySelectorAll('button').forEach(function (b) { b.onclick = function () {
        a.ans[id] = b.dataset.v; seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        var w = q.querySelector('[data-why]'); w.hidden = b.dataset.v === 'y'; if (!w.hidden) w.querySelector('input').focus();
        q.classList.remove('miss'); keep();
      }; });
      q.querySelector('[data-why] input').oninput = function () { a.why[id] = this.value; keep(); };
    });
    app.querySelectorAll('input[name=src]').forEach(function (r) { r.onchange = function () {
      a.src = r.value; var t = document.getElementById('srcT'); t.hidden = !(a.src === 'rec' || a.src === 'other');
      document.getElementById('srcL').textContent = a.src === 'rec' ? 'Which teacher?' : 'Tell us more'; if (!t.hidden) t.querySelector('input').focus(); keep();
    }; });
    app.oninput = function () { keep(); };
    document.getElementById('send').onclick = send;
  }
  /* read the boxes into a, and keep a copy on this device */
  function read() {
    var v = function (id) { return document.getElementById(id).value; };
    a.name = v('nm'); a.grade = v('gr'); a.email = v('em'); a.story = v('st'); a.notFor = v('nf'); a.food = v('fo'); a.comments = v('cm');
    a.srcText = document.querySelector('#srcT input').value;
    a.jobs = [].map.call(app.querySelectorAll('.jobs input:checked'), function (x) { return x.value; });
  }
  function keep() { read(); ls('crewDraft', a); }
  function send() {
    read(); var err = document.getElementById('err'), b = document.getElementById('send');
    var ans = C.clean(F, a), miss = C.missing(F, ans);
    app.querySelectorAll('.miss').forEach(function (x) { x.classList.remove('miss'); });
    if (miss.length) {
      var first = null, say = [];
      miss.forEach(function (m) {
        var el = m === 'name' ? document.getElementById('nm') : m === 'email' ? document.getElementById('em') : m === 'src' || m === 'srcText' ? app.querySelector('[data-q=src]') : m === 'story' ? app.querySelector('[data-q=story]') : app.querySelector('[data-q="' + m.split(':')[1] + '"]');
        if (el) { (el.classList.contains('q') ? el : el.closest('label')).classList.add('miss'); if (!first) first = el; }
      });
      if (miss.indexOf('name') >= 0) say.push('your first and last name');
      if (miss.indexOf('email') >= 0) say.push('your school email');
      if (miss.indexOf('src') >= 0) say.push('how you heard about the crew');
      if (miss.indexOf('srcText') >= 0) say.push(a.src === 'rec' ? 'which teacher recommended you' : 'a few words for “Other”');
      var nd = miss.filter(function (m) { return /^date:/.test(m); }).length, nw = miss.filter(function (m) { return /^why:/.test(m); }).length;
      if (nd) say.push('an answer for every date (' + nd + ' left)');
      if (nw) say.push('a reason for each Maybe or I can’t (' + nw + ' left)');
      if (miss.indexOf('story') >= 0) say.push('a few sentences about yourself');
      err.textContent = 'Please add ' + say.join(', ') + '.';
      if (first) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); var fb = first.matches('input,textarea') ? first : first.querySelector('button,input,textarea'); if (fb) fb.focus({ preventScroll: true }); }
      return;
    }
    if (document.getElementById('hp').value) { done(); return; }      // a robot filled the hidden box
    b.disabled = true; err.textContent = '';
    C.seal(F.pub, ans).then(function (box) { return fetch(API + 'crew/in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ box: box }) }); })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'The server said ' + r.status); }); })
      .then(function () { a.sent = new Date().toISOString(); ls('crewDraft', a); done(); }, function (e) { b.disabled = false; err.textContent = (e.message || String(e)) + ' Your answers are still here; try again.'; });
  }
  function done() {
    window.scrollTo(0, 0);
    app.innerHTML = '<div class="card"><h2>Thank you, ' + esc(String(a.name || '').split(/\s+/)[0]) + '! 🎭</h2><p>Your answers went to the theatre teachers. They will be in touch by email.</p>' +
      '<p class="small">Need to change something? Open this page again on this device: your answers will be here, and sending again replaces the ones before.</p><button class="btn" id="again">Change my answers</button></div>';
    document.getElementById('again').onclick = draw;
  }
})();
