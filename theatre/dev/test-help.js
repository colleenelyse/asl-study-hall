/* node theatre/dev/test-help.js — Volunteer and donate (js/volunteers.js): the Company dinner's list of things to bring, and who brings what */
const H = require('../js/volunteers.js');
let bad = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) bad++; };
const items = H.parseItems('Main dish (serves 10) x 4\nSalad × 2\n\nPlates, cups, napkins\nDessert: x3');
ok(items.length === 4 && items[0].name === 'Main dish (serves 10)' && items[0].need === 4 && items[1].need === 2 && items[2].need === 1 && items[2].name === 'Plates, cups, napkins' && items[3].name === 'Dessert' && items[3].need === 3, 'one per line, “x 3” at the end');
const again = H.parseItems('Main dish (serves 10) x 5\nSalad x 2\nRolls', items);
ok(again[0].id === items[0].id && again[0].need === 5 && again[2].id !== items[2].id, 'editing keeps an item’s place on the plan (same name), a new name starts fresh');
ok(H.itemsText(items).split('\n')[0] === 'Main dish (serves 10) x 4' && H.itemsText(items).split('\n')[2] === 'Plates, cups, napkins', 'and back to text for editing');
const m = id => items.find(i => i.name.startsWith(id)).id;
const msgs = [
  { t: 'claim', cid: 'c1', did: 'dA', item: m('Main'), qty: 2, who: 'Pat L.', email: 'pat@x.org' },
  { t: 'claim', cid: 'c2', did: 'dB', item: m('Main'), qty: 1, who: 'Kim R.' },
  { t: 'claim', cid: 'c3', did: 'dB', item: m('Salad'), qty: 1, who: 'Kim R.' },
  { t: 'msg', who: 'Pat L.', text: 'I can do lasagna' },
  { t: 'unclaim', ref: 'c3', did: 'dB' },
  { t: 'unclaim', ref: 'c1', did: 'dZ' }];
const t = H.tally(items, msgs);
ok(t[m('Main')].got === 3 && t[m('Main')].who.length === 2, 'two families split the main dishes');
ok(t[m('Salad')].got === 0, 'a family can take back what they signed up for');
ok(t[m('Main')].who.some(w => w.cid === 'c1'), 'only the device that signed up can take it back');
ok(t[m('Main')].who[0].email === 'pat@x.org' && !t[m('Main')].who[1].email, 'an email shows only for a family who chose to share it');
process.exit(bad ? 1 : 0);
