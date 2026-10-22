/* Storage for asl.cool/theatre: the encrypted show, the tracks, and this device's own copy.
   The show (lines, lyrics, cast, photos) is encrypted with a random show key. The cast password unwraps that key
   (PBKDF2-SHA256, 250k rounds, then AES-GCM), so changing the cast password only re-wraps the key, and the tracks stay readable.
   A remembering iPad keeps the show key (never the password) and the last encrypted copy in IndexedDB, so it opens without Wi-Fi.
   Saving needs the teacher password too: the page sends PBKDF2(teacherPw, vsalt) as proof, never the password. */
(function (root) {
  'use strict';
  var ITER = 250000, API = '/theatre/api/';
  var te = new TextEncoder(), td = new TextDecoder();
  function b64(bytes) { var s = '', a = new Uint8Array(bytes); for (var i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function rand(n) { return crypto.getRandomValues(new Uint8Array(n)); }

  /* ---- IndexedDB: one key/value store ---- */
  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (ok, no) {
      var r = indexedDB.open('theatre', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(r.error); };
    });
    return dbp;
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, no) {
        var tx = d.transaction('kv', mode), st = tx.objectStore('kv'), req = fn(st);
        tx.oncomplete = function () { ok(req && req.result); };
        tx.onerror = tx.onabort = function () { no(tx.error); };
      });
    });
  }
  var local = {
    get: function (k) { return idb('readonly', function (s) { return s.get(k); }).catch(function () { return undefined; }); },
    set: function (k, v) { return idb('readwrite', function (s) { return s.put(v, k); }); },
    del: function (k) { return idb('readwrite', function (s) { return s.delete(k); }); }
  };

  /* ---- keys ---- */
  function pwKey(pw, salt, iter) {
    return crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function proofBits(pw, vsaltB64) {
    return crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(vsaltB64), iterations: ITER }, base, 256);
    }).then(b64);
  }
  function sha256hex(b64s) {
    return crypto.subtle.digest('SHA-256', unb64(b64s)).then(function (d) { return Array.from(new Uint8Array(d)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); });
  }
  function newShowKey() { return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']); }
  function seal(key, bytes) {
    var iv = rand(12);
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes).then(function (ct) { return { iv: b64(iv), data: b64(ct) }; });
  }
  function open(key, box) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.data)); }

  /* the show key, from the cast password and the saved show */
  function unlock(enc, castPw) {
    return pwKey(castPw, unb64(enc.salt), enc.iter).then(function (k) { return open(k, enc.wrap); })
      .then(function (raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']); });
  }
  function decryptShow(key, enc) { return open(key, enc).then(function (b) { return JSON.parse(td.decode(b)); }); }
  /* encrypt the show; the key is wrapped with the cast password (a new password, or the one this device unlocked with) */
  function encryptShow(key, doc, castPw, prevEnc) {
    var body = seal(key, te.encode(JSON.stringify(doc)));
    var wrap;
    if (castPw) {
      var salt = rand(16);
      wrap = Promise.all([pwKey(castPw, salt, ITER), crypto.subtle.exportKey('raw', key)]).then(function (r) {
        return seal(r[0], r[1]).then(function (w) { return { iter: ITER, salt: b64(salt), wrap: w }; });
      });
    } else wrap = Promise.resolve({ iter: prevEnc.iter, salt: prevEnc.salt, wrap: prevEnc.wrap });
    return Promise.all([body, wrap]).then(function (r) { return { iter: r[1].iter, salt: r[1].salt, wrap: r[1].wrap, iv: r[0].iv, data: r[0].data }; });
  }

  /* ---- the server ---- */
  function getJSON(path) {
    return fetch(API + path, { cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('The server said ' + r.status);
      return r.json();
    });
  }
  function postJSON(path, body) {
    return fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || ('The server said ' + r.status)); return d; }); });
  }

  /* where a sealed file lives on the server: a song's track, the script PDF, or a line's audio */
  function pathFor(id, kind) { return id === '__pdf' ? 'pdf' : id.indexOf('__voice/') === 0 ? 'voice/' + id.slice(8) : 'track/' + id + '/' + kind; }
  var Store = {
    local: local, b64: b64, unb64: unb64,
    /* the saved show from asl.cool (or this device's copy when offline). {enc, vsalt, updated, offline} or null before setup */
    fetchShow: function () {
      return getJSON('show').then(function (d) {
        if (d && d.enc) local.set('enc', d);
        return d;
      }).catch(function () {
        return local.get('enc').then(function (d) { if (!d) throw new Error('No internet, and this iPad has no copy of the show yet.'); d.offline = true; return d; });
      });
    },
    unlock: unlock, decryptShow: decryptShow,
    remember: function (key) { return local.set('key', key); },
    rememberedKey: function () { return local.get('key'); },
    forget: function () { return Promise.all([local.del('key'), local.del('enc'), local.del('me')]); },
    newShowKey: newShowKey,
    /* the teacher password, as proof for the server */
    proof: proofBits,
    checkTeacher: function (proof) { return postJSON('check', { proof: proof }); },
    /* save the show. opts: { proof, castPw (to set or change it), newTeacherPw, setup } */
    save: function (key, doc, prev, opts) {
      opts = opts || {};
      var extra = opts.newTeacherPw ? (function () {
        var vs = b64(rand(16));
        return proofBits(opts.newTeacherPw, vs).then(sha256hex).then(function (h) { return { newVsalt: vs, newVhash: h }; });
      })() : Promise.resolve({});
      return Promise.all([encryptShow(key, doc, opts.castPw, prev && prev.enc), extra]).then(function (r) {
        var body = { proof: opts.proof, enc: r[0], setup: opts.setup };
        Object.assign(body, r[1]);
        return postJSON('show', body).then(function (d) {
          var saved = { enc: r[0], vsalt: r[1].newVsalt || (prev && prev.vsalt), updated: d.updated };
          local.set('enc', saved);
          return saved;
        });
      });
    },
    /* a student's practice record, sealed with the show key */
    putProgress: function (key, actor, obj) { return seal(key, te.encode(JSON.stringify(obj))).then(function (box) { return postJSON('progress/' + actor, { box: box }); }); },
    getProgress: function (key, actor) {
      return getJSON('progress/' + actor).then(function (d) { return d && d.box ? open(key, d.box).then(function (b) { return JSON.parse(td.decode(b)); }) : null; });
    },
    allProgress: function (key, proof) {
      return fetch(API + 'progress', { headers: { 'x-proof': proof }, cache: 'no-store' }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || ('The server said ' + r.status)); return d.records || []; }); })
        .then(function (list) { return Promise.all(list.map(function (x) { return open(key, x.box).then(function (b) { return { actor: x.actor, at: x.at, rec: JSON.parse(td.decode(b)) }; }, function () { return null; }); })); })
        .then(function (l) { return l.filter(Boolean); });
    },
    /* notes from students' iPads (a rehearsal conflict), sealed with the show key */
    sendNote: function (key, obj) {
      return seal(key, te.encode(JSON.stringify(obj))).then(function (box) { return postJSON('notes', { box: box }); });
    },
    /* a note that can wait: on a field trip there is often no Wi-Fi. Kept on this iPad (sealed) and sent when it is back online. */
    queueNote: function (key, obj) {
      return seal(key, te.encode(JSON.stringify(obj))).then(function (box) {
        var q; try { q = JSON.parse(localStorage.getItem('theatre:noteQueue') || '[]'); } catch (e) { q = []; }
        q.push(box); try { localStorage.setItem('theatre:noteQueue', JSON.stringify(q.slice(-300))); } catch (e) {}
        return Store.flushNotes();
      });
    },
    flushNotes: function () {
      var q; try { q = JSON.parse(localStorage.getItem('theatre:noteQueue') || '[]'); } catch (e) { q = []; }
      if (!q.length || !navigator.onLine) return Promise.resolve(q.length);
      var left = q.slice();
      return q.reduce(function (p, box) { return p.then(function () { return postJSON('notes', { box: box }).then(function () { left.shift(); }); }); }, Promise.resolve())
        .catch(function () {}).then(function () { try { localStorage.setItem('theatre:noteQueue', JSON.stringify(left)); } catch (e) {} return left.length; });
    },
    getNotes: function (key, proof) {
      return fetch(API + 'notes', { headers: { 'x-proof': proof }, cache: 'no-store' }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || ('The server said ' + r.status)); return d.notes || []; }); })
        .then(function (list) {
          return Promise.all(list.map(function (n) {
            return open(key, n.box).then(function (b) { var o = JSON.parse(td.decode(b)); o._id = n.id; o._at = n.at; return o; }, function () { return { _id: n.id, _junk: true }; });      // not sealed with this show's key: junk
          }));
        });
    },
    clearNotes: function (proof, ids) {
      return fetch(API + 'notes', { method: 'DELETE', headers: { 'x-proof': proof, 'content-type': 'application/json' }, body: JSON.stringify({ ids: ids }) }).then(function (r) { if (!r.ok) throw new Error('Could not clear the notes.'); });
    },
    /* tracks: encrypted bytes on the server, and a copy on this device */
    /* a line's audio (ElevenLabs or an approved recording), sealed; and students' recordings waiting for the teacher */
    putVoice: function (key, proof, h, src, bytes, ver) { return Store.putTrack(key, proof, '__voice/' + h + '/' + src, '', bytes, ver); },
    getVoice: function (key, h, src, ver) { return Store.getTrack(key, '__voice/' + h + '/' + src, '', ver); },
    sendRecording: function (key, h, actor, bytes) {
      var iv = rand(12);
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes).then(function (ct) {
        var out = new Uint8Array(12 + ct.byteLength); out.set(iv, 0); out.set(new Uint8Array(ct), 12);
        return fetch(API + 'voice/' + h + '/pending/' + actor, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: out })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || ('The server said ' + r.status)); return d; }); });
      });
    },
    voiceIndex: function () {      // which lines have audio (kept on the device for offline use)
      return getJSON('voice/index').then(function (d) { if (d) local.set('voiceIndex', d); return d || { lines: {} }; }).catch(function () { return local.get('voiceIndex').then(function (d) { return d || { lines: {} }; }); });
    },
    setVoiceCheck: function (proof, check) { return postJSON('voice/settings', { proof: proof, check: !!check }); },
    pendingList: function (proof) { return fetch(API + 'voice/pending', { headers: { 'x-proof': proof }, cache: 'no-store' }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Could not load the recordings.'); return d.pending || []; }); }); },
    getPending: function (key, proof, h, actor) {
      return fetch(API + 'voice/' + h + '/pending/' + actor, { headers: { 'x-proof': proof }, cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('That recording would not load.'); return r.arrayBuffer(); })
        .then(function (b) { var a = new Uint8Array(b); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: a.subarray(0, 12) }, key, a.subarray(12)); });
    },
    approve: function (proof, h, actor) { return fetch(API + 'voice/' + h + '/approve/' + actor, { method: 'POST', headers: { 'x-proof': proof } }).then(function (r) { if (!r.ok) throw new Error('Could not approve it.'); }); },
    reject: function (proof, h, actor) { return fetch(API + 'voice/' + h + '/pending/' + actor, { method: 'DELETE', headers: { 'x-proof': proof } }).then(function (r) { if (!r.ok) throw new Error('Could not remove it.'); }); },
    /* the script PDF: sealed, saved like a track, and kept on the device by version */
    putPdf: function (key, proof, bytes, ver) { return Store.putTrack(key, proof, '__pdf', '', bytes, ver); },
    getPdf: function (key, ver) { return Store.getTrack(key, '__pdf', '', ver); },
    putTrack: function (key, proof, songId, kind, bytes, ver) {
      var iv = rand(12);
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes).then(function (ct) {
        var out = new Uint8Array(12 + ct.byteLength); out.set(iv, 0); out.set(new Uint8Array(ct), 12);
        return fetch(API + pathFor(songId, kind), { method: 'POST', headers: { 'x-proof': proof, 'content-type': 'application/octet-stream' }, body: out })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || ('The server said ' + r.status)); var lk = 'track:' + songId + ':' + kind; return local.set(lk, out.buffer).then(function () { return local.set(lk + ':v', ver); }).then(function () { return d; }, function () { return d; }); }); });
      });
    },
    delTrack: function (proof, songId, kind) {
      return fetch(API + 'track/' + songId + '/' + kind, { method: 'DELETE', headers: { 'x-proof': proof } }).then(function () { return local.del('track:' + songId + ':' + kind); });
    },
    /* the decrypted track bytes; from this device when it has them (ver: the show's note of when the track changed) */
    getTrack: function (key, songId, kind, ver) {
      var lk = 'track:' + songId + ':' + kind;
      return local.get(lk + ':v').then(function (have) {
        var cached = have === ver ? local.get(lk) : Promise.resolve(null);
        return cached.then(function (buf) {
          if (buf) return buf;
          return fetch(API + pathFor(songId, kind), { cache: 'no-store' }).then(function (r) {
            if (r.status === 404) return null;
            if (!r.ok) throw new Error('Could not load the track (' + r.status + ').');
            return r.arrayBuffer().then(function (b) { return local.set(lk, b).then(function () { return local.set(lk + ':v', ver); }).then(function () { return b; }, function () { return b; }); });
          });
        });
      }).then(function (buf) {
        if (!buf) return null;
        var a = new Uint8Array(buf);
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: a.subarray(0, 12) }, key, a.subarray(12));
      });
    }
  };
  root.Store = Store;
  window.addEventListener('online', function () { Store.flushNotes(); });
})(window);
