/* asl.cool/theatre: React to That! (Colleen 2026-10-24: "build these sentences into the app with the speak function so students can practice
   hearing things and reacting appropriately and then the app could show them the image and name of the correct emotion that they should have done
   for whatever was said so they can do character work independently").
   An announcement bank (her 50 warmup cards and her 100 practice announcements): each has the sentence, the feeling that fits first, any other
   feeling that fits, and a level. Level 1: big, obvious feelings. Level 2: quieter feelings (disappointed, embarrassed, confused, proud, relieved,
   nervous). Level 3: react as a character: a role first, then the announcement (HSM roles come first for the student who plays them).
   Two kinds of practice, because recognizing a feeling and showing it are different skills:
     Show it: hear it, react with face and body, then see the picture, the name and how to show it. The app never judges a face.
     Name it: hear it, then pick the feeling from pictures.
   Show Me (a support): the feeling's picture and how to show it come first, so practice never feels like a test.
   Pictures: img/act/<file> (theatre-notes/acting-pictures-list.md, the same pictures as the script margins); the emoji shows until one exists.
   Practice stays on this device (T.ls 'reactSeen'); nothing is sent. */
(function () {
  'use strict';
  var T = window.T, esc = T.esc, app = document.getElementById('app');
  var sym = function (s) { return '<span class="sym" aria-hidden="true">' + s + '</span> '; };

  /* feelings: [name, picture, emoji, how to show it] */
  var FEEL = {
    happy: ['Happy', 'act-happy.png', '😄', 'big smile, bright eyes, clapping'],
    excited: ['Excited', 'act-excited.png', '🤩', 'big smile, arms up, jumping, clapping'],
    stunned: ['Surprised', 'act-stunned.png', '😲', 'wide eyes, open mouth, eyebrows up, a sudden jump back'],
    hstunned: ['Happily surprised', 'act-happily-stunned.png', '🥹', 'wide eyes and a smile that keeps growing, hands to your face'],
    sad: ['Sad', 'act-sad.png', '😢', 'shoulders drooping, frowning, looking down, moving slowly'],
    annoyed: ['Annoyed', 'act-annoyed.png', '😒', 'eye roll, flat mouth, arms crossed, a big sigh'],
    angry: ['Angry', 'act-angry.png', '😠', 'eyebrows down, tight shoulders, arms crossed, stomping'],
    panic: ['Scared', 'act-panic.png', '😱', 'wide eyes, stepping back, hands over mouth, body tense'],
    nervous: ['Nervous', 'act-nervous.png', '😬', 'biting your lip, worried eyebrows, fidgety hands'],
    confused: ['Confused', 'act-confused.png', '😕', 'head tilted, one eyebrow up, scratching your head, looking around'],
    embarrassed: ['Embarrassed', 'act-embarrassed.png', '😳', 'looking down, covering your face, an awkward smile'],
    suspicious: ['Suspicious', 'act-suspicious.png', '🤨', 'narrowed eyes, looking sideways, leaning back'],
    curious: ['Curious', 'act-curious.png', '🧐', 'leaning in, eyebrows up, finger on your chin'],
    disgusted: ['Disgusted', 'act-disgusted.png', '🤢', 'wrinkled nose, pulling away, tongue out, grimacing'],
    proud: ['Proud', 'act-proud.png', '😎', 'standing tall, a confident smile, hands on hips'],
    relieved: ['Relieved', 'act-relieved.png', '😮‍💨', 'a deep sigh, shoulders relaxing, hand over your heart, a smile'],
    moved: ['Thankful', 'act-moved.png', '🥲', 'hand on your heart, soft happy eyes'],
    sympathetic: ['Sorry for them', 'act-sympathetic.png', '🫂', 'soft eyes, head tilted, reaching out to comfort']
  };
  var BIG = ['happy', 'excited', 'stunned', 'hstunned', 'angry', 'annoyed', 'panic', 'disgusted'];      // level 1 feelings; the rest are level 2

  /* the bank: [sentence, feelings that fit (first = the main one)]; the level comes from the main feeling */
  var BANK = [
    // her warmup cards
    ['We’re going to Disney World tomorrow!', 'excited happy'], ['Everybody gets free ice cream!', 'happy excited'], ['School is canceled tomorrow!', 'excited relieved'],
    ['You just won a million dollars!', 'stunned excited'], ['You all made it into the show!', 'happy excited'], ['We’re getting a puppy!', 'happy excited'],
    ['The field trip has been canceled.', 'sad'], ['Sorry, we’re all out of pizza.', 'sad annoyed'], ['Your favorite TV show has been canceled.', 'sad stunned'],
    ['We lost the championship by one point.', 'sad'], ['Nobody came to my birthday party.', 'sympathetic sad'], ['I’m moving away next week.', 'sad stunned'],
    ['I just found a hair in my food!', 'disgusted'], ['Something in the refrigerator is moving!', 'disgusted panic'], ['There’s a giant booger on your chair!', 'disgusted panic'],
    ['Someone threw up in the swimming pool!', 'disgusted panic'], ['I think that milk expired three months ago.', 'disgusted'],
    ['There’s a spider crawling up your back!', 'panic'], ['The roller coaster is stuck at the very top!', 'panic nervous'], ['I heard something moving in that dark closet.', 'nervous panic'],
    ['The lights just went out, and the door is locked.', 'panic confused'], ['The principal wants to see all of you. Right now.', 'nervous'], ['There’s a snake underneath your chair!', 'panic'],
    ['Someone ate all the cookies you made!', 'angry annoyed'], ['You have to start the whole project over.', 'annoyed'], ['The other team cheated, and they still won!', 'angry'],
    ['Your flight has been delayed for another six hours.', 'annoyed angry'], ['Someone deleted all of our work!', 'angry stunned'], ['You have to stay after school for two more hours.', 'annoyed'],
    ['I just saw a real dinosaur outside!', 'stunned'], ['Taylor Swift is standing right behind you!', 'hstunned excited'], ['Your teacher just announced they’re going to space!', 'stunned'],
    ['That little kid just lifted an entire car!', 'stunned'], ['I just found out we’re all related!', 'confused stunned'],
    ['Your microphone was on that entire time.', 'embarrassed'], ['You have toilet paper stuck to your shoe.', 'embarrassed'], ['Everyone just watched you trip on the stairs.', 'embarrassed'],
    ['You accidentally sent that text to the principal!', 'embarrassed panic'], ['Your mom is here, and she’s bringing your baby pictures!', 'embarrassed'],
    ['The instructions say to put the square inside the circle.', 'confused'], ['I know who stole the cookies, but I’m not telling.', 'suspicious curious'],
    ['One of you is secretly a famous celebrity.', 'curious suspicious'], ['Someone in this room is an undercover spy.', 'suspicious curious'], ['The test answers are all supposed to be the same letter.', 'confused suspicious'],
    ['You got a perfect score on the hardest test!', 'proud excited'], ['We raised enough money to save the animal shelter!', 'proud happy'], ['The missing dog was found, and she’s okay!', 'relieved happy'],
    ['You broke the school record!', 'proud stunned'], ['They found your lost phone!', 'relieved moved'], ['You did it! Everyone thought it was impossible!', 'proud excited'],
    // her 100 practice announcements
    ['You get to pick the movie tonight!', 'excited happy'], ['We’re having pizza for lunch!', 'happy excited'], ['Your best friend is coming over!', 'excited happy'], ['You won the game!', 'excited happy'],
    ['We’re going swimming today!', 'excited happy'], ['Someone brought cupcakes for everyone!', 'happy excited'], ['You’re going to a concert!', 'excited happy'], ['We’re going to the amusement park!', 'excited happy'],
    ['You made the team!', 'excited proud'], ['Today is a snow day!', 'excited happy'],
    ['Your best friend can’t come today.', 'sad'], ['The ice cream machine is broken.', 'sad annoyed'], ['You didn’t win the prize.', 'sad'], ['The party has been canceled.', 'sad'],
    ['Your favorite restaurant is closed.', 'sad'], ['You lost your favorite hoodie.', 'sad'], ['All the tickets are sold out.', 'sad'], ['Your friend is moving to another school.', 'sad'],
    ['The movie you wanted to see isn’t playing.', 'sad annoyed'], ['Your team lost the big game.', 'sad'],
    ['Someone cut in front of you in line!', 'angry'], ['Someone took your seat!', 'angry annoyed'], ['Your game froze right before you won!', 'angry annoyed'], ['Someone ate your lunch!', 'angry'],
    ['You have to clean up a mess you didn’t make.', 'annoyed angry'], ['Someone changed the TV channel without asking.', 'annoyed'], ['You waited an hour, and now the ride is closed.', 'angry sad'],
    ['Someone broke your headphones.', 'angry sad'], ['You have to redo your whole project.', 'annoyed'], ['Someone keeps interrupting you!', 'annoyed angry'],
    ['There’s a giant spider on your shoulder!', 'panic'], ['The roller coaster is about to drop!', 'panic excited'], ['Someone is knocking on the door, but nobody is there.', 'nervous panic'],
    ['The lights just went out!', 'panic'], ['A big dog is running toward you!', 'panic'], ['You have to walk through a haunted house!', 'nervous panic'], ['You heard a loud crash behind you!', 'panic stunned'],
    ['You’re about to give a speech in front of everyone.', 'nervous'], ['The elevator just stopped moving!', 'panic'], ['Something is moving under your bed!', 'panic'],
    ['SURPRISE! It’s your birthday party!', 'hstunned excited'], ['There’s a famous singer in the hallway!', 'hstunned excited'], ['You just won a brand-new phone!', 'hstunned excited'],
    ['Your teacher can do a backflip!', 'stunned'], ['There’s a horse standing in the classroom!', 'stunned confused'], ['Your favorite celebrity just said hello to you!', 'hstunned excited'],
    ['You opened a box, and a puppy jumped out!', 'hstunned happy'], ['You just found twenty dollars in your pocket!', 'hstunned happy'], ['Your principal is wearing a giant chicken costume!', 'stunned'],
    ['Your whole family is waiting outside to surprise you!', 'hstunned happy'],
    ['There’s a bug in your sandwich!', 'disgusted'], ['Someone sneezed right on your food!', 'disgusted'], ['You just stepped in dog poop!', 'disgusted'], ['That milk smells terrible!', 'disgusted'],
    ['There’s a used Band-Aid in the swimming pool!', 'disgusted'], ['You found an old, moldy sandwich in your backpack!', 'disgusted'], ['Someone just burped in your face!', 'disgusted annoyed'],
    ['There’s a big, slimy worm on your desk!', 'disgusted'], ['You accidentally touched someone’s chewed gum!', 'disgusted'], ['Something in the trash can smells awful!', 'disgusted'],
    ['Your teacher just said, ‘Tomorrow is yesterday!’', 'confused'], ['Someone gave you a birthday present, but it’s not your birthday.', 'confused'], ['You walked into class, and everyone is wearing pajamas.', 'confused'],
    ['Your friend keeps calling you by the wrong name.', 'confused annoyed'], ['Someone says their pet fish can talk!', 'confused suspicious'], ['The sign says ‘PUSH,’ but the door won’t open.', 'confused'],
    ['Your friend tells you to look up, but points down.', 'confused'], ['The teacher says, ‘Take out your homework,’ but it’s Saturday.', 'confused'], ['You opened your lunchbox, and there’s a shoe inside!', 'confused stunned'],
    ['Everyone is laughing, but you don’t know why.', 'confused embarrassed'],
    ['You waved at someone, but they were waving at the person behind you!', 'embarrassed'], ['You called your teacher ‘Mom’ by accident!', 'embarrassed'], ['You started singing, and everyone turned to look at you!', 'embarrassed'],
    ['Your pants are on backward!', 'embarrassed'], ['You walked into the wrong classroom!', 'embarrassed'], ['You tripped while walking onto the stage!', 'embarrassed'],
    ['Someone is showing everyone your baby pictures!', 'embarrassed'], ['You accidentally said ‘I love you’ to the wrong person!', 'embarrassed'],
    ['You answered a question, but everyone heard you say the wrong word!', 'embarrassed'], ['Your crush just walked over and said hello!', 'embarrassed happy'],
    ['You got every answer right!', 'proud'], ['You learned the whole dance!', 'proud'], ['Your painting won first place!', 'proud'], ['Everyone loved your performance!', 'proud happy'],
    ['You just scored the winning point!', 'proud excited'], ['You finally learned how to ride a bike!', 'proud'], ['Your teacher picked your artwork to hang in the hallway!', 'proud'],
    ['You helped someone who really needed it!', 'proud happy'], ['You remembered every word of your song!', 'proud'], ['You did something you thought you couldn’t do!', 'proud'],
    ['Your missing dog is safe at home!', 'relieved happy'], ['The test has been postponed!', 'relieved'], ['Someone found your wallet!', 'relieved moved'],
    ['The doctor said you don’t need a shot today!', 'relieved'], ['You almost missed the bus, but the driver waited!', 'relieved moved'], ['Your friend wasn’t mad at you after all!', 'relieved'],
    ['The storm is over, and everyone is safe!', 'relieved'], ['Someone caught your phone before it hit the ground!', 'relieved moved'], ['You thought you failed, but you actually passed!', 'relieved happy']
  ].map(function (b) { var f = b[1].split(' '); return { say: b[0], fit: f, level: BIG.indexOf(f[0]) >= 0 ? 1 : 2 }; });
  /* level 3: who you are first, then what you hear (our own role cards; char = the role in this show, for the student who plays it) */
  var ROLES = [
    ['You really wanted the last slice of pizza.', 'Someone ate the last slice!', 'annoyed sad'],
    ['Your friend signed you up for the play. You didn’t want a part.', 'You got the lead!', 'nervous stunned'],
    ['You are new at this school and don’t know anyone yet.', 'Everyone, find a partner!', 'nervous'],
    ['You studied all week for this test.', 'The test has been canceled!', 'annoyed relieved'],
    ['You told everyone you would win.', 'You came in last place.', 'embarrassed sad'],
    ['Your little brother broke your phone last week.', 'Your little brother is crying because he lost his toy.', 'sympathetic'],
    ['You are Troy. Everyone thinks you only play basketball.', 'Your name is on the callback list for the musical!', 'hstunned nervous', 'troy'],
    ['You are Gabriella. You are new at school and a little shy.', 'Everyone in homeroom is staring at you.', 'embarrassed nervous', 'gabriella'],
    ['You are Sharpay. You have starred in every school show.', 'Two new students got callbacks!', 'angry suspicious', 'sharpay'],
    ['You are Ryan. Your sister makes every decision.', 'Your sister says to do it her way. Again.', 'annoyed', 'ryan'],
    ['You are Chad. Basketball is your whole world.', 'The team captain wants to be in a musical!', 'stunned confused', 'chad'],
    ['You are Taylor. You lead the science team.', 'Your best scientist might skip the big contest.', 'annoyed nervous', 'taylor'],
    ['You are Zeke. You secretly love to bake.', 'Everyone tasted your treats and loved them!', 'proud happy', 'zeke'],
    ['You are Martha. You secretly love to dance.', 'Everyone wants to see you dance!', 'embarrassed hstunned', 'martha'],
    ['You are Kelsi. You write songs, but nobody sings them.', 'Someone wants to sing your song!', 'hstunned happy', 'kelsi'],
    ['You are Ms. Darbus. You love the theater and can’t stand cell phones.', 'A phone is ringing in the middle of class!', 'annoyed angry', 'darbus'],
    ['You are Coach Bolton. The big game is this week.', 'Your star player is at play rehearsal!', 'angry confused', 'coach'],
    ['You are Jack Scott, the school announcer.', 'Everyone is listening to your announcement!', 'proud excited', 'jack'],
    ['You are a Brainiac. Science is your thing.', 'Somebody says a Brainiac can’t dance!', 'annoyed proud', 'brainiacs'],
    ['You are a Jock. Basketball comes first.', 'A teammate says he likes to bake!', 'stunned confused', 'jocks'],
    ['You are a student at East High. Everyone stays with their own group.', 'Someone just broke out of their group!', 'stunned suspicious', 'students']
  ].map(function (r) { var f = r[2].split(' '); return { role: r[0], say: r[1], fit: f, level: 3, char: r[3] || null }; });
  var ALL = BANK.concat(ROLES);
  T.React = { FEEL: FEEL, BANK: BANK, ROLES: ROLES };

  var LEVELS = [[1, 'Level 1: big feelings', '🎉', 'Happy, excited, surprised, scared, angry, grossed out'],
    [2, 'Level 2: quieter feelings', '🤏', 'Disappointed, nervous, confused, embarrassed, proud, relieved'],
    [3, 'Level 3: react as your character', '🎭', 'Who you are first, then what you hear']];
  var st = { level: 1, mode: 'show', showMe: false, words: false, order: null, at: 0 };
  function prefs() { var p = T.ls('react') || {}; ['level', 'mode', 'showMe', 'words'].forEach(function (k) { if (p[k] != null) st[k] = p[k]; }); }
  function keep() { T.ls('react', { level: st.level, mode: st.mode, showMe: st.showMe, words: st.words }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function mine(x) { return !st.teacher && x.char && T.me && (T.me.chars || []).indexOf(x.char) >= 0; }      // on the projector nobody's role comes first
  function deck() {
    var l = ALL.map(function (x, i) { return i; }).filter(function (i) { return ALL[i].level === st.level; });
    shuffle(l);
    if (st.level === 3) l.sort(function (a, b) { return (mine(ALL[b]) ? 1 : 0) - (mine(ALL[a]) ? 1 : 0); });      // my own character's cards first
    return l;
  }
  function pic(k, size, cap) {
    var f = FEEL[k], sz = size || 96;
    return '<figure style="margin:0;text-align:center;width:' + (sz + 40) + 'px"><img src="img/act/' + f[1] + '" alt="" width="' + sz + '" height="' + sz + '" style="border-radius:18px;background:var(--card);object-fit:contain" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{textContent:\'' + f[2] + '\',style:\'font-size:' + Math.round(sz * 0.7) + 'px;line-height:' + sz + 'px\'}))">' +
      '<figcaption style="font-weight:700;font-size:1.15em;margin-top:6px">' + esc(f[0]) + '</figcaption>' + (cap ? '<div class="small muted" style="margin-top:4px">' + esc(f[3]) + '</div>' : '') + '</figure>';
  }
  var row = function (h) { return '<div class="row" style="justify-content:center;flex-wrap:wrap;gap:18px">' + h + '</div>'; };

  function start(back) {
    prefs(); st.teacher = back === '#/teacher';
    T.setBar('React to That!', back);
    var seen = T.ls('reactSeen') || {};
    app.innerHTML = '<div class="card"><h2>' + sym('🎭') + 'React to That!</h2>' +
      '<p>Actors react even when they don’t have a line. Listen to what happens, then show how it makes you feel.</p>' +
      '<div class="switch"><span><b>How do you want to practice?</b></span><div class="seg" id="rm"><button type="button" data-v="show" aria-pressed="' + (st.mode === 'show') + '">Show it: react with my face and body</button>' +
      '<button type="button" data-v="name" aria-pressed="' + (st.mode === 'name') + '">Name it: pick the feeling</button></div></div>' +
      '<label class="switch"><span>Show Me: see the feeling and how to show it first</span><input type="checkbox" id="rs"' + (st.showMe ? ' checked' : '') + (st.mode === 'name' ? ' disabled' : '') + '></label>' +
      '<label class="switch"><span>Show the words too</span><input type="checkbox" id="rw"' + (st.words ? ' checked' : '') + '></label>' +
      '<p class="muted small">More than one feeling can fit, and your character might feel something different. That’s OK. The app never grades your face: you look, compare, and try again.</p></div>' +
      '<h3>Pick a level</h3><div class="grid">' + LEVELS.map(function (L) {
        var n = ALL.filter(function (x) { return x.level === L[0]; }).length, done = ALL.filter(function (x, i) { return x.level === L[0] && seen[i]; }).length;
        return '<button class="tile" data-l="' + L[0] + '" style="min-height:120px' + (st.level === L[0] ? ';border-color:var(--accent)' : '') + '"><span style="font-size:2em">' + L[2] + '</span><b>' + esc(L[1]) + '</b><span>' + esc(L[3]) + '</span><span class="small">' + done + ' of ' + n + ' practiced</span></button>';
      }).join('') + '</div>';
    app.querySelectorAll('#rm [data-v]').forEach(function (b) { b.onclick = function () { st.mode = b.dataset.v; keep(); start(back); }; });
    document.getElementById('rs').onchange = function () { st.showMe = this.checked; keep(); };
    document.getElementById('rw').onchange = function () { st.words = this.checked; keep(); };
    app.querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { st.level = +b.dataset.l; keep(); st.order = deck(); st.at = 0; round(back); }; });
  }

  function round(back) {
    var i = st.order[st.at], x = ALL[i];
    if (i == null) { start(back); return; }
    T.setBar('React to That! · ' + (st.at + 1) + ' of ' + st.order.length, back);
    var timer = null;
    T.cleanup.push(function () { T.Speech.stop(); clearTimeout(timer); });
    var roleCard = x.role ? '<div class="card" style="background:var(--bg);margin-bottom:12px">' + sym('🎭') + '<b>' + esc(x.role) + '</b>' + (mine(x) ? ' <span class="tag">your role</span>' : '') + '</div>' : '';
    /* Show Me: the feeling and how to show it, before anything is said */
    if (st.showMe && st.mode === 'show' && !x._primed) {
      app.innerHTML = '<div class="card" style="text-align:center">' + roleCard + '<p class="muted">Get ready to show this feeling:</p>' + row(pic(x.fit[0], 160, true)) +
        '<div class="row" style="justify-content:center;margin-top:16px"><button class="btn primary" id="go">' + sym('👂') + 'I’m ready: say it</button></div></div>';
      document.getElementById('go').onclick = function () { x._primed = true; round(back); };
      return;
    }
    delete x._primed;
    var choices = null;
    if (st.mode === 'name') {      // the main feeling and two that don't fit, mixed up
      var others = shuffle(Object.keys(FEEL).filter(function (k) { return x.fit.indexOf(k) < 0; })).slice(0, 2);
      choices = shuffle([x.fit[0]].concat(others));
    }
    app.innerHTML = '<div class="card" style="text-align:center">' + roleCard + '<p class="muted">' + (st.mode === 'name' ? 'Listen. How would you feel?' : 'Listen, then react with your face and body.') + '</p>' +
      '<p id="rt" style="font-size:1.7em;font-weight:700;min-height:2.4em;margin:16px 0">' + (st.words ? '“' + esc(x.say) + '”' : sym('🔊') + '<span class="muted">Listening…</span>') + '</p>' +
      '<div id="rc" style="font-size:3em;font-weight:800;min-height:1.4em" aria-live="polite"></div>' +
      (choices ? '<div id="pick">' + row(choices.map(function (k) { return '<button class="btn" data-k="' + k + '" style="padding:10px;height:auto">' + pic(k, 90) + '</button>'; }).join('')) + '</div>' : '') +
      '<div class="row" style="justify-content:center;flex-wrap:wrap;gap:10px;margin-top:10px"><button class="btn" id="ag">' + sym('🔁') + 'Hear it again</button>' +
      (choices ? '' : '<button class="btn primary" id="sh">' + sym('👀') + 'What fits?</button>') + '</div><div id="ans"></div></div>';
    var said = function () {
      if (st.mode === 'name') return;
      document.getElementById('rc').textContent = 'React!';
      timer = setTimeout(function () { var c = document.getElementById('rc'); if (c) c.textContent = ''; }, 2500);
    };
    var speak = function () { T.Speech.stop(); clearTimeout(timer); document.getElementById('rc').textContent = ''; T.Speech.say(x.say).then(said); };
    speak();
    document.getElementById('ag').onclick = speak;
    var reveal = function (lead) {
      clearTimeout(timer);
      document.getElementById('rt').innerHTML = '“' + esc(x.say) + '”';
      document.getElementById('rc').textContent = '';
      var sh = document.getElementById('sh'); if (sh) sh.style.display = 'none';
      document.getElementById('ans').innerHTML = (lead || '<h3 style="margin-top:18px">' + (x.fit.length > 1 ? 'These fit' : 'This fits') + '</h3>') +
        row(x.fit.map(function (k, j) { return pic(k, j === 0 ? 150 : 110, true); }).join('')) +
        (st.mode === 'show' ? '<p style="margin-top:16px">Did your face and body show it?</p>' : '<p style="margin-top:16px">Now try showing it with your face and body.</p>') +
        '<div class="row" style="justify-content:center;flex-wrap:wrap;gap:10px">' +
        (st.mode === 'show' ? [['yes', '👍 Yes'], ['some', '🤏 Some of it'], ['no', '🔁 Not yet']] : [['yes', 'Next ➜'], ['no', '🔁 Practice this one again later']]).map(function (b) { return '<button class="btn' + (b[0] === 'yes' ? ' primary' : '') + '" data-m="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div>';
      document.querySelectorAll('[data-m]').forEach(function (b) {
        b.onclick = function () {
          var seen = T.ls('reactSeen') || {}; seen[i] = b.dataset.m; T.ls('reactSeen', seen);
          if (b.dataset.m === 'no') st.order.splice(Math.min(st.order.length, st.at + 4), 0, i);      // it comes back a few cards later
          st.at++; round(back);
        };
      });
    };
    var sh = document.getElementById('sh'); if (sh) sh.onclick = function () { reveal(); };
    app.querySelectorAll('[data-k]').forEach(function (b) {
      b.onclick = function () {
        var good = x.fit.indexOf(b.dataset.k) >= 0;
        document.getElementById('pick').style.display = 'none';
        reveal('<h3 style="margin-top:18px">' + (good ? sym('🎉') + 'Yes! That fits.' : 'Good thinking. Here’s what most people would feel:') + '</h3>');
      };
    });
  }

  T.studentPages = T.studentPages || {};
  T.studentPages.react = function () { start('#/home'); };
  T.teacherPages = T.teacherPages || {};
  T.teacherPages.react = function () { start('#/teacher'); };      // the same practice on the projector for the Monday warmup
})();
