/* asl.cool/theatre: React to That! (Colleen 2026-10-24: "build these sentences into the app with the speak function so students can practice
   hearing things and reacting appropriately and then the app could show them the image and name of the correct emotion that they should have done
   for whatever was said so they can do character work independently"). The 50 prompts are her ensemble warmup cards.
   The app says an announcement, the student reacts with their face and body, then the app shows the picture and name of what fits.
   Pictures: img/act/<file> (the acting pictures list in theatre-notes); until a picture exists, its emoji shows instead.
   Practice stays on this device (T.ls 'reactSeen'); nothing is sent. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };

  /* feelings: the acting pictures (act-*.png) plus five the prompts need (disgusted, relieved, proud, sympathetic, curious) */
  var FEEL = {
    excited: ['Excited', 'act-excited.png', '🤩'], happy: ['Happy', 'act-happy.png', '😄'], stunned: ['Stunned', 'act-stunned.png', '😲'],
    hstunned: ['Happily stunned', 'act-happily-stunned.png', '🥹'], sad: ['Sad', 'act-sad.png', '😢'], annoyed: ['Annoyed', 'act-annoyed.png', '😒'],
    angry: ['Angry', 'act-angry.png', '😠'], panic: ['Scared', 'act-panic.png', '😱'], nervous: ['Nervous', 'act-nervous.png', '😬'],
    confused: ['Confused', 'act-confused.png', '😕'], embarrassed: ['Embarrassed', 'act-embarrassed.png', '😳'], suspicious: ['Suspicious', 'act-suspicious.png', '🤨'],
    moved: ['Thankful', 'act-moved.png', '🥲'], disgusted: ['Disgusted', 'act-disgusted.png', '🤢'], relieved: ['Relieved', 'act-relieved.png', '😮‍💨'],
    proud: ['Proud', 'act-proud.png', '😎'], sympathetic: ['Sorry for them', 'act-sympathetic.png', '🫂'], curious: ['Curious', 'act-curious.png', '🧐']
  };
  var GROUPS = [['joy', 'Excitement and joy', '🎉'], ['sad', 'Disappointment and sadness', '😢'], ['ick', 'Disgust', '🤢'], ['fear', 'Fear and nerves', '😱'],
    ['mad', 'Anger and frustration', '😠'], ['shock', 'Shock and disbelief', '😲'], ['awk', 'Embarrassment', '😳'], ['hmm', 'Confusion and suspicion', '🤨'], ['proud', 'Pride and relief', '😎']];
  /* [group, what the speaker says, feelings that fit] */
  var PROMPTS = [
    ['joy', 'We’re going to Disney World tomorrow!', ['excited', 'happy']],
    ['joy', 'Everybody gets free ice cream!', ['happy', 'excited']],
    ['joy', 'School is canceled tomorrow!', ['excited', 'relieved']],
    ['joy', 'You just won a million dollars!', ['stunned', 'excited']],
    ['joy', 'You all made it into the show!', ['happy', 'excited']],
    ['joy', 'We’re getting a puppy!', ['happy', 'excited']],
    ['sad', 'The field trip has been canceled.', ['sad']],
    ['sad', 'Sorry, we’re all out of pizza.', ['sad', 'annoyed']],
    ['sad', 'Your favorite TV show has been canceled.', ['sad', 'stunned']],
    ['sad', 'We lost the championship by one point.', ['sad']],
    ['sad', 'Nobody came to my birthday party.', ['sympathetic', 'sad']],
    ['sad', 'I’m moving away next week.', ['sad', 'stunned']],
    ['ick', 'I just found a hair in my food!', ['disgusted']],
    ['ick', 'Something in the refrigerator is moving!', ['disgusted', 'panic']],
    ['ick', 'There’s a giant booger on your chair!', ['disgusted', 'panic']],
    ['ick', 'Someone threw up in the swimming pool!', ['disgusted', 'panic']],
    ['ick', 'I think that milk expired three months ago.', ['disgusted']],
    ['fear', 'There’s a spider crawling up your back!', ['panic']],
    ['fear', 'The roller coaster is stuck at the very top!', ['panic', 'nervous']],
    ['fear', 'I heard something moving in that dark closet.', ['nervous', 'panic']],
    ['fear', 'The lights just went out, and the door is locked.', ['panic', 'confused']],
    ['fear', 'The principal wants to see all of you. Right now.', ['nervous']],
    ['fear', 'There’s a snake underneath your chair!', ['panic']],
    ['mad', 'Someone ate all the cookies you made!', ['angry', 'annoyed']],
    ['mad', 'You have to start the whole project over.', ['annoyed']],
    ['mad', 'The other team cheated, and they still won!', ['angry']],
    ['mad', 'Your flight has been delayed for another six hours.', ['annoyed', 'angry']],
    ['mad', 'Someone deleted all of our work!', ['angry', 'stunned']],
    ['mad', 'You have to stay after school for two more hours.', ['annoyed']],
    ['shock', 'I just saw a real dinosaur outside!', ['stunned']],
    ['shock', 'Taylor Swift is standing right behind you!', ['hstunned', 'excited']],
    ['shock', 'Your teacher just announced they’re going to space!', ['stunned']],
    ['shock', 'That little kid just lifted an entire car!', ['stunned']],
    ['shock', 'I just found out we’re all related!', ['confused', 'stunned']],
    ['awk', 'Your microphone was on that entire time.', ['embarrassed']],
    ['awk', 'You have toilet paper stuck to your shoe.', ['embarrassed']],
    ['awk', 'Everyone just watched you trip on the stairs.', ['embarrassed']],
    ['awk', 'You accidentally sent that text to the principal!', ['panic', 'embarrassed']],
    ['awk', 'Your mom is here, and she’s bringing your baby pictures!', ['embarrassed']],
    ['hmm', 'The instructions say to put the square inside the circle.', ['confused']],
    ['hmm', 'I know who stole the cookies, but I’m not telling.', ['suspicious', 'curious']],
    ['hmm', 'One of you is secretly a famous celebrity.', ['curious', 'suspicious']],
    ['hmm', 'Someone in this room is an undercover spy.', ['suspicious', 'curious']],
    ['hmm', 'The test answers are all supposed to be the same letter.', ['confused', 'suspicious']],
    ['proud', 'You got a perfect score on the hardest test!', ['proud', 'excited']],
    ['proud', 'We raised enough money to save the animal shelter!', ['proud', 'happy']],
    ['proud', 'The missing dog was found, and she’s okay!', ['relieved', 'happy']],
    ['proud', 'You broke the school record!', ['proud', 'stunned']],
    ['proud', 'They found your lost phone!', ['relieved', 'moved']],
    ['proud', 'You did it! Everyone thought it was impossible!', ['proud', 'excited']]
  ];
  T.React = { FEEL: FEEL, PROMPTS: PROMPTS };

  var st = { g: '', words: false, order: null, at: 0 };
  function prefs() { var p = T.ls('react') || {}; st.words = !!p.words; st.g = p.g || ''; }
  function keep() { T.ls('react', { words: st.words, g: st.g }); }
  function list() { return PROMPTS.map(function (p, i) { return i; }).filter(function (i) { return !st.g || PROMPTS[i][0] === st.g; }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pic(k, big) {
    var f = FEEL[k], sz = big ? 150 : 96;
    return '<figure style="margin:0;text-align:center;width:' + (sz + 30) + 'px"><img src="img/act/' + f[1] + '" alt="" width="' + sz + '" height="' + sz + '" style="border-radius:18px;background:var(--card);object-fit:contain" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{textContent:\'' + f[2] + '\',style:\'font-size:' + Math.round(sz * 0.7) + 'px;line-height:' + sz + 'px\'}))">' +
      '<figcaption style="font-weight:700;font-size:1.15em;margin-top:6px">' + esc(f[0]) + '</figcaption></figure>';
  }

  function start(back) {
    prefs();
    T.setBar('React to That!', back);
    var seen = T.ls('reactSeen') || {};
    app.innerHTML = '<div class="card"><h2>' + sym('🎭') + 'React to That!</h2>' +
      '<ol class="big" style="font-size:1.05em;line-height:1.7"><li>Listen to the announcement.</li><li>React right away with your <b>face and body</b>. No words needed.</li><li>See the feelings that fit. Did yours match?</li></ol>' +
      '<p class="muted small">Actors react even when they don’t have a line. More than one feeling can fit, and your character might feel something different. That’s OK too.</p>' +
      '<label class="switch"><span>Show the words too</span><input type="checkbox" id="rw"' + (st.words ? ' checked' : '') + '></label></div>' +
      '<h3>Pick a set</h3><div class="grid">' + [['', 'All 50, mixed up', '🎲']].concat(GROUPS).map(function (g) {
        var n = PROMPTS.filter(function (p) { return !g[0] || p[0] === g[0]; }).length, done = PROMPTS.filter(function (p, i) { return (!g[0] || p[0] === g[0]) && seen[i]; }).length;
        return '<button class="tile" data-g="' + g[0] + '" style="min-height:96px">' + '<span style="font-size:2em">' + g[2] + '</span><b>' + esc(g[1]) + '</b><span>' + done + ' of ' + n + ' practiced</span></button>';
      }).join('') + '</div>';
    document.getElementById('rw').onchange = function () { st.words = this.checked; keep(); };
    app.querySelectorAll('[data-g]').forEach(function (b) { b.onclick = function () { st.g = b.dataset.g; keep(); st.order = shuffle(list()); st.at = 0; round(back); }; });
  }

  function round(back) {
    var i = st.order[st.at], p = PROMPTS[i];
    if (i == null) { start(back); return; }
    T.setBar('React to That! · ' + (st.at + 1) + ' of ' + st.order.length, back);
    app.innerHTML = '<div class="card" style="text-align:center"><p class="muted">Listen, then react with your face and body.</p>' +
      '<p id="rt" style="font-size:1.7em;font-weight:700;min-height:2.4em;margin:16px 0">' + (st.words ? '“' + esc(p[1]) + '”' : sym('🔊') + '<span class="muted">Listening…</span>') + '</p>' +
      '<div id="rc" style="font-size:3em;font-weight:800;min-height:1.4em" aria-live="polite"></div>' +
      '<div class="row" style="justify-content:center;flex-wrap:wrap;gap:10px;margin-top:10px"><button class="btn" id="ag">' + sym('🔁') + 'Hear it again</button>' +
      '<button class="btn primary" id="sh">' + sym('👀') + 'What fits?</button></div><div id="ans"></div></div>';
    var timer = null, said = function () {
      document.getElementById('rc').textContent = 'React!';
      timer = setTimeout(function () { var c = document.getElementById('rc'); if (c) c.textContent = ''; }, 2500);
    };
    var speak = function () { T.Speech.stop(); clearTimeout(timer); document.getElementById('rc').textContent = ''; T.Speech.say(p[1]).then(said); if (!('speechSynthesis' in window)) said(); };
    T.cleanup.push(function () { T.Speech.stop(); clearTimeout(timer); });
    speak();
    document.getElementById('ag').onclick = speak;
    document.getElementById('sh').onclick = function () {
      clearTimeout(timer);
      document.getElementById('rt').innerHTML = '“' + esc(p[1]) + '”';
      document.getElementById('rc').textContent = '';
      document.getElementById('ans').innerHTML = '<h3 style="margin-top:18px">' + (p[2].length > 1 ? 'These fit' : 'This fits') + '</h3>' +
        '<div class="row" style="justify-content:center;flex-wrap:wrap;gap:18px">' + p[2].map(function (k, j) { return pic(k, j === 0); }).join('') + '</div>' +
        '<p style="margin-top:16px">Did your face and body show it?</p><div class="row" style="justify-content:center;flex-wrap:wrap;gap:10px">' +
        [['yes', '👍 Yes'], ['some', '🤏 Some of it'], ['no', '🔁 Not yet']].map(function (b) { return '<button class="btn' + (b[0] === 'yes' ? ' primary' : '') + '" data-m="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div>';
      this.style.display = 'none';
      document.querySelectorAll('[data-m]').forEach(function (b) {
        b.onclick = function () {
          var seen = T.ls('reactSeen') || {}; seen[i] = b.dataset.m; T.ls('reactSeen', seen);
          if (b.dataset.m === 'no') { st.order.splice(Math.min(st.order.length, st.at + 4), 0, i); }      // it comes back a few prompts later
          st.at++; round(back);
        };
      });
    };
  }

  T.studentPages = T.studentPages || {};
  T.studentPages.react = function () { start('#/home'); };
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.react = function () { start('#/teacher'); };      // the same practice on the projector for the Monday warmup
})();
