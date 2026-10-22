/* Runs the script reader on a licensed actor's script and prints counts only (never the script's words).
   1) turn the PDF into text positions:  python3 theatre/dev/pdf-to-items.py SCRIPT.pdf /tmp/items.json
   2) node theatre/dev/test-script-parser.js /tmp/items.json
   Never commit a script PDF or items.json: the script is licensed to this cast only. */
const P = require('../js/script-parser.js');
const pages = require(require('path').resolve(process.argv[2]));
const songNumbers = (window => window.DEFAULT_SHOW.songs.map(s => s.num))({ get DEFAULT_SHOW() { global.window = {}; require('../js/show-hsm-jr.js'); return global.window.DEFAULT_SHOW; } });
const r = P.parse(pages, { songNumbers });
let lines = 0, lyr = 0;
for (const s of r.scenes) {
  const by = {}, songs = [];
  for (const it of s.items) {
    if (it.type === 'line') { lines++; by[it.who] = (by[it.who] || 0) + 1; }
    if (it.type === 'song') { songs.push('#' + it.num + ' (' + it.lyrics.length + ' lyric lines; ' + it.singers.join('/') + ')'); lyr += it.lyrics.length; }
  }
  console.log('Scene ' + s.num + ' p.' + s.page + ' ' + s.place + '\n   ' + JSON.stringify(by) + '\n   ' + songs.join('  '));
}
console.log('dialogue lines:', lines, ' lyric lines:', lyr);
