/* asl.cool/theatre: feeling icons in the script's margins (Colleen 2026-10-24: "here are the emotion icons i want to be able to insert into the
   margins of the script"; her 50 pictures in img/emotions/).
   - Automatic: every stage direction with an acting note ("smiles", "nervous", "stunned", "whispers"…) gets the matching icon beside it.
   - The teacher adds an icon anywhere (Add a feeling, then tap the spot), changes one, or takes an automatic one away.
   - Shown on The Script (students and teacher) and printed on My script, inside the page's gray strip (Colleen: "always put these feelings
     icons in the gray strip on either the left or right of a page or on top of any page"), each labeled with who it is for. The strip is found
     from the drawn page's pixels (stripOf), since it alternates sides; a page without one gets its icons along the top.
   - Who: the names just before the acting note in a direction, else the speaker of the line it belongs to (like needs.js), or the teacher's pick.
   T.show.margin = { add: [{ id, n, y, icon, who: [charIds] }], off: { autoKey: 1 } }. The same pictures are used by React to That!. */
(function () {
  'use strict';
  var T = window.T || (window.T = {});
  /* [file number, file name, what students see] */
  var LIST = [
    [1, '01_uninterested_alt', 'Uninterested'], [2, '02_excited_jump_alt', 'Excited'], [3, '03_happy_open_arms', 'Happy'], [4, '04_sad_sitting', 'Sad'],
    [5, '05_angry_fuming', 'Angry'], [6, '06_annoyed_cross_arms', 'Annoyed'], [7, '07_confused_questioning', 'Confused'], [8, '08_shocked_gasp', 'Shocked'],
    [9, '09_nervous_worried', 'Nervous'], [10, '10_shy_blushing', 'Shy'], [11, '11_anxious_teary', 'Anxious'], [12, '12_disappointed_slump', 'Disappointed'],
    [13, '13_sarcastic_shrug', 'Sarcastic'], [14, '14_suspicious_thinking', 'Suspicious'], [15, '15_sneaky_tiptoe', 'Sneaky'], [16, '16_proud_confident', 'Proud'],
    [17, '17_bashful_in_love', 'Bashful'], [18, '18_determined_point', 'Determined'], [19, '19_worried_pleading', 'Worried'], [20, '20_stop_defiant', 'Defiant'],
    [21, '21_cheering', 'Cheering'], [22, '22_heart_eyes', 'In love'], [23, '23_pleading_teary', 'Moved'], [24, '24_laughing_giggle', 'Giggling'],
    [25, '25_crying_sobbing', 'Sobbing'], [26, '26_triumphant_sparkle', 'Triumphant'], [27, '27_sad_small_worried', 'Sorry for them'], [28, '28_thoughtful_hand_chin', 'Thinking'],
    [29, '29_playful_tongue', 'Playful'], [30, '30_frustrated_grit', 'Frustrated'], [31, '31_salute', 'Saluting'], [32, '32_calm_open_arms', 'Relieved'],
    [33, '33_surprised_gasp_alt', 'Surprised'], [34, '34_terrified_panic', 'Scared'], [35, '35_laughing_point', 'Laughing'], [36, '36_smug_cross_arms', 'Smug'],
    [37, '37_shushing', 'Shh!'], [38, '38_whispering_crawl', 'Whispering'], [39, '39_flirty_wink', 'Flirty'], [40, '40_dismissive_wave', 'Dismissive'],
    [41, '41_eager_hop', 'Eager'], [42, '42_overwhelmed_head_hands', 'Overwhelmed'], [43, '43_confused_shrug', 'Not sure'], [44, '44_mad_huff', 'Huffy'],
    [45, '45_apologetic_sparkle', 'Sorry'], [46, '46_heartbroken', 'Heartbroken'], [47, '47_serene_confident', 'Satisfied'], [48, '48_shouting_callout', 'Shouting'],
    [49, '49_exhausted_sigh', 'Sighing'], [50, '50_idea', 'An idea!']
  ];
  var ICON = {}; LIST.forEach(function (x) { ICON[x[1]] = { file: 'img/emotions/' + x[1] + '.png', name: x[2], n: x[0] }; });
  /* acting notes in the stage directions -> icon (longer phrases first; theatre-notes/acting-pictures-list.md) */
  var NOTES = [
    [/happily stunned/i, '33_surprised_gasp_alt'], [/stifle a laugh/i, '37_shushing'], [/bursts? into tears|sobs?\b|crying/i, '25_crying_sobbing'],
    [/heartbroken/i, '46_heartbroken'], [/genuinely moved|overwrought/i, '23_pleading_teary'], [/mustering courage|determined/i, '18_determined_point'],
    [/taking charge|rising authority|confiden(t|ce)/i, '16_proud_confident'], [/grand entrance|melismatic/i, '26_triumphant_sparkle'],
    [/without much heart|uninterested|bored/i, '01_uninterested_alt'], [/a light bulb|an idea\b|gets an idea/i, '50_idea'],
    [/voice cracks|lowest note/i, '42_overwhelmed_head_hands'], [/absorbed|scans|reading/i, '28_thoughtful_hand_chin'],
    [/whisper|quietly|to (her|him|them)sel(f|ves)/i, '38_whispering_crawl'], [/scream|shouts?\b|yells?\b/i, '48_shouting_callout'],
    [/eavesdrop|sneaks?\b|lying|\blies\b/i, '15_sneaky_tiptoe'], [/\bcaught\b/i, '45_apologetic_sparkle'], [/\bsighs?\b/i, '49_exhausted_sigh'],
    [/panic/i, '34_terrified_panic'], [/stunned|shocked|disbelief|surprised|gasps?/i, '08_shocked_gasp'], [/confused|puzzled/i, '07_confused_questioning'],
    [/crestfallen|disappointed|depressed|\bsad(ly)?\b/i, '12_disappointed_slump'], [/embarrass|awkward|\bshy\b|blush/i, '10_shy_blushing'],
    [/nervous|tentative/i, '09_nervous_worried'], [/annoyed|fed up|snaps|rolls (her|his) eyes/i, '06_annoyed_cross_arms'],
    [/storms|angr(y|ily)|furious/i, '05_angry_fuming'], [/suspicious/i, '14_suspicious_thinking'], [/satisfied|smug/i, '47_serene_confident'],
    [/\btease|teasing/i, '29_playful_tongue'], [/laugh/i, '24_laughing_giggle'], [/cheer|excite/i, '21_cheering'], [/\bsmil(e|es|ing)\b|happily|\bhappy\b/i, '03_happy_open_arms']
  ];
  /* a word's line inside an item: share the letters out over its line boxes by width (as needs.js does) */
  function spot(it, idx) {
    var bs = (it.boxes || []).filter(function (b) { return b && b.w; }); if (!bs.length) return null;
    var tot = bs.reduce(function (t, b) { return t + b.w; }, 0), want = idx / Math.max(1, (it.text || '').length) * tot, run = 0;
    for (var i = 0; i < bs.length; i++) { run += bs[i].w; if (run >= want) return bs[i]; }
    return bs[bs.length - 1];
  }
  function names(text) {      // character ids named in capitals ("MS. DARBUS", "TROY’s") in order
    var out = [], re = /\b[A-Z][A-Z.’'-]*[A-Z](?:\s+[A-Z][A-Z.’'-]*[A-Z])*\b/g, m;
    while ((m = re.exec(text))) { var ids = (T.labelChars(m[0].replace(/[’']$/, '')) || []).filter(function (x) { return x !== '*'; }); ids.forEach(function (id) { out.push({ at: m.index, id: id }); }); }
    return out;
  }
  function whoFor(items, ii, it, at) {
    if (it.type === 'line') return (T.labelChars(it.who) || []).filter(function (x) { return x !== '*'; });
    var t = it.text, a = Math.max(t.lastIndexOf('. ', at), t.lastIndexOf('(', at)) + 1, e = t.slice(at).search(/[.!?)](\s|$)/); e = e < 0 ? t.length : at + e;
    var ns = names(t.slice(a, e)), before = ns.filter(function (x) { return x.at + a < at; }).map(function (x) { return x.id; });
    if (before.length) return before.slice(-2);
    if (/^\(?[a-z]/.test(t)) { var nx = items.slice(ii + 1).find(function (x) { return x.type === 'line'; }); if (nx) return (T.labelChars(nx.who) || []).filter(function (x) { return x !== '*'; }); }
    return ns.map(function (x) { return x.id; }).slice(0, 2);
  }
  function auto() {
    var out = [], seen = {};
    if (!T.show || !T.show.script) return out;
    T.O().scenes.forEach(function (scene) {
      var src = T.scriptScene(scene); if (!src) return;
      src.items.forEach(function (it, ii) {
        if (!it.text || (it.type !== 'dir' && it.type !== 'line')) return;
        /* a direction: all its words; a spoken line: only the words in parentheses, like "(uninterested) Hi, Sharpay." */
        var parts = it.type === 'dir' ? [[it.text, 0]] : [], pm, re = /\(([^)]{2,80})\)/g;
        if (it.type === 'line') while ((pm = re.exec(it.text))) parts.push([pm[1], pm.index + 1]);
        parts.forEach(function (part) { NOTES.forEach(function (N) {
          var m = part[0].match(N[0]); if (!m || m[0] === m[0].toUpperCase()) return;      // acting notes are lower case; WILDCAT CHEER is a song title
          var b = spot(it, part[1] + m.index + m[0].length / 2); if (!b) return;
          var key = 'a|' + b.n + '|' + Math.round(b.y) + '|' + N[1];
          var near = out.some(function (o) { return o.n === b.n && Math.abs(o.y - b.y) < 6 && o.icon === N[1]; });
          if (seen[key] || near) return; seen[key] = 1;
          out.push({ id: key, n: b.n, y: b.y + b.h / 2, icon: N[1], auto: true, note: m[0], who: whoFor(src.items, ii, it, part[1] + m.index) });
        }); });
      });
    });
    return out;
  }
  function M() { var m = T.show.margin = T.show.margin || {}; m.add = m.add || []; m.off = m.off || {}; return m; }
  T.Emotions = {
    LIST: LIST, ICON: ICON, NOTES: NOTES,
    /* every icon on the pages: automatic ones not taken away, then the teacher's */
    all: function () { var m = (T.show && T.show.margin) || {}, off = m.off || {}; return auto().filter(function (a) { return !off[a.id]; }).concat((m.add || []).filter(function (x) { return ICON[x.icon]; })); },
    add: function (n, y, icon, who) { M().add.push({ id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: n, y: y, icon: icon, who: who || [] }); },
    remove: function (x) { var m = M(); if (x.auto) m.off[x.id] = 1; else m.add = m.add.filter(function (a) { return a.id !== x.id; }); },
    change: function (x, icon, who) { var m = M(); if (x.auto) { m.off[x.id] = 1; m.add.push({ id: 'm' + Date.now().toString(36), n: x.n, y: x.y, icon: icon, who: who || x.who || [] }); } else { var a = m.add.find(function (q) { return q.id === x.id; }); if (a) { a.icon = icon; a.who = who || a.who || []; } } },
    /* the 50 icons to pick from */
    picker: function (current, who) {
      var O = T.O(), sel = (who || [])[0] || '';
      return '<label class="f">Who is it for?<select id="feelwho"><option value="">Nobody in particular</option>' + O.characters.map(function (c) { return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + T.esc(c.name) + '</option>'; }).join('') + '</select></label>' +
        '<div class="feelpick">' + LIST.map(function (x) { return '<button type="button" data-icon="' + x[1] + '" aria-pressed="' + (current === x[1]) + '"><img src="' + ICON[x[1]].file + '" alt=""><span>' + x[2] + '</span></button>'; }).join('') + '</div>';
    },
    /* who it is for, as a short label: "Troy", "Troy & Gabriella", "Jocks" */
    label: function (ids) { var n = (ids || []).map(function (id) { var c = T.charById(id); return c ? c.short : ''; }).filter(Boolean); return n.length > 2 ? n[0] + ' +' + (n.length - 1) : n.join(' & '); },
    /* the gray strip on a drawn page: { side: 'L' | 'R' | 'T', a, b } as fractions of the width (a..b is the strip); cached per page */
    strips: {},
    stripOf: function (n, canvas) {
      if (T.Emotions.strips[n]) return T.Emotions.strips[n];
      var w = canvas.width, h = canvas.height, res = { side: 'T' };
      try {
        var ctx = canvas.getContext('2d'), y0 = Math.round(h * 0.2), hh = Math.round(h * 0.6), band = Math.max(2, Math.round(w * 0.03));
        var lum = function (x) { var d = ctx.getImageData(x, y0, band, hh).data, t = 0; for (var i = 0; i < d.length; i += 16) t += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; return t / (d.length / 16); };
        var L = lum(0), R = lum(w - band);
        var gray = function (v) { return v < 225; };
        if (gray(L) || gray(R)) {
          var side = gray(L) && (!gray(R) || L <= R) ? 'L' : 'R', step = Math.max(1, Math.round(w * 0.005)), edge = 0;
          for (var x = 0; x < w * 0.25; x += step) { var col = lum(side === 'L' ? x : w - band - x); if (col > 238) break; edge = x + band; }      // inward until the page turns white
          var f = Math.max(0.05, Math.min(0.16, edge / w));
          res = side === 'L' ? { side: 'L', a: 0, b: f } : { side: 'R', a: 1 - f, b: 1 };
        }
      } catch (e) {}
      return (T.Emotions.strips[n] = res);
    },
    /* where each icon goes on page n (PDF points): { f, x, y, w, h, label } — inside the strip, stacked so none covers another */
    layout: function (n, strip, list) {
      var sz = T.Pages.size(n), mine = (list || T.Emotions.all()).filter(function (f) { return f.n === n && ICON[f.icon]; }).sort(function (a, b) { return a.y - b.y; });
      var out = [], iw, ih, lab = 10;
      if (strip.side === 'T') {      // no strip: a row along the top of the page
        iw = sz.w * 0.07; ih = iw * 1.53;
        mine.forEach(function (f, i) { out.push({ f: f, x: sz.w * 0.08 + i * (iw + 8), y: 4, w: iw, h: ih, label: T.Emotions.label(f.who) }); });
        return out;
      }
      var sw = (strip.b - strip.a) * sz.w; iw = Math.min(sw * 0.86, sz.w * 0.1); ih = iw * 1.53;
      var cx = (strip.a + strip.b) / 2 * sz.w, last = -1e9, gap = ih + lab + 4;
      mine.forEach(function (f) { var top = Math.max(f.y - ih / 2, last + gap, 2); top = Math.min(top, sz.h - gap); last = top; out.push({ f: f, x: cx - iw / 2, y: top, w: iw, h: ih, label: T.Emotions.label(f.who) }); });
      return out;
    },
    img: function (key) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = ICON[key].file; }); }
  };
})();
