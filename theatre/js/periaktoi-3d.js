/* asl.cool/theatre: the realistic 3D audience and backstage views of the set planner (Colleen 2026-10-25: "i want the 3d artwork to look as
   realistic as possible"). three.js r128 (loaded from cdnjs the first time it is needed). Solid triangular towers with her face art, real
   pieces (img/set/overlays.json: her transparent overlays, placed exactly as drawn, standing out from the face by their depth), the 18″ rim and
   net as a real hoop, the cafeteria tables and benches, a wood floor, the grand drape, the proscenium, front-of-house light with shadows.
   Three.js axes: x = stage x (toward stage left), y = up, z = −stage y (toward the audience). All in feet. PK3D.draw(host, ctx). */
(function () {
  'use strict';
  var BASE = 'https:' + '//cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var loading = null, three = null, ready = false;
  function load() {
    if (loading) return loading;
    loading = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = BASE; s.onload = function () { three = window.THREE; ready = true; ok(); }; s.onerror = function () { no(new Error('3D library did not load')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  var W = {};      // world: scene, objects, textures (shared by both views)
  var views = [];  // { host, canvas, renderer, camera, crew, drag }
  var overlays = null, ovTex = {}, faceTex = {}, faceSrc = {};

  function canvasTex(w, h, paint) { var c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); var t = new three.CanvasTexture(c); t.encoding = three.sRGBEncoding; t.anisotropy = 8; return t; }
  function woodTex() {
    return canvasTex(1024, 1024, function (g, w, h) {
      for (var i = 0; i < 16; i++) { var y = i * h / 16, hue = 26 + (i * 7 % 5), l = 22 + (i * 13 % 7); g.fillStyle = 'hsl(' + hue + ',38%,' + l + '%)'; g.fillRect(0, y, w, h / 16);
        for (var k = 0; k < 40; k++) { g.strokeStyle = 'rgba(0,0,0,' + (0.04 + (k % 3) * 0.02) + ')'; g.beginPath(); var yy = y + (k * 37 % 61) / 61 * h / 16; g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + 3, w * 0.6, yy - 3, w, yy + 1); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, y, w, 2); var j = (i * 389) % w; g.fillRect(j, y, 2, h / 16); }
    });
  }
  function velvetTex() {
    return canvasTex(1024, 512, function (g, w, h) {
      for (var x = 0; x < w; x++) { var f = 0.55 + 0.45 * Math.sin(x / w * Math.PI * 2 * 26) * Math.sin(x / w * Math.PI * 2 * 3.3 + 1); var r = Math.round(8 + 14 * f), gg = Math.round(14 + 22 * f), b = Math.round(40 + 70 * f); g.fillStyle = 'rgb(' + r + ',' + gg + ',' + b + ')'; g.fillRect(x, 0, 1, h); }      // dark blue velvet (the Reber grand)
      var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  }
  function shimmerTex() { return canvasTex(256, 512, function (g, w, h) { for (var x = 0; x < w; x += 2) { var v = 150 + Math.round(Math.random() * 105); g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 10 > 255 ? 255 : v + 10) + ')'; g.fillRect(x, 0, 2, h); } }); }

  function build(ctx) {
    var T3 = three, P = ctx.P, s = P.stage, c = s.prosc / 2;
    var scene = new T3.Scene(); scene.background = new T3.Color(0x050407); scene.fog = new T3.Fog(0x050407, 70, 140);
    W = { scene: scene, towers: {}, tables: {}, items: {}, key: JSON.stringify(s) };
    // the floor: the curved apron in front of the drape, and the side decks
    var shape = new T3.Shape(); shape.moveTo(-c, s.curtain);      // in stage x, y: laid flat it lands on three's x, −z
    for (var i = 0; i <= 60; i++) { var x = -c + 2 * c * i / 60; shape.lineTo(x, ctx.PK.frontY(s, x)); }
    shape.lineTo(c, s.curtain); shape.lineTo(-c, s.curtain);
    var wood = woodTex(); wood.wrapS = wood.wrapT = T3.RepeatWrapping; wood.repeat.set(0.08, 0.08);
    var floorMat = new T3.MeshStandardMaterial({ map: wood, roughness: 0.42, metalness: 0.05 });
    var floorMat2 = floorMat.clone(); floorMat2.side = T3.DoubleSide; var floor = new T3.Mesh(new T3.ShapeGeometry(shape), floorMat2); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    [-1, 1].forEach(function (k) {      // side decks (Horticulture HQ stage right, NYE karaoke stage left)
      var g = new T3.PlaneGeometry(s.sideDeck, s.edgeSide), m = new T3.Mesh(g, floorMat); m.rotation.x = -Math.PI / 2; m.position.set(k * (c + s.sideDeck / 2), 0, (s.wallT || 0) + s.edgeSide / 2); m.receiveShadow = true; scene.add(m);
    });
    // the grand drape (seen only from the house) and the proscenium
    var vel = velvetTex(); vel.wrapS = T3.RepeatWrapping; vel.repeat.set(3, 1);
    var drape = new T3.Mesh(new T3.PlaneGeometry(2 * c, 24), new T3.MeshStandardMaterial({ map: vel, roughness: 0.9, side: T3.FrontSide })); drape.position.set(0, 12, -s.curtain); drape.receiveShadow = true; scene.add(drape); W.drape = drape;
    var wallMat = new T3.MeshStandardMaterial({ color: 0x1a1820, roughness: 1 }), wt = s.wallT || 1;      // the proscenium wall, about 2 ft thick
    [-1, 1].forEach(function (k) { var m = new T3.Mesh(new T3.BoxGeometry(14, 30, wt), wallMat); m.position.set(k * (c + s.sideDeck + 7), 15, wt / 2); scene.add(m); var m2 = new T3.Mesh(new T3.BoxGeometry(s.sideDeck, 30, wt), wallMat); m2.position.set(k * (c + s.sideDeck / 2), 15 + 10, wt / 2); scene.add(m2); });
    var header = new T3.Mesh(new T3.BoxGeometry(2 * c + 4, 10, wt), wallMat); header.position.set(0, 24 + 5, wt / 2); scene.add(header);
    var border = new T3.Mesh(new T3.PlaneGeometry(2 * c, 6), new T3.MeshStandardMaterial({ map: vel, roughness: 0.9 })); border.position.set(0, 21, -(s.border || 1.17)); scene.add(border); W.border = border;      // the grand border (teaser), lineset 1
    W.nye = new T3.Mesh(new T3.PlaneGeometry(s.sideDeck - 0.6, 10), new T3.MeshStandardMaterial({ map: shimmerTex(), roughness: 0.25, metalness: 0.8 })); W.nye.position.set(c + s.sideDeck / 2, 5, wt + 0.05); scene.add(W.nye);
    W.hort = new T3.Mesh(new T3.PlaneGeometry(s.sideDeck - 0.6, 10), new T3.MeshStandardMaterial({ color: 0x3f7a45, roughness: 0.9 })); W.hort.position.set(-c - s.sideDeck / 2, 5, wt + 0.05); scene.add(W.hort);
    // light: two front-of-house spots from the box booms, a warm top fill, a little ambience
    scene.add(new T3.HemisphereLight(0x8890b0, 0x201810, 0.35));
    [-1, 1].forEach(function (k) {
      var sp = new T3.SpotLight(0xfff1dc, 1.25, 0, 0.55, 0.6, 1.2); sp.position.set(k * 18, 26, 42); sp.target.position.set(0, 3, -2); sp.castShadow = true; sp.shadow.mapSize.set(2048, 2048); sp.shadow.bias = -0.0004; sp.shadow.camera.near = 20; sp.shadow.camera.far = 120;
      scene.add(sp); scene.add(sp.target);
    });
    var top = new T3.SpotLight(0xffe2b8, 0.5, 0, 0.9, 0.8, 1.5); top.position.set(0, 30, -6); top.target.position.set(0, 0, -2); scene.add(top); scene.add(top.target);
    // the four towers: three faces (her art), black top and bottom caps
    ctx.PK.TOWERS.forEach(function (t) {
      var grp = new T3.Group(), faces = {};
      [1, 2, 3].forEach(function (k) {
        var id = t + k, fg = new T3.Group(), mat = new T3.MeshStandardMaterial({ roughness: 0.78, metalness: 0 });
        var mesh = new T3.Mesh(new T3.PlaneGeometry(s.face, s.height), mat); mesh.castShadow = true; mesh.receiveShadow = true; fg.add(mesh);
        faces[id] = { group: fg, mesh: mesh, mat: mat, extras: [] }; grp.add(fg);
      });
      var capMat = new T3.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, side: T3.DoubleSide }), r = s.face / Math.sqrt(3), tri = new T3.Shape();
      tri.moveTo(0, r); tri.lineTo(-s.face / 2, -r / 2); tri.lineTo(s.face / 2, -r / 2); tri.lineTo(0, r);
      var cap = new T3.Mesh(new T3.ShapeGeometry(tri), capMat); cap.rotation.x = -Math.PI / 2; cap.position.y = s.height; cap.castShadow = true; grp.add(cap);
      var label = makeLabel(t, ctx.COL[t]); label.position.y = s.height + 0.9; grp.add(label);
      scene.add(grp); W.towers[t] = { group: grp, faces: faces, cap: cap, label: label };
    });
    // the rim and net on D1 (a real 18″ hoop)
    var rimMat = new T3.MeshStandardMaterial({ color: 0xff5a00, roughness: 0.4, metalness: 0.3 });
    W.rim = new T3.Group();
    var ring = new T3.Mesh(new T3.TorusGeometry(0.75, 0.035, 10, 40), rimMat); ring.rotation.x = Math.PI / 2; ring.castShadow = true; W.rim.add(ring);
    var net = new T3.Mesh(new T3.CylinderGeometry(0.72, 0.42, 1.25, 16, 4, true), new T3.MeshStandardMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 })); net.position.y = -0.63; W.rim.add(net);
    var arm = new T3.Mesh(new T3.BoxGeometry(0.25, 0.12, 0.6), new T3.MeshStandardMaterial({ color: 0x333333 })); arm.position.set(0, 0, -0.95); W.rim.add(arm);
    scene.add(W.rim);
  }
  function makeLabel(text, col) {
    var t = canvasTex(128, 128, function (g, w, h) { g.font = 'bold 96px Lexend, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(text, w / 2, h / 2); });
    var sp = new three.Sprite(new three.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.scale.set(1.2, 1.2, 1); return sp;
  }
  function texFor(img) {
    if (!img) return null;
    var t = img.tagName === 'CANVAS' ? new three.CanvasTexture(img) : new three.Texture(img); t.encoding = three.sRGBEncoding; t.anisotropy = 8; t.needsUpdate = true; return t;
  }
  function loadOverlays(ctx) {
    if (overlays) return;
    overlays = [];
    fetch('img/set/overlays.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (list) {
      overlays = list || [];
      overlays.forEach(function (o) { var im = new Image(); im.onload = function () { ovTex[o.key] = texFor(im); attachOverlays(ctx); ctx.redraw(); }; im.src = 'img/set/' + o.file; });
    });
  }
  function attachOverlays(ctx) {      // her practical overlays, exactly where her 887 × 1774 file puts them, standing out by their depth
    var s = ctx.P.stage;
    overlays.forEach(function (o) {
      var tw = W.towers[o.face[0]], f = tw && tw.faces[o.face]; if (!f || !ovTex[o.key] || f.extras.some(function (e) { return e.key === o.key; })) return;
      var w = o.w / 887 * s.face, h = o.h / 1774 * s.height, cx = (o.x + o.w / 2) / 887 * s.face - s.face / 2, cy = s.height / 2 - (o.y + o.h / 2) / 1774 * s.height;
      var m = new three.Mesh(new three.PlaneGeometry(w, h), new three.MeshStandardMaterial({ map: ovTex[o.key], transparent: true, alphaTest: 0.3, roughness: 0.6 }));
      m.position.set(cx, cy, o.depth); m.castShadow = true; f.group.add(m); f.extras.push({ key: o.key, mesh: m });
    });
  }
  function setFace(ctx, id, f) {      // her art on the face (re-read when a newer picture arrives)
    var img = ctx.artImg(id); if (faceSrc[id] === img) return;
    faceSrc[id] = img; var t = texFor(img); f.mat.map = t; f.mat.needsUpdate = true;
  }
  function update(ctx) {
    var P = ctx.P, s = P.stage, sh = ctx.sh, T3 = three;
    ctx.PK.TOWERS.forEach(function (t) {
      var q = sh.towers[t], gm = ctx.PK.geom(P, t, q, s), tw = W.towers[t], dark = sh.lit(t), shade = 1 - dark * 0.88;
      gm.faces.forEach(function (f) {
        var F = tw.faces[f.id]; setFace(ctx, f.id, F);
        F.group.position.set(f.c.x, s.height / 2, -f.c.y); F.group.rotation.set(0, Math.atan2(f.n.x, -f.n.y), 0);
        F.mat.color.setScalar(shade); F.extras.forEach(function (e) { e.mesh.material.color.setScalar(shade); e.mesh.visible = ctx.overlaysOn; });
      });
      tw.label.position.set(q.x, s.height + 1, -q.y); tw.label.visible = !!ctx.labels;
      if (t === 'D') {      // the rim follows D1
        var d1 = gm.prot.find(function (p) { return p.rim; });
        W.rim.visible = !!d1; if (d1) { var rc = { x: d1.mid.x + d1.n.x * (d1.d - 0.75), y: d1.mid.y + d1.n.y * (d1.d - 0.75) }; W.rim.position.set(rc.x, d1.z, -rc.y); W.rim.rotation.set(0, Math.atan2(d1.n.x, -d1.n.y), 0); }
      }
    });
    // the top cap: the exact footprint (a shape in stage x, y; turned flat it lands on three's x, −z)
    ctx.PK.TOWERS.forEach(function (t) {
      var q = sh.towers[t], gm = ctx.PK.geom(P, t, q, s), tw = W.towers[t], shp = new T3.Shape();
      gm.poly.forEach(function (p, i) { if (i) shp.lineTo(p.x, p.y); else shp.moveTo(p.x, p.y); });
      tw.cap.geometry.dispose(); tw.cap.geometry = new T3.ShapeGeometry(shp); tw.cap.position.set(0, s.height + 0.002, 0); tw.cap.rotation.set(-Math.PI / 2, 0, 0);
    });
    // tables (and their benches), other pieces
    var seen = {};
    ctx.PK.TABLES.forEach(function (id) {
      var x = sh.tables[id]; if (!x || x.y > s.curtain) { if (W.tables[id]) W.tables[id].visible = false; return; }
      var spec = P.tables[id], k = x.k, g = W.tables[id];
      if (!g) {      // the school's Sico stool table: gray top, chrome frame, navy stools (or folded on its wheels)
        g = W.tables[id] = new T3.Group(); var gray = new T3.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.55 }), chrome = new T3.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.25, metalness: 0.9 }), navy = new T3.MeshStandardMaterial({ color: 0x1d2a55, roughness: 0.6 });
        g.userData = { top: new T3.Mesh(new T3.BoxGeometry(1, 1, 1), gray), frame: new T3.Mesh(new T3.BoxGeometry(1, 1, 1), chrome), fold: new T3.Mesh(new T3.BoxGeometry(1, 1, 1), gray), stools: [], posts: [] };
        for (var i = 0; i < 12; i++) { var st0 = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.5, 0.12, 20), navy), post = new T3.Mesh(new T3.CylinderGeometry(0.04, 0.04, 1, 8), chrome); g.userData.stools.push(st0); g.userData.posts.push(post); g.add(st0); g.add(post); }
        ['top', 'frame', 'fold'].forEach(function (n) { g.add(g.userData[n]); });
        g.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); W.scene.add(g); }
      g.visible = true; seen[id] = 1;
      var u = g.userData, open = k > 0.5, L = spec.folded.l + (spec.open.l - spec.folded.l) * k;
      u.top.visible = u.frame.visible = open; u.fold.visible = !open;
      var n = spec.seats || 12, sh0 = spec.seatH || 1.42, per = Math.ceil(n / 2), sr = 0.5 * Math.min(1, k + 0.001);      // 12″ stools, 6 a side
      u.stools.forEach(function (sm, i) { var on = open && i < n, side = i < per ? -1 : 1, j = i % per, x0 = (j + 0.5) / per * L - L / 2, z0 = side * (spec.open.w / 2 + spec.bench / 2);
        sm.visible = u.posts[i].visible = on; if (!on) return; sm.scale.set(sr * 2, 1, sr * 2); sm.position.set(x0, sh0, z0); u.posts[i].scale.set(1, sh0, 1); u.posts[i].position.set(x0, sh0 / 2, z0); });
      if (open) { u.top.scale.set(L, 0.1, spec.open.w); u.top.position.set(0, spec.open.h, 0); u.frame.scale.set(L * 0.92, 0.12, spec.open.w + spec.bench * 2 - 0.4); u.frame.position.set(0, 0.6, 0); }
      else { u.fold.scale.set(spec.folded.l, spec.folded.h, spec.folded.w); u.fold.position.set(0, spec.folded.h / 2, 0); }
      g.position.set(x.x, 0, -x.y); g.rotation.set(0, (x.rot || 0) * Math.PI / 180, 0);
    });
    Object.keys(W.items).forEach(function (k2) { W.items[k2].visible = false; });
    (sh.items || []).forEach(function (it) {
      var m = W.items[it.id]; if (!m) { m = W.items[it.id] = new T3.Mesh(new T3.BoxGeometry(1, 1, 1), new T3.MeshStandardMaterial({ color: it.kind === 'plants' ? 0x3d7a3a : 0xa07a4a, roughness: 0.7 })); m.castShadow = true; W.scene.add(m); }
      var h = it.kind === 'plants' ? 2.5 : 1.5; m.visible = true; m.scale.set(it.w, h, it.d); m.position.set(it.x, h / 2, -it.y); m.rotation.set(0, (it.rot || 0) * Math.PI / 180, 0);
    });
    W.nye.material.emissive = new T3.Color(sh.zones.indexOf('nye') >= 0 ? 0x333344 : 0x000000); W.nye.visible = sh.zones.indexOf('nye') >= 0;
    W.hort.visible = sh.zones.indexOf('hort') >= 0;
  }
  function viewFor(host, crew) {
    var v = views.find(function (x) { return x.host === host; });
    if (v && v.canvas.isConnected) return v;
    views = views.filter(function (x) { return x.canvas.isConnected; });
    var cv = document.createElement('canvas'); cv.className = 'pk3d'; host.appendChild(cv);
    var r = new three.WebGLRenderer({ canvas: cv, antialias: true }); r.outputEncoding = three.sRGBEncoding; r.toneMapping = three.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = three.PCFSoftShadowMap; r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    v = { host: host, canvas: cv, renderer: r, camera: new three.PerspectiveCamera(30, 2, 0.5, 400), crew: crew, yaw: 0, pitch: 0, dist: 1 };
    var drag = null;      // drag to look around (from the same seat); double-click to look straight at the stage again
    cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, yaw: v.yaw, pitch: v.pitch }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', function (e) { if (!drag) return; v.yaw = Math.max(-0.6, Math.min(0.6, drag.yaw - (e.clientX - drag.x) * 0.004)); v.pitch = Math.max(-0.25, Math.min(0.35, drag.pitch + (e.clientY - drag.y) * 0.003)); if (v.redraw) v.redraw(); });
    cv.addEventListener('pointerup', function () { drag = null; });
    cv.addEventListener('wheel', function (e) { e.preventDefault(); v.dist = Math.max(0.35, Math.min(1.6, v.dist * Math.exp(e.deltaY * 0.001))); if (v.redraw) v.redraw(); }, { passive: false });
    cv.addEventListener('dblclick', function () { v.yaw = 0; v.pitch = 0; v.dist = 1; if (v.redraw) v.redraw(); });
    views.push(v); return v;
  }
  function draw(host, ctx) {
    if (!ready) { load().then(function () { ctx.redraw(); }).catch(function () { ctx.fallback(); }); return false; }
    if (!W.scene || W.key !== JSON.stringify(ctx.P.stage)) { build(ctx); faceSrc = {}; overlays = null; }
    loadOverlays(ctx); attachOverlays(ctx);
    var v = viewFor(host, ctx.crew), s = ctx.P.stage; v.redraw = ctx.redraw;
    var Wd = host.clientWidth; if (!Wd) return true; var H = Math.round(Wd * 0.5);
    if (v.canvas.width !== Math.round(Wd * v.renderer.getPixelRatio()) || v.h !== H) { v.renderer.setSize(Wd, H, false); v.canvas.style.width = '100%'; v.canvas.style.height = 'auto'; v.h = H; }
    update(ctx);
    W.drape.visible = W.border.visible = !ctx.crew;      // backstage looks out through where the drape would be
    var line = ctx.PK.towerLine(ctx.scene), target = new three.Vector3(0, 3.6, -line), cam = v.camera, half = ctx.halfW;
    // a seat in the middle of the house (raked: eyes about 9 ft up), or a crew member's eye line just behind the drape
    var eye = ctx.crew ? new three.Vector3(0, 6, s.curtain + s.crew) : new three.Vector3(0, 9, s.apron + s.house);
    var off = eye.clone().sub(target), d0 = off.length();
    off.applyAxisAngle(new three.Vector3(0, 1, 0), v.yaw); var side = new three.Vector3().crossVectors(off, new three.Vector3(0, 1, 0)).normalize(); off.applyAxisAngle(side, v.pitch);
    cam.position.copy(target.clone().add(off.multiplyScalar(v.dist)));
    cam.aspect = Wd / H; var hfov = 2 * Math.atan((half * 1.05) / (d0 * v.dist)); cam.fov = 2 * Math.atan(Math.tan(hfov / 2) / cam.aspect) * 180 / Math.PI; cam.updateProjectionMatrix(); cam.lookAt(target);
    v.renderer.render(W.scene, cam);
    return true;
  }
  window.PK3D = { draw: draw, load: load };
})();
