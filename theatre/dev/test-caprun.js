/* node theatre/dev/test-caprun.js — Run the captions (js/caprun.js): stepping through cues, automatic Help timing, the clicker's keys */
const R = require('../js/caprun.js');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const line = (who, text) => ({ type: 'still', card: { who, name: who + ':', text, full: text } });
const song = (num, title) => ({ type: 'song', song: { id: 's' + num, num, title } });
const cues = [line('TROY', 'Hey.'), song(1, 'Start of Something New'), line('GABRIELLA', 'That was fun.'), line('TROY', 'Yeah, it was.'), line('TROY', 'Yeah, it was.'), song(2, 'Get’cha Head in the Game')];
const keyOf = c => c ? (c.who || '') + '|' + (c.full || c.text) : '';

ok(R.back(cues, 2) === 0, 'Back from the line after a song skips the song (so the music does not start again)');
ok(R.back(cues, 3) === 2 && R.back(cues, 0) === -1, 'Back goes one line, or to before the show');
ok(R.nextSong(cues, 0) === 1 && R.nextSong(cues, 2) === 5 && R.nextSong(cues, 5) === -1, 'the next song, to load its music ahead');
const up = R.upcoming(cues, 2, keyOf);
ok(up.length === 2 && up[0].text === 'That was fun.' && up[1].text === 'Yeah, it was.', 'coming up: the next two different lines');
ok(R.upcoming(cues, 3, keyOf).length === 2 && R.upcoming(cues, 3, keyOf)[1].song === '#2 Get’cha Head in the Game', 'a long line split in two counts once; a song shows by name');
ok(Math.abs(R.expected({ full: 'I can’t believe you are here tonight with all of us' }) - 11 / 2.6) < 0.01, 'a line takes about 2.6 words a second to say');
ok(R.expected({ full: 'Hey.' }) === 1.5, 'at least a second and a half');
ok(R.expected({ full: '♪ We’re all in this together ♪' }) === Math.max(1.5, 5 / 2.6), 'music signs are not words');
ok(['PageDown', ' ', 'ArrowRight', 'Enter'].every(k => R.keyAction(k) === 'go'), 'GO: the clicker’s forward button, Space, → and Enter');
ok(['PageUp', 'ArrowLeft'].every(k => R.keyAction(k) === 'back'), 'Back: the clicker’s back button and ←');
ok(['b', '.', 'h'].every(k => R.keyAction(k) === 'help') && R.keyAction('x') === 'black' && R.keyAction('q') === null, 'Help: the clicker’s blank-screen button (B or .) and H; X blackout');
ok(R.clock(75.4) === '1:15' && R.clock(-3) === '0:00', 'times as m:ss');
process.exit(bad ? 1 : 0);
