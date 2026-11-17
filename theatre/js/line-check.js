/* Did the student say their line? Paraphrasing is allowed, so this checks for the line's meaning words
   (the nouns, verbs and names that carry it), not for every word in order.
   Speech recognition mishears names and endings, so words match loosely: same stem, one letter off, or same sound. */
(function (root) {
  'use strict';

  var STOP = ('a an the and or but so to of in on at for with from by as is am are was were be been being it its this that these those ' +
    'i me my mine you your yours he him his she her hers we us our they them their there here then than just very really ' +
    'do does did done have has had will would can could should shall may might must not no yes oh uh um well like ' +
    'what who whom which when where why how if all any some about up down out into over again too also only own same ' +
    'get got gonna going go let lets ok okay hey hi hello').split(' ');
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = 1; });
  /* words that keep the meaning even though they are small: negatives flip a line's meaning */
  var KEEP = { not: 1, no: 1, never: 1, nothing: 1, nobody: 1, yes: 1 };

  var CONTRACTIONS = [
    [/\bo['’]?\s?clock\b/g, ''],
    // speech recognition often drops apostrophes
    [/\b(do|does|did|is|are|was|were|could|would|should|have|has|had|must|need)nt\b/g, "$1n't"], [/\bdont\b/g, "don't"],
    [/\bcant\b/g, "can't"], [/\bwont\b/g, "won't"], [/\bim\b/g, "i'm"], [/\b(you|they|we)re\b/g, "$1're"], [/\bive\b/g, "i've"],
    [/\bwon['’]t\b/g, 'will not'], [/\bcan['’]t\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bain['’]t\b/g, 'is not'],
    [/n['’]t\b/g, ' not'], [/['’]re\b/g, ' are'], [/['’]m\b/g, ' am'], [/['’]ll\b/g, ' will'], [/['’]ve\b/g, ' have'],
    [/['’]d\b/g, ' would'], [/\blet['’]s\b/g, 'let us'], [/['’]s\b/g, ''],
    [/\bgonna\b/g, 'going to'], [/\bwanna\b/g, 'want to'], [/\bgotta\b/g, 'got to'], [/\bkinda\b/g, 'kind of'],
    [/\bya\b/g, 'you'], [/\b(?:yeah|yep|yup|yea)\b/g, 'yes'], [/\b(?:nope|nah)\b/g, 'no'], [/\bokay\b/g, 'ok'],
    [/\b(?:mom|mommy|mama)\b/g, 'mother'], [/\b(?:dad|daddy|papa)\b/g, 'father'], [/\b(?:hey|hi|hello)\b/g, 'hello'],
    [/\bguys\b/g, 'people'], [/\bkids\b/g, 'people']
  ];
  var NUMS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

  /* the words an actor actually says: drop stage directions in ( ) and [ ] */
  function spoken(text) {
    return String(text || '').replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalize(text) {
    var s = spoken(text).toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    CONTRACTIONS.forEach(function (c) { s = s.replace(c[0], c[1]); });
    s = s.replace(/\b(\d{1,2})\b/g, function (m, d) { return NUMS[+d] || d; });
    s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    return s ? s.split(' ') : [];
  }

  function stem(w) {
    if (w.length <= 3) return w;
    return w.replace(/(?:ing|edly|ed|ies|es|ly|s)$/, function (m) { return m === 'ies' ? 'y' : ''; }).replace(/(.)\1$/, '$1');
  }
  /* a rough sound key, so "Gabriella" heard as "gabriela" or "Kelsi" as "kelsey" still match */
  function sound(w) {
    var s = w.replace(/ph/g, 'f').replace(/ck|q/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/z/g, 's')
      .replace(/x/g, 'ks').replace(/wh/g, 'w').replace(/dg/g, 'j').replace(/gh/g, '').replace(/kn/g, 'n');
    return s[0] + s.slice(1).replace(/[aeiouyhw]/g, '').replace(/(.)\1+/g, '$1');
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function sameWord(a, b) {
    if (a === b) return true;
    var sa = stem(a), sb = stem(b);
    if (sa === sb) return true;
    if (sa.length >= 5 && sb.length >= 5 && lev(sa, sb) <= 1) return true;
    if (a.length >= 5 && b.length >= 5 && sound(a) === sound(b)) return true;
    if (sa.length >= 6 && sb.length >= 6 && (sa.indexOf(sb.slice(0, 5)) === 0 || sb.indexOf(sa.slice(0, 5)) === 0)) return true;
    return false;
  }
  function content(words) {
    var out = [];
    words.forEach(function (w) { if ((!STOPSET[w] || KEEP[w]) && out.indexOf(w) < 0) out.push(w); });
    return out;
  }

  /* settings.strictness: 'loose' | 'medium' | 'exact'. keyWords: words the teacher says must be there. */
  function check(target, heard, settings) {
    settings = settings || {};
    var strict = settings.strictness || 'medium';
    var tw = normalize(target), hw = normalize(heard);
    var res = { score: 0, verdict: 'miss', missing: [], heardWords: hw, targetWords: tw };
    if (!hw.length) { res.verdict = 'silent'; return res; }
    if (!tw.length) { res.verdict = 'pass'; res.score = 1; return res; }

    // word-for-word similarity, used for exact mode and for very short lines
    var seq = 1 - lev2(tw, hw) / Math.max(tw.length, hw.length);

    var key = content(tw);
    var must = (settings.keyWords || []).map(function (k) { return normalize(k).join(' '); }).filter(Boolean);
    if (key.length === 0) key = tw.slice();   // a line made only of small words ("Oh, no you don't!")
    var hit = 0, missing = [];
    key.forEach(function (k) {
      var ok = hw.some(function (h) { return sameWord(k, h); });
      if (ok) hit++; else missing.push(k);
    });
    var recall = hit / key.length;
    var mustMissing = must.filter(function (m) {
      var parts = m.split(' ');
      return !parts.every(function (p) { return hw.some(function (h) { return sameWord(p, h); }); });
    });
    // negatives: saying "not" when the line has none (or the reverse) changes the meaning
    var negT = tw.some(function (w) { return w === 'not' || w === 'no' || w === 'never'; });
    var negH = hw.some(function (w) { return w === 'not' || w === 'no' || w === 'never'; });
    var flipped = negT !== negH && key.length > 1;

    var need = strict === 'loose' ? 0.45 : strict === 'exact' ? 0.9 : 0.6;
    if (key.length <= 2) need = Math.min(need, strict === 'exact' ? 1 : 0.5);
    var score = strict === 'exact' ? Math.min(recall, seq) : Math.max(recall, seq);
    if (flipped) score = Math.min(score, need - 0.01);
    res.score = Math.round(score * 100) / 100;
    res.missing = mustMissing.concat(missing.filter(function (m) { return mustMissing.indexOf(m) < 0; })).slice(0, 4);
    res.flipped = flipped;
    if (score >= need && !mustMissing.length) res.verdict = 'pass';
    else if (score >= need - 0.25) res.verdict = 'close';
    else res.verdict = 'miss';
    return res;
  }
  function lev2(a, b) {           // edit distance between word lists
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (sameWord(a[i - 1], b[j - 1]) ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }

  /* a hint: the first few words, then blanks with first letters */
  function hint(text, level) {
    var words = spoken(text).split(/\s+/).filter(Boolean);
    if (level >= 3) return words.join(' ');
    var show = level === 1 ? 2 : Math.ceil(words.length / 2);
    return words.map(function (w, i) {
      if (i < show) return w;
      return w.replace(/^([^A-Za-z]*[A-Za-z])([A-Za-z'’]*)(.*)$/, function (m, a, b, c) { return a + b.replace(/./g, '_') + c; });
    }).join(' ');
  }

  var api = { check: check, normalize: normalize, spoken: spoken, hint: hint, sameWord: sameWord };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LineCheck = api;
})(typeof window !== 'undefined' ? window : this);
