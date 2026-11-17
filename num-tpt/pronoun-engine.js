/* ASL pronoun drills: the game logic (Colleen, 2026-10-17; spec: dev/pronoun-drills/CLAUDE_BUILD_BRIEF_ASL_PRONOUN_DRILLS.md).
   No camera and no page here: the bank check, the gesture meanings, the feedback wording, and a Round that is driven by
   timestamped events (gesture onsets from the recognizer, and clock ticks), so the same code is tested in Node (dev/pronoun-test.js).
   One clock for everything: the caller passes performance.now() (or a fake clock in tests), never camera frame counts. */
(function (root) {
  'use strict';
  var GESTURES = {
    POINT_SELF: { shape: 'point', dir: 'self', sign: 'ME', how: 'point to yourself' },
    FLAT_SELF: { shape: 'flat', dir: 'self', sign: 'MY', how: 'flat hand on your chest' },
    POINT_OUT: { shape: 'point', dir: 'out', sign: 'YOU', how: 'point toward the other person' },
    FLAT_OUT: { shape: 'flat', dir: 'out', sign: 'YOUR', how: 'flat hand, palm toward the other person' }
  };
  var DRILLS = { I_ME_MY: 'I / ME / MY', YOUR_YOURE: "YOUR / YOU'RE", MIXED: 'Mixed Challenge' };
  /* Pace: how the round waits. deadline = seconds to sign after the target is reached (null = no limit). */
  var PACES = {
    beginner: { name: 'Beginner', deadline: null, holdUntilRight: true, explain: false },
    intermediate: { name: 'Intermediate', deadline: 12, holdUntilRight: false, explain: true },
    practice: { name: 'Practice (5 s)', deadline: 5, holdUntilRight: false, explain: false },
    developing: { name: 'Developing (3 s)', deadline: 3, holdUntilRight: false, explain: false },
    fluent: { name: 'Fluent (1.5 s)', deadline: 1.5, holdUntilRight: false, explain: false },
    interpreter: { name: 'Interpreter Speed', deadline: 0.75, holdUntilRight: false, explain: false, continuous: true }
  };

  /* The bank: every target's text must sit exactly at its start/end (no find-and-replace at run time). */
  function validateBank(bank) {
    var errors = [], ok = [];
    if (!bank || !Array.isArray(bank.sentences)) return { ok: [], errors: ['No sentences array.'] };
    bank.sentences.forEach(function (s) {
      var bad = '';
      if (!s || !s.id || typeof s.sentence !== 'string' || !Array.isArray(s.targets) || !s.targets.length) bad = 'missing fields';
      else if (!DRILLS[s.drill]) bad = 'unknown drill ' + s.drill;
      else s.targets.forEach(function (t, i) {
        if (bad) return;
        if (!GESTURES[t.gesture]) bad = 'target ' + i + ': unknown gesture ' + t.gesture;
        else if (s.sentence.slice(t.start, t.end) !== t.text) bad = 'target ' + i + ': "' + s.sentence.slice(t.start, t.end) + '" is not "' + t.text + '"';
        else if (i && t.start < s.targets[i - 1].end) bad = 'target ' + i + ': overlaps or out of order';
      });
      if (bad) errors.push((s && s.id || '?') + ': ' + bad); else ok.push(s);
    });
    return { ok: ok, errors: errors };
  }
  function pick(sentences, o) {
    o = o || {};
    var list = sentences.filter(function (s) { return (!o.drill || s.drill === o.drill) && (!o.difficulty || s.difficulty === o.difficulty); });
    if (o.shuffle) { list = list.slice(); for (var i = list.length - 1; i > 0; i--) { var j = Math.floor((o.rand || Math.random)() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; } }
    return list;
  }

  /* What kind of mistake (only when the camera is confident about what was signed). */
  function errorType(expected, detected) {
    if (!detected || detected === expected) return null;
    var e = GESTURES[expected], d = GESTURES[detected];
    if (!e || !d) return null;
    return e.shape !== d.shape && e.dir !== d.dir ? 'both_wrong' : e.shape !== d.shape ? 'wrong_handshape' : 'wrong_direction';
  }
  /* Short, specific feedback for a 15-year-old: what they signed, what fits, and why (the brief's wording). */
  function explain(expected, detected, target) {
    var word = target && target.text ? target.text.toUpperCase() : GESTURES[expected].sign, why = target && target.explanation ? ' ' + target.explanation : '';
    var key = expected + '>' + detected, fixed = {
      'FLAT_SELF>FLAT_OUT': 'You signed YOUR. This is something belonging to the speaker, so use the flat hand toward yourself.',
      'FLAT_OUT>FLAT_SELF': 'You signed MY. The item belongs to the person being addressed, so direct the flat hand outward.',
      'POINT_OUT>FLAT_OUT': "You signed YOUR. YOU'RE means YOU ARE, not possession; point toward the person instead.",
      'POINT_SELF>POINT_OUT': 'You pointed at the other person, but I/ME refers to the signer. Point toward yourself.',
      'POINT_OUT>POINT_SELF': 'You pointed at yourself, but ' + word + ' means the other person. Point toward them.',
      'POINT_SELF>FLAT_SELF': 'You signed MY, but ' + word + ' is not about owning something. Point to yourself.',
      'FLAT_SELF>POINT_SELF': 'You pointed to yourself (ME), but MY shows something belongs to you. Use a flat hand on your chest.',
      'FLAT_OUT>POINT_OUT': 'You pointed (YOU), but YOUR shows something belongs to them. Use a flat hand, palm toward them.',
      'POINT_SELF>FLAT_OUT': 'You signed YOUR, but ' + word + ' means you, the signer. Point to yourself.',
      'POINT_OUT>FLAT_SELF': 'You signed MY, but ' + word + ' means the other person. Point toward them.',
      'FLAT_SELF>POINT_OUT': 'You pointed at the other person (YOU), but MY means it belongs to you. Flat hand on your chest.',
      'FLAT_OUT>POINT_SELF': 'You pointed at yourself (ME), but YOUR means it belongs to them. Flat hand, palm toward them.'
    };
    if (fixed[key]) return fixed[key];
    return 'For ' + word + ': ' + GESTURES[expected].how + '.' + why;
  }

  /* A Round: one sentence. Results per target: correct | wrong | timeout | not_confident (beginner never records not_confident).
     Events in: begin(now), reach(i, now) (the reading got to target i: the caller decides when, from speech or cadence),
     gesture({ g, conf, t }), tick(now), cameraLost(now) / cameraBack(now).
     Events out (returned arrays): { type: 'correct'|'wrong'|'timeout'|'retry'|'hint'|'explain'|'advance'|'done', i, ... }.
     Rules: one score per target; a sign before its target is reached never counts (no carry-over from the last target);
     beginner stays on a target until the right sign; intermediate accepts a confident wrong sign, explains, then advances;
     timed paces: wrong or late = quick red, then on; interpreter: the reading never waits (the caller keeps reaching targets on time). */
  function Round(sentence, opts) {
    opts = opts || {};
    var pace = PACES[opts.pace] || PACES.beginner, grace = (opts.grace == null ? 0.25 : opts.grace) * 1000;
    var deadlineMs = opts.deadline != null ? opts.deadline * 1000 : pace.deadline == null ? null : pace.deadline * 1000;
    var minConf = opts.minConf == null ? 0.6 : opts.minConf;
    var r = { sentence: sentence, pace: opts.pace || 'beginner', cur: -1, opened: [], wrongTries: [], results: sentence.targets.map(function () { return null; }), done: false, cameraOk: true, pausedAt: null };
    function res(i, kind, extra) { if (r.results[i]) return null; r.results[i] = Object.assign({ kind: kind, at: extra && extra.t || 0 }, extra || {}); return r.results[i]; }
    function allScored() { return r.results.every(function (x) { return !!x; }); }
    r.begin = function (now) { r.t0 = now; return []; };
    r.reach = function (i, now) {      // the reading reached target i (the caller only reaches i after i-1 is settled, except in interpreter)
      if (i < 0 || i >= sentence.targets.length || r.opened[i] != null) return [];
      r.opened[i] = now; r.cur = i; r.wrongTries[i] = 0; return [{ type: 'reach', i: i }];
    };
    r.gesture = function (ev) {
      var out = [];
      if (r.done || !ev || !ev.g) return out;
      var i = target(ev.t); if (i < 0) return out;      // no target open for this moment: stale or early, ignored
      var exp = sentence.targets[i].gesture;
      if ((ev.conf || 0) < minConf) { out.push({ type: 'retry', i: i }); return out; }      // not sure what was signed: never scored as a particular sign
      if (ev.g === exp) { res(i, 'correct', { t: ev.t, rt: ev.t - r.opened[i], got: ev.g }); out.push({ type: 'correct', i: i }); return out.concat(next(i, ev.t)); }
      var et = errorType(exp, ev.g);
      if (pace.holdUntilRight) {      // beginner: a wrong sign never completes the target
        r.wrongTries[i]++; out.push({ type: 'not_yet', i: i, got: ev.g, errorType: et });
        if (r.wrongTries[i] >= (opts.hintAfter || 2)) out.push({ type: 'hint', i: i, text: 'Hint: ' + GESTURES[exp].how + '.' });
        return out;
      }
      res(i, 'wrong', { t: ev.t, rt: ev.t - r.opened[i], got: ev.g, errorType: et, why: explain(exp, ev.g, sentence.targets[i]) });
      out.push({ type: 'wrong', i: i, got: ev.g, errorType: et, quick: !pace.explain });
      if (pace.explain) { out.push({ type: 'explain', i: i, text: explain(exp, ev.g, sentence.targets[i]) }); return out; }      // the caller advances after the reading time (or Continue)
      return out.concat(next(i, ev.t));
    };
    /* the open target for a gesture made at time t: reached at or before t, not yet scored, and still inside its window */
    function target(t) {
      for (var i = sentence.targets.length - 1; i >= 0; i--) {      // the most recently reached word first: a sign is for the word the student is on now
        if (r.opened[i] == null || r.results[i]) continue;
        if (t + 1 < r.opened[i]) continue;      // made before the target was reached: never counts for it
        if (deadlineMs != null && t > r.opened[i] + deadlineMs + grace) continue;
        return i;
      }
      return -1;
    }
    function next(i, now) {
      if (allScored()) { r.done = true; return [{ type: 'done' }]; }
      return pace.continuous ? [] : [{ type: 'advance', from: i }];
    }
    r.advanceAfterExplain = function (i, now) { return next(i, now); };
    r.tick = function (now) {
      var out = [];
      if (r.done || deadlineMs == null || !r.cameraOk) return out;
      for (var i = 0; i < sentence.targets.length; i++) {
        if (r.opened[i] == null || r.results[i]) continue;
        if (now > r.opened[i] + deadlineMs + grace) { res(i, 'timeout', { t: now }); out.push({ type: 'timeout', i: i, quick: true }); out = out.concat(next(i, now)); if (r.done) break; }
      }
      return out;
    };
    /* camera trouble never fails a student: the clock stops for open targets and starts again when the camera is back */
    r.cameraLost = function (now) { if (!r.cameraOk) return []; r.cameraOk = false; r.pausedAt = now; return [{ type: 'camera_lost' }]; };
    r.cameraBack = function (now) {
      if (r.cameraOk) return []; var gap = now - (r.pausedAt || now); r.cameraOk = true; r.pausedAt = null;
      for (var i = 0; i < r.opened.length; i++) if (r.opened[i] != null && !r.results[i]) r.opened[i] += gap;
      return [{ type: 'camera_back' }];
    };
    r.summary = function () {
      var n = r.results.length, c = r.results.filter(function (x) { return x && x.kind === 'correct'; });
      var rts = r.results.filter(function (x) { return x && x.rt != null && x.kind === 'correct'; }).map(function (x) { return x.rt; });
      return { n: n, correct: c.length, wrong: r.results.filter(function (x) { return x && x.kind === 'wrong'; }).length, timeout: r.results.filter(function (x) { return x && x.kind === 'timeout'; }).length,
        avgRt: rts.length ? Math.round(rts.reduce(function (a, b) { return a + b; }, 0) / rts.length) : null, results: r.results };
    };
    return r;
  }

  /* A teacher's sheet (ASL_Pronoun_Practice_Teacher_Editable.xlsx layout): targets are listed IN ORDER by word, not by position.
     Each target word is found as a whole word, case-insensitive, starting after the previous target (so "my ... my" is two targets
     and "your" is never found inside "you're"). A sentence whose words can't be found in order is left out, with a note. */
  function resolveTargets(sentence, words) {
    var at = 0, out = [];
    for (var i = 0; i < words.length; i++) {
      var w = String(words[i].text || '').trim(); if (!w) return { error: 'target ' + (i + 1) + ' is empty' };
      var re = new RegExp("(^|[^A-Za-z'\u2019])(" + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['\u2019]") + ")(?![A-Za-z'\u2019])", 'i');
      var m = re.exec(sentence.slice(at)); if (!m) return { error: 'could not find "' + w + '" (target ' + (i + 1) + ') after the earlier targets' };
      var start = at + m.index + m[1].length, end = start + m[2].length;
      out.push({ text: sentence.slice(start, end), start: start, end: end, gesture: words[i].gesture, explanation: words[i].explanation || '' });
      at = end;
    }
    return { targets: out };
  }
  /* rows: Sentence Bank [{ id, drill, difficulty, sentence, enabled }] + Target Details [{ id, n, text, gesture, explanation }] -> a bank */
  function bankFromSheet(sentRows, targetRows) {
    var by = {}, notes = [];
    targetRows.forEach(function (t) { (by[t.id] = by[t.id] || []).push(t); });
    var sentences = [];
    sentRows.forEach(function (r) {
      if (!r.id || !r.sentence || /^no$/i.test(String(r.enabled || '').trim())) return;
      var list = (by[r.id] || []).slice().sort(function (a, b) { return (+a.n || 0) - (+b.n || 0); });
      if (!list.length) { notes.push(r.id + ': no Target Details rows'); return; }
      var got = resolveTargets(String(r.sentence), list);
      if (got.error) { notes.push(r.id + ': ' + got.error); return; }
      sentences.push({ id: r.id, drill: r.drill, difficulty: r.difficulty, sentence: String(r.sentence), targets: got.targets });
    });
    var v = validateBank({ sentences: sentences });
    return { schemaVersion: 1, sentences: v.ok, notes: notes.concat(v.errors) };
  }

  /* Tokens for display: the sentence cut at the exact target offsets (never a substring search). */
  function tokens(s) {
    var out = [], at = 0;
    s.targets.forEach(function (t, i) { if (t.start > at) out.push({ text: s.sentence.slice(at, t.start) }); out.push({ text: s.sentence.slice(t.start, t.end), target: i }); at = t.end; });
    if (at < s.sentence.length) out.push({ text: s.sentence.slice(at) });
    return out;
  }
  /* Authoring help: find the supported trigger words in a new sentence and suggest a gesture; a person reviews before saving. */
  var TRIGGERS = [[/\bI'm\b/g, 'POINT_SELF'], [/\bI\b(?!')/g, 'POINT_SELF'], [/\bme\b/gi, 'POINT_SELF'], [/\bmy\b/gi, 'FLAT_SELF'], [/\byou're\b/gi, 'POINT_OUT'], [/\byour\b/gi, 'FLAT_OUT'], [/\byou\b(?!['r])/gi, 'POINT_OUT']];
  function suggestTargets(sentence) {
    var found = [];
    TRIGGERS.forEach(function (tr) { var m; tr[0].lastIndex = 0; while ((m = tr[0].exec(sentence))) { if (!found.some(function (f) { return m.index < f.end && m.index + m[0].length > f.start; })) found.push({ text: m[0], start: m.index, end: m.index + m[0].length, gesture: tr[1], explanation: '' }); } });
    return found.sort(function (a, b) { return a.start - b.start; });
  }

  var API = { resolveTargets: resolveTargets, bankFromSheet: bankFromSheet, GESTURES: GESTURES, DRILLS: DRILLS, PACES: PACES, validateBank: validateBank, pick: pick, errorType: errorType, explain: explain, Round: Round, tokens: tokens, suggestTargets: suggestTargets };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PRONOUN = API;
})(typeof window !== 'undefined' ? window : this);
