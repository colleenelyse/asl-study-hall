/* asl.cool/theatre: props, set pieces and costume notes found in the script (Colleen 2026-10-24: "in the cue version of the script, include
   listed props and set needs in their own category including a count of how many of an item are needed, who needs it/them; costume guidance
   should also be highlighted in its own color if it exists in the script anywhere").
   Props and set pieces come from the stage directions (a word list below), with who handles each one: the names in the same sentence before it,
   else the speaker of the line the direction belongs to. How many: a number in the words ("two chairs"), or one for each person who has their
   own ("his phone", "their phones"); a group (Students) needs one for each member. The props list (Production › Shopping) is joined in, so a
   prop the directions never mention still shows. Costume notes: clothing words anywhere in the script, directions and lines.
   Nothing here is saved: it is worked out from the script each time, so a re-read of the script updates it. */
(function () {
  'use strict';
  var T = window.T || (window.T = {});

  /* [key, kind, words, name]: the first match wins where two overlap, so the longer names come first */
  var LEX = [
    ['spare-phone', 'prop', /\bspare (?:cell ?)?phones?\b/i, 'Spare phone'],
    ['phone', 'prop', /\b(?:cell ?)?phones?\b(?! (?:call|number))/i, 'Phone'],
    ['ann-mic', 'prop', /\bannouncement microphones?\b/i, 'Announcement microphone'],
    ['mic', 'prop', /\bmicrophones?\b|\bmics?\b/i, 'Microphone'],
    ['sheet-music', 'prop', /\bsheet music\b/i, 'Sheet music'],
    ['signup', 'prop', /\bsign-?up(?:s| sheets?)\b/i, 'Sign-up sheet'],
    ['books', 'prop', /\b(?:text|note)?books?\b/i, 'Books'],
    ['clipboard', 'prop', /\bclipboards?\b/i, 'Clipboard'],
    ['gong', 'prop', /\bgongs?\b/i, 'Gong'],
    ['bucket', 'prop', /\bbuckets?\b/i, 'Bucket'],
    ['whistle', 'prop', /\bwhistles?\b/i, 'Whistle'],
    ['basketball', 'prop', /\bbasketballs?\b(?! (?:team|game|championship|court|practice|players?|season|star|captain))/i, 'Basketball'],
    ['printouts', 'prop', /\bprint-?outs?\b/i, 'Printouts'],
    ['laptop', 'prop', /\blaptops?\b/i, 'Laptop'],
    ['watch', 'prop', /\b(?:checks?|his|her|their|a) (?:wrist)?watch\b/i, 'Watch'],
    ['note', 'prop', /\b(?:a|the) note\b/i, 'Note (a folded paper)'],
    ['tray', 'prop', /\btrays?\b/i, 'Tray'],
    ['trophy', 'prop', /\btroph(?:y|ies)\b/i, 'Trophy'],
    ['poms', 'prop', /\bpom-?poms?\b/i, 'Pom-poms'],
    ['bag', 'prop', /\bback-?packs?\b|\b(?:book|school|gym)? ?bags?\b/i, 'Bag'],
    ['flowers', 'prop', /\bflowers?\b|\bbouquets?\b/i, 'Flowers'],
    ['camera', 'prop', /\bcameras?\b/i, 'Camera'],
    ['buzzer', 'prop', /\bbuzzers?\b/i, 'Buzzer'],
    ['headset', 'prop', /\bheadsets?\b/i, 'Headset'],
    ['pen', 'prop', /\bpens?\b|\bpencils?\b|\bmarkers?\b/i, 'Pen or pencil'],
    ['food', 'prop', /\bcookies?\b|\bcupcakes?\b|\bcakes?\b|\bcr[eè]me br[uû]l[eé]e\b|\bsnacks?\b|\bbaked goods\b/i, 'Food (fake)'],
    ['cup', 'prop', /\bcups?\b|\bmugs?\b|\bbottles?\b/i, 'Cup or bottle'],
    ['ticket', 'prop', /\btickets?\b/i, 'Ticket'],
    ['karaoke', 'set', /\bkaraoke stage\b/i, 'Karaoke stage'],
    ['bulletin', 'set', /\bbulletin boards?\b/i, 'Bulletin board'],
    ['piano', 'set', /\bpianos?\b/i, 'Piano'],
    ['banner', 'set', /\bbanners?\b/i, 'Banners'],
    ['lockers', 'set', /\blockers?\b(?! room)/i, 'Lockers'],
    ['bench', 'set', /\bbench(?:es)?\b/i, 'Bench'],
    ['table', 'set', /\b(?:lab |lunch |cafeteria )?tables?\b/i, 'Table'],
    ['chair', 'set', /\bchairs?\b|\bstools?\b/i, 'Chair'],
    ['desk', 'set', /\bdesks?\b/i, 'Desk'],
    ['seat', 'set', /\bseats?\b/i, 'Seats (chairs or desks)'],
    ['bleachers', 'set', /\bbleachers\b/i, 'Bleachers'],
    ['scoreboard', 'set', /\bscoreboards?\b/i, 'Scoreboard'],
    ['hoop', 'set', /\bhoops?\b|\bbaskets?\b(?!ball)/i, 'Basketball hoop'],
    ['door', 'set', /\bdoors?\b/i, 'Door'],
    ['sign', 'set', /\bsigns?\b(?! (?:up|her|his|their|in|out))(?!-)/i, 'Sign'],
    ['poster', 'set', /\bposters?\b/i, 'Poster']
  ];
  /* clothing words (anywhere in the script). Not "tie" on its own (a tie game) or "dress rehearsal" */
  var COSTUME = /\b(wear(?:s|ing)?|wore|dressed|(?:party |prom )?dress(?:es)?(?! rehearsal)|costumes?|outfits?|(?:sun)?glasses|goggles|jerseys?|uniforms?|lab coats?|coats?|jackets?|hoodies?|sweaters?|sweatbands?|hats?|caps?|beanies?|scarf|scarves|neckties?|bow ties?|shoes|sneakers|boots|heels|gowns?|tux(?:edo)?s?|headbands?|aprons?|robes?|vests?|skirts?|pants|shorts|wigs?|make-?up|changes? (?:into|clothes)|quick change|in costume)\b/i;
  /* things each person has their own of: "TROY and GABRIELLA exchange phones" is two phones, but "sign the sign-ups" is one sheet */
  var PERSONAL = ['spare-phone', 'phone', 'mic', 'books', 'bag', 'poms', 'tray', 'pen', 'cup', 'ticket', 'watch', 'clipboard'];
  var NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, several: 0, some: 0, pair: 2 };

  /* names in capitals ("MS. DARBUS", "JACK SCOTT", "TROY’s") -> [{ at, ids }] */
  function names(text, resolve) {
    var out = [], re = /\b[A-Z][A-Z.’'-]*[A-Z](?:\s+[A-Z][A-Z.’'-]*[A-Z])*\b/g, m;
    while ((m = re.exec(text))) {
      var ids = resolve(m[0].replace(/[’']$/, '')); if (ids && ids.length) out.push({ at: m.index, ids: ids.filter(function (x) { return x !== '*'; }) });
    }
    return out;
  }
  function sentenceAround(text, i) {
    var a = Math.max(text.lastIndexOf('. ', i), text.lastIndexOf('! ', i), text.lastIndexOf('? ', i), text.lastIndexOf('(', i)); a = a < 0 ? 0 : a + 1;
    var e = text.slice(i).search(/[.!?)](\s|$)/); e = e < 0 ? text.length : i + e + 1;
    return { a: a, e: e };
  }
  /* the line (page, y) of a character inside an item: its boxes are lines of text, so share the letters out by width */
  function spot(item, idx) {      // idx: the middle of the words, so the line they sit on
    var bs = (item.boxes || []).filter(function (b) { return b && b.w; }); if (!bs.length) return null;
    var tot = bs.reduce(function (t, b) { return t + b.w; }, 0), want = idx / Math.max(1, (item.text || '').length) * tot, run = 0;
    for (var i = 0; i < bs.length; i++) { run += bs[i].w; if (run >= want) return { n: bs[i].n, y: bs[i].y }; }
    return { n: bs[bs.length - 1].n, y: bs[bs.length - 1].y };
  }
  function words(text, a, e) {      // a few words around a match, for the note beside the page
    var pre = text.slice(0, a).split(/\s+/).slice(-4).join(' '), post = text.slice(e).split(/\s+/).slice(0, 4).join(' ');
    return (pre + ' ' + text.slice(a, e) + ' ' + post).replace(/^[\s(]+|[\s)]+$/g, '').replace(/\s+/g, ' ').replace(/ ([.,!?;:…])/g, '$1');
  }

  /* scenes: [{ num, scene (outline id), items }]; opts: { resolve(label) -> ids, chars [{id, group}], props [{name, who, qty}], groupSize(id) } */
  function scan(scenes, opts) {
    var resolve = opts.resolve, chars = opts.chars || [], isGroup = function (id) { var c = chars.find(function (x) { return x.id === id; }); return !!c && c.group === 'ensemble'; };
    var found = {}, costume = [];
    scenes.forEach(function (sc) {
      var items = sc.items || [];
      items.forEach(function (it, ii) {
        var text = it.text || ''; if (!text) return;
        if (it.type === 'dir') {
          var taken = [];
          var speaker = function () {      // a direction inside a speech: the speaker's ("TROY: (…)", or the line it sits above)
            var lead = text.match(/^\(?([A-Z][A-Z .’'-]+[A-Z]):/); if (lead) return resolve(lead[1]) || [];
            if (!/^\(?[a-z]/.test(text)) return [];
            var nx = items.slice(ii + 1).find(function (x) { return x.type === 'line'; }), pv = items.slice(0, ii).reverse().find(function (x) { return x.type === 'line'; });
            var l = nx && (!pv || (nx.boxes && it.boxes && nx.boxes[0] && it.boxes[0] && nx.boxes[0].n === it.boxes[0].n)) ? nx : pv;
            return l ? resolve(l.who) || [] : [];
          };
          LEX.forEach(function (L) {
            var re = new RegExp(L[2].source, 'gi'), m;
            while ((m = re.exec(text))) {
              var a = m.index, e = a + m[0].length;
              if (taken.some(function (t) { return a < t[1] && e > t[0]; })) continue;
              taken.push([a, e]);
              var s = sentenceAround(text, a), ns = names(text.slice(s.a, s.e), resolve), before = [], after = [];
              ns.forEach(function (x) { (x.at + s.a < a ? before : after).push.apply(x.at + s.a < a ? before : after, x.ids); });
              var who = before.length ? before : speaker().concat(after);
              who = who.filter(function (x, i) { return who.indexOf(x) === i; });
              var pre = text.slice(Math.max(s.a, a - 14), a).toLowerCase(), nm = pre.match(/\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|pair of|\d+)\s+(?:\w+\s+)?$/);
              var n = nm ? (/^\d/.test(nm[1]) ? +nm[1] : NUM[nm[1].split(' ')[0]] || 0) : 0;
              var own = /\b(his|her|their|its)\s+(?:\w+\s+)?$/.test(pre) || /[’']s\s+(?:\w+\s+)?$/.test(text.slice(Math.max(0, a - 14), a)) || (PERSONAL.indexOf(L[0]) >= 0 && /s$/i.test(m[0]) && who.length > 1);
              var f = found[L[0]] = found[L[0]] || { key: L[0], kind: L[1], name: L[3], who: [], own: false, most: 0, spots: [] };
              who.forEach(function (x) { if (f.who.indexOf(x) < 0) f.who.push(x); });
              if (own) f.own = true;
              f.most = Math.max(f.most, n, own ? who.filter(function (x) { return !isGroup(x); }).length : 0);
              var p = spot(it, (a + e) / 2); if (p) f.spots.push({ scene: sc.scene, num: sc.num, n: p.n, y: p.y, who: who, word: m[0], text: words(text, a, e) });      // word: the exact words, highlighted alone on the stage manager script
            }
          });
        }
        var cre = new RegExp(COSTUME.source, 'gi'), cm;
        while ((cm = cre.exec(text))) {
          if (it.type !== 'dir' && it.type !== 'line') break;
          var cs = sentenceAround(text, cm.index), cn = it.type === 'dir' ? names(text.slice(cs.a, cs.e), resolve) : [];
          var cw = [].concat.apply([], cn.map(function (x) { return x.ids; }));
          var cp = spot(it, cm.index + cm[0].length / 2);
          if (cp) costume.push({ scene: sc.scene, num: sc.num, n: cp.n, y: cp.y, said: it.type === 'line' ? (resolve(it.who) || []) : [], who: cw, word: cm[0], text: words(text, cm.index, cm.index + cm[0].length) });
        }
      });
    });
    /* the props list joins in: same word in its name = the same thing */
    (opts.props || []).forEach(function (p) {
      var L = LEX.find(function (L) { return L[2].test(p.name); }), f = L && found[L[0]];
      if (!f) { f = found['list:' + (p.id || p.name)] = { key: 'list:' + (p.id || p.name), kind: 'prop', name: p.name, who: [], own: false, most: 0, spots: [], onlyList: true, listScenes: [] }; }
      f.list = (f.list || []).concat([p]);
      if (f.onlyList) (p.scenes || []).forEach(function (id) { var n = String(id).replace(/^s/, ''); if (f.listScenes.indexOf(n) < 0) f.listScenes.push(n); });
      if (p.who && f.who.indexOf(p.who) < 0) f.who.push(p.who);
    });
    var list = Object.keys(found).map(function (k) {
      var f = found[k], people = f.who.filter(function (x) { return !isGroup(x); }), groups = f.who.filter(isGroup);
      var each = f.own ? people.length : 0, gcount = 0, gunknown = [];
      if (f.own || f.kind === 'prop') groups.forEach(function (g) { var n = opts.groupSize ? opts.groupSize(g) : 0; if (n) gcount += n; else gunknown.push(g); });
      if (!f.own) gunknown = [];
      var count = Math.max(f.most || 0, each + (f.own ? gcount : 0), 1);
      var listQty = (f.list || []).reduce(function (t, p) { return Math.max(t, +p.qty || 0); }, 0);
      (f.list || []).forEach(function (p) { if (+p.qty) gunknown = gunknown.filter(function (g) { return g !== p.who; }); });      // the props list already counted that group
      return { key: f.key, kind: f.kind, name: f.name, count: count, eachOf: gunknown, listQty: listQty, who: f.who, spots: f.spots, onlyList: !!f.onlyList,
        scenes: f.spots.map(function (s) { return String(s.num); }).concat(f.listScenes || []).filter(function (x, i, a) { return a.indexOf(x) === i; }) };
    });
    list.sort(function (a, b) { return (a.kind === b.kind ? 0 : a.kind === 'prop' ? -1 : 1) || a.name.localeCompare(b.name); });
    return { items: list, costume: costume };
  }

  /* from the saved show (browser) */
  function fromShow() {
    var O = T.O(), scenes = O.scenes.map(function (s) { var src = T.scriptScene(s); return src ? { num: s.num, scene: s.id, items: src.items } : null; }).filter(Boolean);
    return scan(scenes, {
      resolve: T.labelChars, chars: O.characters, props: T.show.props || O.props || [],
      groupSize: function (g) { return (T.show.cast || []).filter(function (a) { return (a.chars || []).indexOf(g) >= 0; }).length; }
    });
  }
  T.Needs = { scan: scan, fromShow: fromShow, LEX: LEX, COSTUME: COSTUME };
  if (typeof module !== 'undefined') module.exports = T.Needs;
})();
