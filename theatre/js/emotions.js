/* asl.cool/theatre: feeling icons in the script's margins (Colleen 2026-10-24: "here are the emotion icons i want to be able to insert into the
   margins of the script"; her 50 pictures in img/emotions/).
   - Automatic: every stage direction with an acting note ("smiles", "nervous", "stunned", "whispers"…) gets the matching icon beside it.
   - The teacher adds an icon anywhere (Add a feeling, then tap the spot), changes one, or takes an automatic one away.
   - Shown on The Script (students and teacher) and printed on My script, in a column just right of the page (the script's text runs nearly
     edge to edge, so there is no room inside the page).
   T.show.margin = { add: [{ id, n, y, icon }], off: { autoKey: 1 } }. The same pictures are used by React to That!. */
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
  function auto() {
    var out = [], seen = {};
    if (!T.show || !T.show.script) return out;
    T.O().scenes.forEach(function (scene) {
      var src = T.scriptScene(scene); if (!src) return;
      src.items.forEach(function (it) {
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
          out.push({ id: key, n: b.n, y: b.y + b.h / 2, icon: N[1], auto: true, note: m[0] });
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
    add: function (n, y, icon) { M().add.push({ id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n: n, y: y, icon: icon }); },
    remove: function (x) { var m = M(); if (x.auto) m.off[x.id] = 1; else m.add = m.add.filter(function (a) { return a.id !== x.id; }); },
    change: function (x, icon) { var m = M(); if (x.auto) { m.off[x.id] = 1; m.add.push({ id: 'm' + Date.now().toString(36), n: x.n, y: x.y, icon: icon }); } else { var a = m.add.find(function (q) { return q.id === x.id; }); if (a) a.icon = icon; } },
    /* the 50 icons to pick from */
    picker: function (current) {
      return '<div class="feelpick">' + LIST.map(function (x) { return '<button type="button" data-icon="' + x[1] + '" aria-pressed="' + (current === x[1]) + '"><img src="' + ICON[x[1]].file + '" alt=""><span>' + x[2] + '</span></button>'; }).join('') + '</div>';
    },
    img: function (key) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = ICON[key].file; }); }
  };
})();
