/* ASL Fingerspelling Practice: the 3D hand.
   FSHand.create(canvas, { onError }) returns { ready, spell(word, { speed: () => 0..1, onLetter: text => {}, stop: () => bool }), setTone(hex), TONES, dealTone(), chartImage(letter), letters }.
   Made from Colleen's approved hand (dev/hand-realistic-try2.html): every letter shape, the solid-finger move plans, habits, speeds and pauses are unchanged.
   Needs three.js r128 with GLTFLoader and RoomEnvironment loaded first. The hand model is the MIT-licensed WebXR generic hand. */
(function () {
function create(canvas, opts) {
opts = opts || {};
let readyOk, readyErr; const ready = new Promise((a, b) => { readyOk = a; readyErr = b; });
/* LIGHT: school Chromebooks and other low-power devices get a lighter hand (Colleen: 25 Chromebooks froze): a simpler model, no shadows,
   lighter skin detail, no planning in the middle of a word. Same shapes and movements. ?light=1 / ?light=0 in the address forces it either way. */
const LIGHT = /[?&]light=1\b/.test(location.search) || (!/[?&]light=0\b/.test(location.search) && (/\bCrOS\b/.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!opts.light));
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !LIGHT, alpha: true, preserveDrawingBuffer: true, powerPreference: LIGHT ? 'low-power' : 'default' });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;      /* film-like light, for a photo look */
renderer.shadowMap.enabled = !LIGHT; renderer.shadowMap.type = THREE.PCFSoftShadowMap;      /* soft shadows: a thumb crossing the fingers shades them, so the overlap reads clearly */
/* the drawing size follows the size the hand is shown at (not a fixed 800 x 800), and slow devices (school Chromebooks) step down (Colleen: 25 froze) */
let quality = 1, slowN = 0, slowT = 0;
const gl = renderer.getContext();
function fitRes() {
  const shown = canvas.clientWidth || 400, ratio = Math.min(window.devicePixelRatio || 1, quality < 1 ? 1 : 1.5);
  const px = Math.max(320, Math.min(800, Math.round(shown * ratio * quality)));
  if (canvas.width !== px) { renderer.setSize(px, px, false); dirty = true; }
}
function slowCheck(ms) {      /* the first 30 drawings: if they average over 25 ms, draw smaller and with softer shadows */
  if (quality < 1 || slowN >= 30) return; slowN++; slowT += ms;
  if (slowN === 30 && slowT / 30 > 25) { quality = 0.7; key.shadow.mapSize.set(1024, 1024); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } fitRes(); }
}
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new THREE.RoomEnvironment(), 0.04).texture;      /* soft room light all around, for natural reflections on the skin */
const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
const hemi = new THREE.HemisphereLight(0xffffff, 0x998877, 0.2); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff4ea, 2.3); key.position.set(-0.35, 0.8, 1); scene.add(key);
key.castShadow = true; key.shadow.mapSize.set(1536, 1536); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.0015; key.shadow.radius = 4;
Object.assign(key.shadow.camera, { left: -0.15, right: 0.15, top: 0.2, bottom: -0.1, near: 0.1, far: 3 }); key.shadow.camera.updateProjectionMatrix();
/* ---- the painted skin (GLSL). Units: vRest is millimetres in the resting hand ---- */
const SKIN = 0xc68c6c;
const SKU = { skDbg: { value: 0 }, skPalm: { value: new THREE.Vector3(1, 1, 1) }, skRed: { value: 0.5 }, skSSS: { value: new THREE.Vector3() }, skEdge: { value: new THREE.Vector3() }, skEdgeK: { value: 1 }, skRim: { value: new THREE.Vector3() }, skO: { value: new THREE.Vector3() }, skAx: { value: new THREE.Vector3(1, 0, 0) }, skW: { value: new THREE.Vector2(80, 90) } };      /* palm coordinates, filled in by skin() */
const SKIN_HEAD = `#define SK_OCT ${LIGHT ? 2 : 4}
varying vec3 vRest; varying vec4 vSk; varying vec4 vTone; uniform vec3 skO; uniform vec3 skAx; uniform vec2 skW; uniform vec3 skPalm; uniform float skRed; uniform vec3 skSSS; uniform vec3 skEdge; uniform float skEdgeK; uniform vec3 skRim; uniform float skDbg;
float skinH = 0.0; float skinRough = 0.0;
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int k = 0; k < SK_OCT; k++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float fadeFine(vec3 p) { return 1.0 - smoothstep(0.35, 0.9, length(fwidth(p))); }      /* detail finer than a pixel fades out instead of shimmering */
float lineD(float d, float w) { return exp(-d * d / (w * w)); }`;
const SKIN_COLOR = `{
  vec3 P = vRest; float u = vSk.x, jd = vSk.y, back = vSk.z, jw = vSk.w;
  float red = vTone.x, finger = vTone.y; vec2 pc = vec2(dot(P - skO, skAx) / skW.x, P.y / skW.y);
  float palmSide = smoothstep(0.15, -0.45, back), backSide = smoothstep(-0.1, 0.5, back);
  float mott = fbm(P * 0.11) - 0.5, fine = fbm(P * 0.8) - 0.5;
  vec3 c = diffuseColor.rgb * (1.0 + mott * 0.16 + fine * 0.06);      /* uneven tone, as real skin is */
  c = mix(c, c * skPalm, palmSide * 0.8);      /* palm lighter and pinker; more so on darker skin, as in life */
  c = mix(c, c * vec3(0.92, 0.86, 0.82), backSide * 0.6);      /* back of the hand a touch darker */
  c = mix(c, c * vec3(1.0, 0.76, 0.72), clamp(red, 0.0, 1.0) * skRed);      /* rosy fingertips, knuckles, palm pads */
  float n1 = fbm(P * 0.55);
  /* knuckle wrinkles: fine lines across the back of each finger joint */
  float km = lineD(jd, 3.4) * backSide * jw;
  float kw = jd + (n1 - 0.5) * 1.6 + 0.35 * sin(P.x * 0.9 + P.z * 0.7);
  float klines = pow(0.5 + 0.5 * cos(kw * 5.2), 3.0) * smoothstep(0.25, 0.6, vnoise(P * 0.45 + 3.0) + 0.3) * (1.0 - smoothstep(0.25, 0.6, fwidth(kw) * 0.83));
  c *= 1.0 - km * (0.07 + klines * 0.12);
  /* finger creases on the palm side: two lines at each joint */
  float cwob = (vnoise(P * 0.7 + 9.0) - 0.5) * 0.5;
  float cm = palmSide * jw * smoothstep(0.2, 0.9, finger) * (lineD(jd - 0.9 + cwob, 0.5) + lineD(jd + 0.9 + cwob, 0.5) * 0.7) * (0.7 + 0.6 * vnoise(P * 0.5 + 5.0));
  c *= 1.0 - clamp(cm, 0.0, 1.0) * 0.22;
  /* palm lines (heart, head, life), drawn in palm coordinates: pc.x pinky side 0 to index side 1, pc.y wrist 0 to knuckles 1 */
  float pm = palmSide * (1.0 - finger) * step(-0.5, pc.x) * step(pc.x, 1.5);
  float wob = (vnoise(P * 0.35) - 0.5) * 0.03;
  float heart = lineD(pc.y - (0.76 + 0.14 * pc.x * pc.x) + wob, 0.012) * smoothstep(-0.02, 0.05, pc.x) * (1.0 - smoothstep(0.68, 0.78, pc.x));
  float head = lineD(pc.y - (0.53 + 0.19 * pc.x) + wob, 0.012) * smoothstep(0.15, 0.3, pc.x) * (1.0 - smoothstep(1.0, 1.06, pc.x));
  vec2 lc = (pc - vec2(1.08, 0.24)) / vec2(0.44, 0.5);
  float life = lineD(length(lc) - 1.0 + wob * 2.0, 0.022) * (1.0 - smoothstep(0.95, 1.02, pc.x)) * smoothstep(0.08, 0.2, pc.y) * (1.0 - smoothstep(0.7, 0.76, pc.y));
  float pl = clamp(heart + head * 0.9 + life, 0.0, 1.0) * pm * (0.75 + 0.5 * n1);
  c *= 1.0 - pl * 0.24;
  diffuseColor.rgb = c;
  /* height for the bump: pores and fine skin texture, wrinkles and creases pressed in */
  float pores = (vnoise(P * 2.6) - 0.5) * fadeFine(P * 2.6) + (vnoise(P * 5.5) - 0.5) * 0.5 * fadeFine(P * 5.5);
  skinH = pores * 0.35 + fine * 0.5 - km * klines * 0.6 - cm * 0.9 - pl * 0.8;
  skinRough = fine * 0.12 + palmSide * 0.06 + km * 0.05 - red * 0.04;
}`;
const SKIN_BUMP = `{
  vec3 skPx = dFdx(-vViewPosition), skPy = dFdy(-vViewPosition);
  float skHx = dFdx(skinH), skHy = dFdy(skinH);
  vec3 skR1 = cross(skPy, normal), skR2 = cross(normal, skPx); float skDet = dot(skPx, skR1);
  vec3 skG = sign(skDet) * (skHx * skR1 + skHy * skR2);
  normal = normalize(abs(skDet) * normal - skG * BUMP);
}`.replace('BUMP', '0.00009');
/* light that soaks into skin and comes back out reddish, softening the edge of shadows the way real skin does */
const SKIN_SSS = `#if NUM_DIR_LIGHTS > 0
{ vec3 Ls = directionalLights[0].direction; float nl = dot(normal, Ls);
  float wrap = clamp((nl + 0.5) / 1.5, 0.0, 1.0) - clamp(nl, 0.0, 1.0);
  reflectedLight.directDiffuse += max(wrap, 0.0) * directionalLights[0].color * diffuseColor.rgb * skSSS; }
#endif
reflectedLight.indirectDiffuse *= vec3(1.0, 0.94, 0.91);`;
/* skin tones: the student picks one, or Random (a new tone for each word) */
const TONES = [0xc68c6c, 0xb27c5e, 0x9c6a4f, 0x87593f, 0x6c4632, 0x513224, 0x3d251a];      /* less orange in the middle tones */
let toneNow = null;
/* each tone has its own light, set by eye one tone at a time (Colleen: shadows and highlights must suit each skin tone, for clarity):
   exp = exposure, fill = soft fill light, key = main light, env = soft room highlights, coat = skin sheen,
   palm = how much lighter/pinker the palm is, red = rosy fingertips and knuckles, sss = color of light glowing at shadow edges,
   edge/edgeK = color and strength of the soft outline, rim = faint light edge that separates overlapping fingers on darker skin */
const TONE_SET = [
  { exp: 0.90, fill: 0.20, key: 2.30, env: 0.45, coat: 0.12, palm: [1.06, 0.96, 0.94], red: 0.55, sss: [0.50, 0.16, 0.09], edge: [0.66, 0.52, 0.48], edgeK: 1.00, rim: [0, 0, 0] },
  { exp: 0.90, fill: 0.21, key: 2.30, env: 0.46, coat: 0.12, palm: [1.08, 0.98, 0.95], red: 0.50, sss: [0.50, 0.17, 0.10], edge: [0.64, 0.50, 0.46], edgeK: 1.00, rim: [0, 0, 0] },
  { exp: 0.93, fill: 0.24, key: 2.27, env: 0.50, coat: 0.13, palm: [1.12, 1.03, 1.00], red: 0.48, sss: [0.49, 0.17, 0.10], edge: [0.65, 0.52, 0.48], edgeK: 0.96, rim: [0.010, 0.007, 0.005] },
  { exp: 0.97, fill: 0.30, key: 2.23, env: 0.55, coat: 0.14, palm: [1.20, 1.10, 1.06], red: 0.44, sss: [0.47, 0.18, 0.11], edge: [0.64, 0.53, 0.50], edgeK: 0.90, rim: [0.030, 0.022, 0.017] },
  { exp: 1.02, fill: 0.38, key: 2.19, env: 0.56, coat: 0.13, palm: [1.28, 1.17, 1.12], red: 0.38, sss: [0.45, 0.19, 0.12], edge: [0.63, 0.54, 0.51], edgeK: 0.86, rim: [0.050, 0.036, 0.028] },
  { exp: 1.07, fill: 0.46, key: 2.14, env: 0.56, coat: 0.11, palm: [1.36, 1.23, 1.16], red: 0.33, sss: [0.43, 0.20, 0.13], edge: [0.62, 0.55, 0.53], edgeK: 0.80, rim: [0.073, 0.053, 0.040] },
  { exp: 1.11, fill: 0.52, key: 2.10, env: 0.58, coat: 0.11, palm: [1.41, 1.27, 1.19], red: 0.30, sss: [0.42, 0.20, 0.13], edge: [0.62, 0.55, 0.53], edgeK: 0.76, rim: [0.087, 0.063, 0.048] }
];
function setTone(hex) {
  toneNow = hex; dirty = true; const T = TONE_SET[Math.max(0, TONES.indexOf(hex))];
  [H1, H2].forEach(h => { if (h && h.mesh) { h.mesh.material.color.set(hex).convertSRGBToLinear(); h.mesh.material.envMapIntensity = T.env; h.mesh.material.clearcoat = T.coat; } });      /* both hands the same tone */
  renderer.toneMappingExposure = T.exp; hemi.intensity = T.fill; key.intensity = T.key;
  SKU.skPalm.value.fromArray(T.palm); SKU.skRed.value = T.red; SKU.skSSS.value.fromArray(T.sss); SKU.skEdge.value.fromArray(T.edge); SKU.skEdgeK.value = T.edgeK; SKU.skRim.value.fromArray(T.rim);
}
/* Random: a different tone from the last one, chosen only BEFORE a word starts (never while the hand is spelling) */
/* Random deals from a shuffled deck of all 7 tones: every tone comes up exactly once in each 7 words (perfectly even), then the deck is reshuffled
   (never starting with the tone just shown) */
let toneDeck = [];
const dealTone = () => {
  if (!toneDeck.length) { toneDeck = TONES.slice(); for (let i = toneDeck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [toneDeck[i], toneDeck[j]] = [toneDeck[j], toneDeck[i]]; }
    if (toneDeck[toneDeck.length - 1] === toneNow) toneDeck.unshift(toneDeck.pop()); }
  return toneDeck.pop();
};
/* H is the hand being worked on: the signing (right) hand, or, briefly, the helper (left) hand for THOUSAND (withHand) */
let H = {}; const H1 = H; let H2 = null;
const withHand = (h, fn) => { const keep = H; H = h; try { return fn(); } finally { H = keep; } };
const HAND_URL = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0.19/dist/profiles/generic-hand/right.glb';
function dressHand(g) {
  const root = g.scene; scene.add(root); H.root = root; H.bones = {};
  root.traverse(o => { if (o.isBone) H.bones[o.name] = o; if (o.isMesh || o.isSkinnedMesh) { H.mesh = o;
      /* "a real hand printed on the glove": no nails, no new shapes; the skin is PAINTED in the shader from values worked out once at rest in skin(),
         so pores, knuckle wrinkles, palm lines and creases all bend with the fingers */
      o.material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(SKIN).convertSRGBToLinear(), roughness: 0.52, clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 0.45, skinning: true, side: THREE.DoubleSide });
      o.material.extensions = { derivatives: true };
      o.material.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, SKU);
        sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace('getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )', 'mix(getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ), 1.0, clamp(vTone.z, 0.0, 1.0) * 0.85)'));
        sh.vertexShader = sh.vertexShader.replace('void main() {', 'attribute vec3 rest; attribute vec4 sk; attribute vec4 tone; varying vec3 vRest; varying vec4 vSk; varying vec4 vTone;\nvoid main() {\n vRest = rest; vSk = sk; vTone = tone;');
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', SKIN_HEAD + '\nvoid main() {')
          .replace('#include <color_fragment>', '#include <color_fragment>\n' + SKIN_COLOR)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor + skinRough, 0.3, 0.8);')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + SKIN_BUMP)
          .replace('#include <lights_fragment_end>', SKIN_SSS + '\n#include <lights_fragment_end>')
          .replace('#include <dithering_fragment>', 'float ndv = abs(dot(normalize(normal), normalize(vViewPosition)));\n float rim = 1.0 - smoothstep(0.04, 0.6, ndv);\n gl_FragColor.rgb *= mix(vec3(1.0), skEdge, rim * skEdgeK);\n gl_FragColor.rgb += rim * rim * skRim;\n gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0, 1.0, 0.0), clamp(vTone.z, 0.0, 1.0) * skDbg);\n#include <dithering_fragment>');      /* soft warm outline, so a thumb crossing the fingers still stands out */
      }; o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; } });
  Object.values(H.bones).forEach(b => { b.userData.q0 = b.quaternion.clone(); });
  setup(root);
  return root;
}
new THREE.GLTFLoader().load(HAND_URL, g => {
  const root = dressHand(g);
  const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  H.center = c; H.size = s;
  fitRes(); window.addEventListener('resize', () => { fitRes(); });
  if (window.ResizeObserver) new ResizeObserver(() => fitRes()).observe(canvas);
  (function loop() { if (dirty) { dirty = false; const t0 = performance.now(); renderer.render(scene, cam); slowCheck(performance.now() - t0); } requestAnimationFrame(loop); })();      /* draw only when something changed (25 Chromebooks froze when every hand redrew 60 times a second, Colleen) */
  readyOk();
  if (helperOn && !helperWanted) { helperWanted = true; loadHelper(); }      /* the left hand loads the first time a page needs it (helper(true)) */
}, undefined, e => { readyErr(e); if (opts.onError) opts.onError(e); });
/* THE HELPER HAND (Colleen, 2026-10-13): the signer's left hand, for THOUSAND. The same hand model, dressed the same way, then mirrored, so it
   matches the right hand exactly. It waits in the bottom right corner of the screen in activities that may need THOUSAND (helper(true)),
   rises to take part, then goes back. Its poses are written as right-hand poses; the mirror turns them into the left hand. */
let helperOn = false, h2from = null, h2to = null, h2st = 0, h2dur = 1, h2cur = null, h2done = false;
const HELPER_REST = { f: Array(4).fill([8, 10, 5, 0]), t: [10, 0, 0, 5, 5], w: [160, 40, -90], p: [-0.155, -0.125, 0] };      /* pulled further off screen into the corner (Colleen) */      /* the resting shape, turned 90 degrees at the wrist so the hand stands vertical (perpendicular to the ground), fingertips between forward and to the left (toward the signing hand); low in the bottom right corner (Colleen) */
function loadHelper() {
  new THREE.GLTFLoader().load(HAND_URL, g => {
    const h = {}; withHand(h, () => dressHand(g));
    h.mirror = new THREE.Group(); h.mirror.scale.x = -1; scene.add(h.mirror); h.mirror.add(h.pivot);
    h.mirror.visible = helperOn; H2 = h;
    h2cur = h2from = h2to = norm(HELPER_REST); withHand(H2, () => apply(h2cur));
    if (toneNow !== null) setTone(toneNow);
  });
}
function helperMove(P, ms) { if (!H2) return; h2from = h2cur; h2to = norm(P); h2st = performance.now(); h2dur = ms || 1; h2done = false; }
function helperTick(now) {
  if (!H2 || !H2.mirror.visible) return;
  const raw = Math.min(1, (now - h2st) / h2dur); if (raw >= 1 && h2done) return; h2done = raw >= 1;      /* settled: nothing to redo */
  const k = ease(raw);
  const qf = new THREE.Quaternion().setFromEuler(new THREE.Euler(h2from.w[0] * D, h2from.w[1] * D, h2from.w[2] * D)), qt = new THREE.Quaternion().setFromEuler(new THREE.Euler(h2to.w[0] * D, h2to.w[1] * D, h2to.w[2] * D));
  h2cur = { f: lerp(h2from.f, h2to.f, k), t: lerp(h2from.t, h2to.t, k), w: lerp(h2from.w, h2to.w, k), p: lerp(h2from.p, h2to.p, k), q: qf.slerp(qt, k) };
  withHand(H2, () => apply(h2cur));
}
/* with the helper showing, the camera steps back a little and over, so both hands fit */
const camFor = on => { dirty = true; camTw = null; CAM_LAST = on ? CAM_FRONT : { pos: [0, 0.085, 0.5], at: [0, 0.085, 0] }; if (on) { cam.position.set(0.02, 0.075, 0.62); cam.lookAt(0.02, 0.075, 0); }      /* straight on, stepped back a little so both hands fit (a higher view was tried for MILLION and did not help) */ else { cam.position.set(0, 0.085, 0.5); cam.lookAt(0, 0.085, 0); } };
/* camera easing (camTo), kept for later; THOUSAND and MILLION no longer turn the camera (Colleen: not needed once the z bug was fixed) */
const CAM_FRONT = { pos: [0.02, 0.075, 0.62], at: [0.02, 0.075, 0] }, CAM_TOUCH = { pos: [-0.2, 0.2, 0.55], at: [0.03, 0.03, 0] };
let camTw = null;
function camTo(T, ms) { camTw = { p0: cam.position.toArray(), a0: CAM_LAST.at, T, st: performance.now(), ms }; }
let CAM_LAST = CAM_FRONT;
function camTick(now) { if (!camTw) return; dirty = true; const k = ease(Math.min(1, (now - camTw.st) / camTw.ms)); const P = lerp(camTw.p0, camTw.T.pos, k), A = lerp(camTw.a0, camTw.T.at, k); cam.position.set(P[0], P[1], P[2]); cam.lookAt(A[0], A[1], A[2]); if (k >= 1) { CAM_LAST = camTw.T; camTw = null; } }
let helperWanted = false;
const helper = on => { helperOn = !!on; dirty = true; h2done = false; if (helperOn && !H2 && !helperWanted && H1.bones) { helperWanted = true; loadHelper(); } camFor(helperOn); if (H2) { H2.mirror.visible = helperOn; if (helperOn) { h2cur = h2from = h2to = norm(HELPER_REST); withHand(H2, () => apply(h2cur)); } } };
/* turn the hand upright, palm to the camera, and work out each joint's bend and spread axes in its own frame */
const V = () => new THREE.Vector3(), wp = n => H.bones[n].getWorldPosition(V());
const FING = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
/* the model's fingers are thin: push the skin of the fingers and thumb out along its normals (about 2 mm), so the fingers sit closer together */
/* round off the model's corners (Colleen: "the points around the fingers are very angular"): Loop subdivision, done once on load.
   Each pass splits every triangle into four and smooths the corners; the skin weights are blended so the new points bend with the fingers */
function subdivide(passes) {
  for (let pass = 0; pass < passes; pass++) {
    const g = H.mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const idx = g.index ? Array.from(g.index.array) : [...Array(pos.count).keys()];
    /* weld points that share a position (the file splits them at texture seams) */
    const key = new Map(), weld = [], P = [], W = [];
    for (let v = 0; v < pos.count; v++) {
      const k = pos.getX(v).toFixed(6) + ',' + pos.getY(v).toFixed(6) + ',' + pos.getZ(v).toFixed(6);
      if (!key.has(k)) { key.set(k, P.length); P.push(new THREE.Vector3().fromBufferAttribute(pos, v)); const w = {}; [[si.getX(v), sw.getX(v)], [si.getY(v), sw.getY(v)], [si.getZ(v), sw.getZ(v)], [si.getW(v), sw.getW(v)]].forEach(([b, x]) => { if (x > 0) w[b] = (w[b] || 0) + x; }); W.push(w); }
      weld[v] = key.get(k);
    }
    const tris = []; for (let i = 0; i < idx.length; i += 3) { const a = weld[idx[i]], b = weld[idx[i + 1]], c = weld[idx[i + 2]]; if (a !== b && b !== c && a !== c) tris.push([a, b, c]); }
    const ek = (a, b) => a < b ? a + '_' + b : b + '_' + a, edges = new Map(), nbr = P.map(() => new Set());
    tris.forEach(([a, b, c]) => [[a, b, c], [b, c, a], [c, a, b]].forEach(([x, y, z]) => { const k = ek(x, y); if (!edges.has(k)) edges.set(k, { a: x, b: y, opp: [] }); edges.get(k).opp.push(z); nbr[x].add(y); nbr[y].add(x); }));
    const mixW = (list) => { const w = {}; list.forEach(([wt, s]) => { for (const b in wt) w[b] = (w[b] || 0) + wt[b] * s; }); return w; };
    /* new point on each edge */
    const NP = [], NW = [], edgeId = new Map();
    const bnd = P.map(() => []);
    edges.forEach((e, k) => {
      let p, w;
      if (e.opp.length === 2) { p = P[e.a].clone().add(P[e.b]).multiplyScalar(3 / 8).add(P[e.opp[0]].clone().add(P[e.opp[1]]).multiplyScalar(1 / 8)); }
      else { p = P[e.a].clone().add(P[e.b]).multiplyScalar(0.5); bnd[e.a].push(e.b); bnd[e.b].push(e.a); }
      w = mixW([[W[e.a], 0.5], [W[e.b], 0.5]]);
      edgeId.set(k, P.length + NP.length); NP.push(p); NW.push(w);
    });
    /* move the old points */
    const OP = P.map((p, v) => {
      if (bnd[v].length >= 2) return p.clone().multiplyScalar(3 / 4).add(P[bnd[v][0]].clone().add(P[bnd[v][1]]).multiplyScalar(1 / 8));
      const n = nbr[v].size; if (n < 3) return p.clone();
      const beta = n === 3 ? 3 / 16 : 3 / (8 * n), s = new THREE.Vector3(); nbr[v].forEach(u => s.add(P[u]));
      return p.clone().multiplyScalar(1 - n * beta).add(s.multiplyScalar(beta));
    });
    const allP = OP.concat(NP), allW = W.concat(NW), out = [];
    tris.forEach(([a, b, c]) => { const ab = edgeId.get(ek(a, b)), bc = edgeId.get(ek(b, c)), ca = edgeId.get(ek(c, a)); out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); });
    const n = allP.length, pa = new Float32Array(n * 3), ia = new Uint16Array(n * 4), wa = new Float32Array(n * 4);
    allP.forEach((p, v) => {
      pa[v * 3] = p.x; pa[v * 3 + 1] = p.y; pa[v * 3 + 2] = p.z;
      const top = Object.entries(allW[v]).sort((x, y) => y[1] - x[1]).slice(0, 4), tot = top.reduce((s, x) => s + x[1], 0) || 1;
      top.forEach(([b, x], k) => { ia[v * 4 + k] = +b; wa[v * 4 + k] = x / tot; });
    });
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(pa, 3)); ng.setAttribute('skinIndex', new THREE.BufferAttribute(ia, 4)); ng.setAttribute('skinWeight', new THREE.BufferAttribute(wa, 4));
    ng.setIndex(out); ng.computeVertexNormals(); ng.computeBoundingSphere();
    H.mesh.geometry.dispose(); H.mesh.geometry = ng;
  }
}
function widen() {
  const g = H.mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = H.mesh.skeleton.bones;
  const amount = {}; bones.forEach((b, i) => { if (/-(phalanx-proximal|phalanx-intermediate|phalanx-distal|tip)$/.test(b.name)) amount[i] = /^thumb/.test(b.name) ? 0.0024 : 0.0031;      /* a little more than before: rounding the corners slims the fingers */ });
  for (let v = 0; v < pos.count; v++) {
    const ix = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)], wt = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)];
    let d = 0; for (let k = 0; k < 4; k++) d += (amount[ix[k]] || 0) * wt[k];
    if (d) pos.setXYZ(v, pos.getX(v) + nor.getX(v) * d, pos.getY(v) + nor.getY(v) * d, pos.getZ(v) + nor.getZ(v) * d);
  }
  pos.needsUpdate = true; g.computeBoundingSphere();
}
function setup(root) {
  subdivide(LIGHT ? 1 : 2);
  widen();
  root.updateMatrixWorld(true);
  /* this model's joints all hang off the armature: chain them (wrist > metacarpal > proximal > intermediate > distal > tip) so a bend carries the rest of the finger. attach() keeps every joint where it is */
  const chain = names => names.reduce((par, n) => { if (H.bones[n]) { H.bones[par].attach(H.bones[n]); return n; } return par; }, 'wrist');
  FING.forEach(f => chain([f + '-metacarpal', f + '-phalanx-proximal', f + '-phalanx-intermediate', f + '-phalanx-distal', f + '-tip']));
  chain(['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']);
  root.updateMatrixWorld(true);
  Object.values(H.bones).forEach(b => { b.userData.q0 = b.quaternion.clone(); });
  const w = wp('wrist'), mid = wp('middle-finger-phalanx-proximal'), idx = wp('index-finger-phalanx-proximal'), pk = wp('pinky-finger-phalanx-proximal');
  const up = mid.clone().sub(w).normalize(), across = idx.clone().sub(pk).normalize();
  let normal = new THREE.Vector3().crossVectors(across, up).normalize();      /* which side is the palm: checked against the thumb tip, which sits toward the palm */
  const tt = wp('thumb-tip').sub(w); if (tt.dot(normal) < 0) normal.negate();
  /* rotate the whole hand: up -> +y, palm normal -> +z (toward the camera) */
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, normal).normalize(), up, normal);
  const q = new THREE.Quaternion().setFromRotationMatrix(m).invert();
  H.turn = new THREE.Group(); scene.add(H.turn); H.turn.add(root); H.turn.quaternion.copy(q);
  H.pivot = new THREE.Group(); scene.add(H.pivot); H.pivot.add(H.turn);
  H.pivot.position.set(0, 0.07, 0); H.turn.position.copy(w.clone().applyQuaternion(q).negate()); H.turn.position.y -= 0.07;      /* turns of the whole hand pivot on the middle of the palm, so it stays in view */
  scene.updateMatrixWorld(true);
  H.palm = new THREE.Vector3(0, 0, 1);
  /* each finger bone: bend axis = across the finger so the tip goes toward the palm; spread axis = the palm normal */
  const axes = (name, dirFrom, dirTo) => {
    const b = H.bones[name], qw = b.getWorldQuaternion(new THREE.Quaternion()), inv = qw.clone().invert();
    const dir = wp(dirTo).sub(wp(dirFrom)).normalize();
    const bend = new THREE.Vector3().crossVectors(dir, H.palm).normalize().applyQuaternion(inv);
    const spread = H.palm.clone().applyQuaternion(inv);
    const twist = dir.clone().applyQuaternion(inv);
    b.userData.bend = bend; b.userData.spread = spread; b.userData.twist = twist;
  };
  FING.forEach(f => { axes(f + '-phalanx-proximal', f + '-phalanx-proximal', f + '-phalanx-intermediate'); axes(f + '-phalanx-intermediate', f + '-phalanx-intermediate', f + '-phalanx-distal'); axes(f + '-phalanx-distal', f + '-phalanx-distal', f + '-tip'); });
  axes('thumb-metacarpal', 'thumb-metacarpal', 'thumb-phalanx-proximal'); axes('thumb-phalanx-proximal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal'); axes('thumb-phalanx-distal', 'thumb-phalanx-distal', 'thumb-tip');
  skin(); setTone(TONES[3]);      /* opens on the middle tone (Colleen) */
  const box = new THREE.Box3().setFromObject(H.pivot), c = box.getCenter(V());
  camFor(helperOn);      /* the view for one hand, or for two hands if the helper is already asked for */
}
/* values for the painted skin, worked out once at rest (so they bend with the hand): position in mm, distance along each finger to the nearest joint,
   which side is the back, how wrinkled that joint is, redness, and palm coordinates for the palm lines */
function skin() {
  const mesh = H.mesh, g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = mesh.skeleton.bones, n = pos.count;
  const rest = new Float32Array(n * 3), sk = new Float32Array(n * 4), tone = new Float32Array(n * 4);
  scene.updateMatrixWorld(true);
  const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld), palm = new THREE.Vector3(0, 0, 1);
  const domBone = v => { let best = -1, bw = 0; for (let k = 0; k < 4; k++) { const w = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)][k], i = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)][k]; if (w > bw) { bw = w; best = i; } } return bones[best] ? bones[best].name : ''; };
  /* each finger as a line of joints; u = 0 at the big knuckle */
  const lines = {};
  FING.concat(['thumb']).forEach(f => {
    const names = f === 'thumb' ? ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'] : [f + '-metacarpal', f + '-phalanx-proximal', f + '-phalanx-intermediate', f + '-phalanx-distal', f + '-tip'];
    const pts = names.map(wp); let acc = 0; const us = [0]; for (let k = 1; k < pts.length; k++) { acc += pts[k].distanceTo(pts[k - 1]); us.push(acc); }
    const u0 = us[1]; lines[f] = { pts, us: us.map(x => (x - u0) * 1000), joints: f === 'thumb' ? [[us[1], 0.8], [us[2], 1]] : [[us[1], 0.55], [us[2], 1], [us[3], 0.7]] };
    lines[f].joints = lines[f].joints.map(([x, w]) => [(x - u0) * 1000, w]);
  });
  /* palm coordinates: pinky knuckle side 0 to index side 1, wrist 0 to knuckle line 1 */
  const W = wp('wrist'), iK = wp('index-finger-phalanx-proximal'), pK = wp('pinky-finger-phalanx-proximal');
  const ax = iK.clone().sub(pK), axL = ax.length(); ax.normalize(); const ay = new THREE.Vector3(0, 1, 0), kY = (iK.y + pK.y) / 2 - W.y;
  /* where the base of the thumb presses into the palm the two skins cross; a sharp shadow there showed jagged patches, so the shadow is softened in that small area */
  const tA = wp('thumb-metacarpal'), tB = wp('thumb-phalanx-proximal'), tD = tB.clone().sub(tA), tL = tD.length(); tD.normalize();
  const thenar = p => { const t = Math.max(0, Math.min(1, p.clone().sub(tA).dot(tD) / tL)), d = p.distanceTo(tA.clone().add(tD.clone().multiplyScalar(t * tL))) * 1000; return 1 - Math.max(0, Math.min(1, (d - 24) / 10)); };
  const thumbBack = wp('thumb-phalanx-proximal').sub(wp('index-finger-phalanx-proximal')).normalize().add(palm.clone().multiplyScalar(-0.35));
  for (let v = 0; v < n; v++) {
    const p = new THREE.Vector3().fromBufferAttribute(pos, v); mesh.boneTransform(v, p); p.applyMatrix4(mesh.matrixWorld);
    const nw = new THREE.Vector3().fromBufferAttribute(nor, v).applyMatrix3(nm).normalize();
    rest[v * 3] = (p.x - W.x) * 1000; rest[v * 3 + 1] = (p.y - W.y) * 1000; rest[v * 3 + 2] = (p.z - W.z) * 1000;
    const name = domBone(v); let f = FING.concat(['thumb']).find(x => name.indexOf(x) === 0);
    if (!f) { let bd = 1e9; FING.forEach(x => { const d = p.distanceTo(lines[x].pts[1]); if (d < bd) { bd = d; f = x; } }); }      /* palm: measure from the nearest finger, so creases at the base of the fingers stay smooth */
    let u = -99, jd = 99, jw = 0, back = -nw.z, red = 0, finger = 0;
    if (f) {
      const L = lines[f]; let best = 1e9;
      for (let k = 1; k < L.pts.length; k++) {
        const A = L.pts[k - 1], B = L.pts[k], d = B.clone().sub(A), len = d.length(); d.normalize();
        const t = Math.max(0, Math.min(1, p.clone().sub(A).dot(d) / len)), q = A.clone().add(d.clone().multiplyScalar(t * len)), dist = q.distanceTo(p);
        if (dist < best) { best = dist; u = L.us[k - 1] + t * (L.us[k] - L.us[k - 1]);
          const radial = p.clone().sub(q).normalize(), bk = (f === 'thumb' ? thumbBack.clone() : palm.clone().negate()); bk.sub(d.clone().multiplyScalar(bk.dot(d))).normalize();
          if (u > -4 && name.indexOf(f) === 0) back = radial.dot(bk); }
      }
      L.joints.forEach(([x, w]) => { if (Math.abs(u - x) < Math.abs(jd)) { jd = u - x; jw = w; } });
      if (u < -6) jw *= Math.max(0, 1 + (u + 6) / 6);
      finger = u > -3 && name.indexOf(f) === 0 ? 1 : 0;
      const tipU = L.us[L.us.length - 1];
      if (u > tipU - 14) red = Math.max(red, (u - (tipU - 14)) / 14 * (back < 0 ? 0.9 : 0.35));      /* fingertips */
      if (back > 0.2) L.joints.forEach(([x]) => { red = Math.max(red, Math.max(0, 1 - Math.abs(u - x) / 5) * 0.55); });      /* knuckles */
    }
    if (!finger && back < 0) { const yy = (p.y - W.y) / kY; red = Math.max(red, yy < 0.3 ? 0.22 : yy > 0.85 ? 0.18 : 0); }      /* palm heel and the pads under the fingers */
    sk[v * 4] = u; sk[v * 4 + 1] = jd; sk[v * 4 + 2] = back; sk[v * 4 + 3] = jw;
    tone[v * 4] = red; tone[v * 4 + 1] = finger; tone[v * 4 + 2] = thenar(p); tone[v * 4 + 3] = 0;
  }
  SKU.skO.value.copy(pK).sub(W).multiplyScalar(1000); SKU.skAx.value.copy(ax); SKU.skW.value.set(axL * 1000, kY * 1000);
  g.setAttribute('rest', new THREE.BufferAttribute(rest, 3)); g.setAttribute('sk', new THREE.BufferAttribute(sk, 4)); g.setAttribute('tone', new THREE.BufferAttribute(tone, 4));
}
const D = Math.PI / 180, qa = (ax, deg) => new THREE.Quaternion().setFromAxisAngle(ax, deg * D);
/* pose: f = index..pinky [knuckle, middle, tip, spread]; t = thumb [swing across palm, out from palm, twist, bend1, bend2]; w = [x, y, z] turn of the whole hand */
/* the model's resting hand fans its fingers out; this closes them so 0 spread means fingers side by side (as in B and C) */
const TOG = [-9, -2, 6, 13];
let dirty = true;      /* the picture needs drawing again */
function apply(p) {
  dirty = true;
  FING.forEach((f, i) => {
    const a = p.f[i], b1 = H.bones[f + '-phalanx-proximal'], b2 = H.bones[f + '-phalanx-intermediate'], b3 = H.bones[f + '-phalanx-distal'];
    b1.quaternion.copy(b1.userData.q0).multiply(qa(b1.userData.spread, -((a[3] || 0) + TOG[i]))).multiply(qa(b1.userData.bend, a[0])).multiply(qa(b1.userData.twist, a[5] || 0));      /* optional 6th value: the finger twists on its own length (the 0 in 30-90: Colleen) */
    b2.quaternion.copy(b2.userData.q0).multiply(qa(b2.userData.spread, -(a[4] || 0))).multiply(qa(b2.userData.bend, a[1]));      /* optional 5th value: the finger's end tilts sideways toward the thumb (6: Colleen) */
    b3.quaternion.copy(b3.userData.q0).multiply(qa(b3.userData.bend, a[2]));
  });
  const t = p.t, m = H.bones['thumb-metacarpal'], t1 = H.bones['thumb-phalanx-proximal'], t2 = H.bones['thumb-phalanx-distal'];
  m.quaternion.copy(m.userData.q0).multiply(qa(m.userData.spread, t[0])).multiply(qa(m.userData.bend, t[1])).multiply(qa(m.userData.twist, t[2]));
  t1.quaternion.copy(t1.userData.q0).multiply(qa(t1.userData.twist, t[5] || 0)).multiply(qa(t1.userData.bend, Math.max(0, t[3])));      /* optional 6th thumb value: the thumb turns on its length from the middle knuckle, so the heel of the hand stays still (21: Colleen) */      /* the thumb's joints never bend backward (Colleen: they looked bent back) */
  t2.quaternion.copy(t2.userData.q0).multiply(qa(t2.userData.bend, Math.max(0, t[4])));
  const pp = p.p || [0, 0]; H.pivot.position.set(pp[0] || 0, 0.07 + (pp[1] || 0), pp[2] || 0);      /* p = [x, y, z]: z moves the hand toward (+) or away from (-) the student (HUNDRED pulls away) */
  if (p.q) { H.pivot.quaternion.copy(p.q); return; }
  H.pivot.rotation.set((p.w || [0, 0, 0])[0] * D, (p.w || [0, 0, 0])[1] * D, (p.w || [0, 0, 0])[2] * D);
}
const FIST = [85, 100, 55, 0], UP = [0, 0, 0, 0];
const POSE = {  /* thumb angles found by solving for where the thumb tip sits in Colleen's photos (A-F, L, O, P, Q, S, V from photos; M N T Z also from photos; G H J K R U W X Y from the chart); the others are guesses */
  rest: { f: Array(4).fill([8, 10, 5, 0]), t: [10, 0, 0, 5, 5], w: [0, 0, 0] },
  A: {f: [[85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [16, -27, 47, -10, -10], w: [0, 0, 0]},
  B: {f: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], t: [50, -45, -60, 50, 20], w: [0, 0, 0]},      /* thumb flat across the palm, not curled (Colleen, realistic try 2) */
  C: {f: [[40, 45, 30, 0], [41, 45, 30, 0], [42, 45, 30, 0], [43, 45, 30, 0]], t: [15, 22, -60, 20, 30], w: [0, 70, -20]},      /* 2026-10-14 (Colleen, from her photo and drawing): the thumb points forward under the fingers with a clear space, so it is not an O; the wrist tilts back toward the speller */
  D: {f: [[0, 0, 0, 0], [60, 90, 50, 0], [60, 90, 50, 0], [60, 90, 50, 0]], t: [11, -10, -38, 82, 73], w: [0, 0, 0]},
  E: {f: [[60, 110, 80, 0], [60, 110, 80, 0], [60, 110, 80, 0], [60, 110, 80, 0]], t: [44, -37, -60, 90, 45], w: [0, 0, 0]},      /* thumb straight across, tucked under all four fingertips (Colleen, between her two favourites) */
  F: {f: [[50, 50, 30, 0], [0, 0, 0, -3], [0, 0, 0, -8], [0, 0, 0, -14]], t: [35, 9, -48, 10, 2], w: [0, 30, 0]},
  G: {f: [[0, 0, 0, 0], [85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [26, -20, 41, -10, 15], w: [-160, 0, -90]},
  H: {f: [[0, 0, 0, 0], [0, 0, 0, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [60, -17, -39, 31, 40], w: [-160, 0, -90]},
  I: {f: [[85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0], [0, 0, 0, 0]], t: [1, 8, -60, 90, 40], w: [0, 0, 0]},
  K: {f: [[0, 0, 0, 6], [45, 0, 0, -6], [85, 100, 55, 0], [85, 100, 55, 0]], t: [56, -13, 5, -5, 8], w: [0, 0, 0]},
  L: {f: [[0, 0, 0, 0], [85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [-33, -25, 56, -10, -10], w: [0, 0, 0]},
  M: {f: [[85, 95, 15, 0], [85, 95, 15, 0], [85, 95, 15, 0], [85, 100, 55, 0]], t: [84, -36, -36, 46, 90], w: [0, 0, 0]},
  N: {f: [[85, 95, 15, 0], [85, 95, 15, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [68, -40, -4, 67, 63], w: [0, 0, 0]},
  O: {f: [[45, 60, 40, 0], [45, 60, 40, 0], [45, 60, 40, 0], [45, 60, 40, 0]], t: [32, -2, -47, 20, 12], w: [0, 70, 0]},
  P: {f: [[0, 0, 0, 6], [45, 0, 0, -6], [85, 100, 55, 0], [85, 100, 55, 0]], t: [56, -13, 5, -5, 8], w: [104, -14, -43]},
  Q: {f: [[0, 0, 0, 0], [85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [26, -20, 41, -10, 15], w: [166, 8, -32]},
  R: {f: [[28, 0, 0, -16], [-16, 0, 0, 6], [85, 100, 55, 0], [85, 100, 55, 0]], t: [60, -17, -39, 31, 40], w: [0, 0, 0]},      /* 2026-10-15 (Colleen, choice B): the index crosses IN FRONT of the middle finger (the right way), the pair upright, and the two fingers rest on each other instead of melting together */
  S: {f: [[85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [4, 8, -60, 84, 77], w: [0, 0, 0]},
  T: {f: [[60, 85, 20, 0], [85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [38, -35, -11, 78, 9], w: [0, 0, 0]},
  U: {f: [[0, 0, 0, 0], [0, 0, 0, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [60, -17, -39, 31, 40], w: [0, 0, 0]},
  V: {f: [[0, 0, 0, 18], [0, 0, 0, -10], [80, 95, 50, 0], [85, 100, 55, 0]], t: [67, -15, -59, 33, 16], w: [0, 0, 0]},
  W: {f: [[0, 0, 0, 18], [0, 0, 0, 0], [0, 0, 0, -18], [85, 100, 55, 0]], t: [73, -25, -60, 42, 65], w: [0, 0, 0]},
  X: {f: [[0, 95, 65, 0], [85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [16, -13, -52, 62, 65], w: [0, 90, 0]},      /* side view, as Colleen's X drawing: palm to the left, index up and hooked over */
  Y: {f: [[85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0], [10, 32, 8, -40]], t: [1, -28, 47, -1, -3], w: [0, 0, 0]}
};
/* J and Z move: a list of steps the hand passes through. p = [x, y] shifts the whole hand (meters, as the student sees it) */
POSE.J = [{ w: [0, 0, 30], p: [0, 0] }, { w: [0, 30, 20], p: [-0.008, -0.02] }, { w: [0, 75, 5], p: [0, -0.035] }, { w: [0, 115, -10], p: [0.02, -0.02] }].map(k => Object.assign({}, POSE.I, k));
POSE.J.smooth = true;      /* J is one smooth curve (Colleen: smooth, and turning more): tilted, down, then curving up to the right */
const Z1 = { f: [[0, 0, 0, 0], [85, 100, 55, 0], [85, 100, 55, 0], [85, 100, 55, 0]], t: [36, -10, -53, 28, 54], w: [60, 0, 0] };      /* index pointing toward the student (Colleen, 2026-10-12) */
const ZPATH = [[0.03, 0.03], [-0.03, 0.03], [0.03, -0.03], [-0.03, -0.03]];      /* Colleen: the same Z shape, starting at the top right */
POSE.Z = ZPATH.map(p => Object.assign({}, Z1, { p }));
/* double Z, the other way: a bent V (index and middle spread and bent) draws the Z once */
const ZZ1 = { f: [[10, 70, 40, 18], [10, 70, 40, -10], [85, 100, 55, 0], [85, 100, 55, 0]], t: [67, -15, -59, 33, 16], w: [60, 0, 0] };
const ZZ = ZPATH.map(p => Object.assign({}, ZZ1, { p }));
/* double letters that sometimes slide from the right of the screen to the left instead of loosening (Colleen) */
/* thumb UNDER the fingers (M N T E D): going in, the thumb tucks in first and the fingers drape over it; coming out, the fingers lift first.
   thumb OVER the fingers (S I A): going in, the fingers curl first and the thumb crosses over them; coming out, the thumb leaves first. */
/* Colleen's rule: every shape is ONE movement (all fingers and the thumb together), ending in the right overlap. Only a tiny lead, so nothing passes through */
'MNTED'.split('').forEach(c => { POSE[c].under = true; POSE[c].stage = 0.1; });
'SI'.split('').forEach(c => { POSE[c].over = true; POSE[c].stage = 0.1; });
POSE.G.via = POSE.H.via = [104, 44, -100];
/* 's (as in MOM'S): S, then a twist counterclockwise and inward (toward the signer) until it faces almost backward, in one smooth motion */
POSE['\u00A7'] = [0, 75, 150].map(y => Object.assign({}, POSE.S, { w: [0, y, 0] })); POSE['\u00A7'].smooth = true; POSE['\u00A7'].quick = true;      /* the twist is quick (Colleen) */ POSE['\u00A7'].label = "'S";
const SLIDE = new Set('LBCDEGHIOPRUVW'.split(''));      /* as Colleen's Z photo shows it: the student sees it start on their left */
/* double letters: by default the fingers and thumb relax part of the way toward an open hand (Colleen: for B the thumb partly opens and closes again) */
const loosen = (P, k) => { const R = norm(POSE.rest), Q = norm(P); return { f: lerp(Q.f, R.f, k), t: lerp(Q.t, R.t, k), w: Q.w, p: Q.p }; };
const DOUBLE = {};      /* letter: P => the in-between shape, for letters that should double differently */
const norm = p => ({ f: p.f, t: p.t, w: p.w || [0, 0, 0], p: [0, 1, 2].map(i => (p.p && p.p[i]) || 0), under: !!p.under, over: !!p.over, stage: p.stage || 0 });      /* p always has x, y and z: a missing z made the smooth paths lose all forward/back movement (MILLION, Colleen) */
const lerp = (a, b, k) => Array.isArray(a) ? (b && b.length > a.length ? b : a).map((_, i) => lerp(a[i] === undefined ? 0 : a[i], b[i] === undefined ? 0 : b[i], k)) : a + (b - a) * k;      /* a missing 5th finger value counts as 0 */
const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
let cur = norm(POSE.rest), from = cur, to = cur, st = 0, dur = 1;
/* SOLID FINGERS (Colleen): the fingers and thumb are solid and must work around each other. While the hand moves, if the thumb would pass
   through a finger it swings out of the way (DODGE) just enough, then settles into the shape. Touching that a shape needs at its start or end is allowed. */
const FJ = ['index', 'middle', 'ring', 'pinky'].flatMap(f => ['-finger-phalanx-proximal', '-finger-phalanx-intermediate', '-finger-phalanx-distal', '-finger-tip'].map(j => f + j));
const TJ = ['thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'], SOLID = 0.018, DODGE = [-35, -10, 0, -20, -20];
let ALLOW = null, dodgeS = 0;
function gaps() {
  H.pivot.updateMatrixWorld(true);
  const f = FJ.map(n => H.bones[n].getWorldPosition(new THREE.Vector3())), fp = [];
  for (let i = 0; i < 16; i += 4) for (let k = 0; k < 4; k++) { fp.push(f[i + k]); if (k < 3) fp.push(f[i + k].clone().lerp(f[i + k + 1], 0.5)); }
  const t = TJ.map(n => H.bones[n].getWorldPosition(new THREE.Vector3())), tp = [t[0], t[0].clone().lerp(t[1], 0.5), t[1], t[1].clone().lerp(t[2], 0.5), t[2]];
  const d = []; tp.forEach(a => fp.forEach(b => d.push(a.distanceTo(b)))); return d;
}
function allowFor(a, b) { apply(Object.assign({}, a, { q: null })); const da = gaps(); apply(Object.assign({}, b, { q: null })); const db = gaps(); return da.map((x, i) => Math.min(SOLID, x, db[i]) - 0.0005); }
/* each move is planned once before it plays: at 12 points along the way, the smallest nudge (the thumb's 5 angles, plus the fingers opening a
   little) that keeps everything apart, each point starting from the one before so the path is one smooth movement. Plans are remembered. */
const OPEN = [0.4, 0.45, 0.3, 0], PLANS = new Map();
const lerpA = (a, b, k) => a.map((x, i) => Array.isArray(x) ? lerpA(x, b[i], k) : x + (b[i] - x) * k);
const nudge = (pose, D6) => Object.assign({}, pose, { t: pose.t.map((x, i) => x + D6[i]), f: pose.f.map(fg => fg.map((a, j) => j < 3 ? Math.max(0, a - D6[5] * OPEN[j]) : a)) });
const planKey = (A, B) => JSON.stringify([A.f, A.t, B.f, B.t].map(a => JSON.stringify(a, (k, v) => typeof v === 'number' ? Math.round(v) : v)));
/* the dodge for one move is ONE smooth swell: nudge(k) = c * bump(k; m, w), c = 6 values (the thumb's 5 angles and the fingers opening), m = when it
   peaks, w = how wide. A light touch (up to 6 mm) is allowed near the start and end, so the thumb settles into shapes that touch. */
const ends = k => { const e = x => x * x * (3 - 2 * x); return e(Math.min(1, k / 0.15)) * e(Math.min(1, (1 - k) / 0.15)); };
const bump = (k, m, w) => Math.exp(-(((k - m) / w) ** 2)) * ends(k);
const tolAt = k => 0.001 + 0.006 * (1 - Math.min(1, Math.min(k, 1 - k) / 0.2));
const SAMP = []; for (let i = 1; i < 20; i++) SAMP.push(i / 20); SAMP.push(0.825, 0.875, 0.925, 0.975); SAMP.sort((a, b) => a - b);
function planMove(A, B) {
  const key = planKey(A, B); if (PLANS.has(key)) return PLANS.get(key);
  const AL = allowFor(A, B), pen = () => { const d = gaps(); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, AL[i] - d[i]); return m; };
  const at = k => ({ f: lerpA(A.f, B.f, k), t: lerpA(A.t, B.t, k), w: [0, 0, 0], p: [0, 0] });
  const excess = (c, m, w) => { let e = 0; for (const k of SAMP) { const b = bump(k, m, w); apply(nudge(at(k), c.map(v => v * b))); e = Math.max(e, pen() - tolAt(k)); } return Math.max(0, e); };
  let plan = null;
  if (excess([0, 0, 0, 0, 0, 0], 0.5, 0.3) > 0) {
    const cost = x => excess(x.slice(0, 6), x[6], x[7]) * 5000 + x.slice(0, 6).reduce((a, v) => a + v * v, 0) * 0.001;
    const lo = [-90, -90, -90, -90, -90, 0, 0.15, 0.12], hi = [90, 90, 90, 90, 90, 90, 0.85, 0.6], stp = [16, 16, 16, 16, 16, 16, 0.1, 0.08];
    let bestX = null, bestC = Infinity;
    for (const seed of [[0, 0, 0, 0, 0, 60, 0.7, 0.25], [-30, 0, 0, 0, 0, 60, 0.7, 0.3], [0, 40, 0, 0, 0, 40, 0.4, 0.3], [-40, 0, 0, 0, 0, 0, 0.5, 0.3], [0, 0, 0, 0, 0, 40, 0.5, 0.3], [0, -40, 0, 0, 0, 0, 0.5, 0.3], [-30, -30, 0, 0, 0, 30, 0.4, 0.35], [0, 0, 0, -40, -40, 0, 0.5, 0.3], [30, 30, 0, 0, 0, 30, 0.6, 0.35]]) {
      let x = seed.slice(), best = cost(x);
      for (const sc of [1, 0.5, 0.25]) { let imp = true; while (imp) { imp = false; for (let i = 0; i < 8; i++) for (const sg of [-1, 1]) { const y = x.slice(); y[i] = Math.max(lo[i], Math.min(hi[i], y[i] + sg * stp[i] * sc)); const c = cost(y); if (c < best - 1e-6) { best = c; x = y; imp = true; } } } }
      if (best < bestC) { bestC = best; bestX = x; }
      if (excess(bestX.slice(0, 6), bestX[6], bestX[7]) < 0.0003) break;      /* clear: good enough */
    }
    plan = bestX.map(v => Math.round(v * 100) / 100);
  }
  PLANS.set(key, plan); return plan;
}
const planAt = (plan, k) => plan ? plan.slice(0, 6).map(v => v * bump(k, plan[6], plan[7])) : [0, 0, 0, 0, 0, 0];
let PLAN = null;
function moveTo(p, ms) { settled = false; PATH = null; from = cur; to = norm(p); PLAN = LIGHT && !PLANS.has(planKey(from, to)) ? null : planMove(from, to);      /* light: no planning mid-word (it froze Chromebooks) */ apply(cur); st = performance.now(); dur = ms; }
/* a smooth path through several shapes (J): a curve through all of them, with no stops on the way */
let PATH = null;
const eQw = c => { if (!c.q) return c.w; const e = new THREE.Euler().setFromQuaternion(c.q, 'XYZ'); return [e.x / D, e.y / D, e.z / D]; };
function playPath(keys, ms, ez) { PATH = { keys: keys.map(norm), st: performance.now(), dur: ms, ez: ez || ease }; }      /* ez: how the speed changes along the path (default: slow, fast, slow) */
const cr = (a, b, c, d, s) => Array.isArray(b) ? b.map((_, i) => cr(a[i] === undefined ? b[i] : a[i], b[i], c[i] === undefined ? b[i] : c[i], d[i] === undefined ? (c[i] === undefined ? b[i] : c[i]) : d[i], s)) : 0.5 * ((2 * b) + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s * s * s);
function pathAt(now) {
  const K = PATH.keys, n = K.length, u = PATH.ez(Math.min(1, (now - PATH.st) / PATH.dur)), x = u * (n - 1), i = Math.min(n - 2, Math.floor(x)), sg = x - i, g = j => K[Math.max(0, Math.min(n - 1, j))];
  const A = g(i - 1), B = g(i), C = g(i + 1), E = g(i + 2), o = {};
  ['f', 't', 'w', 'p'].forEach(k => { o[k] = cr(A[k], B[k], C[k], E[k], sg); });
  const qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(B.w[0] * D, B.w[1] * D, B.w[2] * D)), qC = new THREE.Quaternion().setFromEuler(new THREE.Euler(C.w[0] * D, C.w[1] * D, C.w[2] * D));
  o.q = qB.slerp(qC, sg);
  if (u >= 1) { PATH = null; from = to = o; dur = 1; }
  return o;
}
let settled = false;      /* the right hand has reached its pose and was drawn there: no work until the next move */
function tick(now) { if (H.bones && PATH) { settled = false; cur = pathAt(now); apply(cur); } else if (H.bones && !settled) { const k = Math.min(1, (now - st) / dur); if (k >= 1) settled = true; const qf = new THREE.Quaternion().setFromEuler(new THREE.Euler(from.w[0] * D, from.w[1] * D, from.w[2] * D)), qt = new THREE.Quaternion().setFromEuler(new THREE.Euler(to.w[0] * D, to.w[1] * D, to.w[2] * D));
    const kk = ease(k); cur = { f: lerp(from.f, to.f, kk), t: lerp(from.t, to.t, kk), under: to.under, over: to.over, stage: to.stage, w: lerp(from.w, to.w, ease(k)), p: lerp(from.p, to.p, ease(k)), q: qf.slerp(qt, ease(k)) };      /* the hand always turns the short way (Q used to spin around) */ if (PLAN && k < 1) cur = nudge(cur, planAt(PLAN, kk)); apply(cur); } helperTick(now); camTick(now); requestAnimationFrame(tick); }
requestAnimationFrame(tick);
/* speeds (Colleen, 2026-10-13): Beginner 1 letter a second, Intermediate 2, Advanced 4, Deaf 8 (evenly spaced in between) */
const SPEED_SLOW = 1000, SPEED_FAST = 125;
async function spell(word, o) {
  o = o || {};
  /* speed is read again for every step, so moving the slider mid-word speeds the rest of the word up (or slows it down) right away */
  const speedK = () => Math.max(-0.6, Math.min(1, +(o.speed ? o.speed() : 0.35) || 0)),      /* below 0 is slower than Beginner (Fill in the blanks) */ perNow = () => Math.round(SPEED_SLOW * Math.pow(SPEED_FAST / SPEED_SLOW, speedK()));      /* Beginner 0.39 s a letter (the old Advanced) ... Deaf 0.16 s (Colleen) */
  const k = speedK();
  const wait = ms => new Promise(r => setTimeout(r, ms)), lab = { set textContent(v) { if (o.onLetter) o.onLetter(v); } };
  const steps = async (list, total) => { const step = total / list.length; for (const q of list) { moveTo(q, step * 0.9); await wait(step); } };
  /* capitals and punctuation are ignored; a period counts as a space; dashes are dropped; ' ' between words is a short pause */
  const clean = word.toUpperCase().replace(/['\u2019]S\b/g, '\u00A7').replace(/[.]/g, ' ').replace(/[-\u2013\u2014]/g, '').replace(/[^A-Z \u00A7]/g, '').replace(/\s+/g, ' ').trim();
  const chars = clean.split('').filter(c => POSE[c] || c === ' ');
  /* natural habits at Advanced to Deaf speeds (Colleen): about 1 in 4 times each, never both in one word, never on a double letter.
     LOOSE I: the thumb doesn't close all the way (not as open as Y). LAZY PINKY: after a letter with the pinky out, the pinky lags, partly up, in a next letter whose pinky should be curled */
  const fast = k >= 0.666, targets = chars.map(c => POSE[c]);
  const pinkyOut = P => !!P && !Array.isArray(P) && P.f[3][0] < 20 && P.f[3][1] < 35, pinkyIn = P => !!P && !Array.isArray(P) && P.f[3][0] > 50;
  let habit = '';
  chars.forEach((c, n) => {
    const P = POSE[c], dbl = chars[n - 1] === c || chars[n + 1] === c;
    if (!P || !fast || habit || dbl || Array.isArray(P)) return;
    if (c === 'I' && n + 1 < chars.length && pinkyIn(POSE[chars[n + 1]]) && Math.random() < 0.25) {      /* only when the next letter has the pinky down (Colleen) */ targets[n] = Object.assign({}, P, { t: lerpA(norm(P).t, norm(POSE.Y).t, 0.4) }); habit = 'loose I'; return; }
    const prevP = n > 0 ? POSE[chars[n - 1]] : null;
    if (prevP && pinkyOut(prevP) && pinkyIn(P) && Math.random() < 0.25) { const f = P.f.slice(); f[3] = lerpA(P.f[3], prevP.f[3], 0.5); targets[n] = Object.assign({}, P, { f }); habit = 'lazy pinky'; }
  });
  if (!LIGHT) { let prevP = norm(cur); for (const T of targets) { if (!T) continue; if (Array.isArray(T)) { prevP = norm(T[T.length - 1]); continue; } const N = norm(T); planMove(prevP, N); prevP = N; await wait(0); } planMove(prevP, norm(POSE.rest)); }      /* plan every move of the word before it starts */
  for (let n = 0; n < chars.length; n++) {
    if (o.stop && o.stop()) break;      /* the game can stop a word part-way (leaving the screen) */
    const per = perNow();      /* the current speed, for this letter */
    if (chars[n] === ' ') { lab.textContent = ''; await wait(per * 1.5); continue; }      /* between words: hold the last letter, then straight to the next word. The pause scales with the speed: about 0.6 s at Beginner, 0.25 s at Deaf (Colleen) */
    const ch = chars[n], P = targets[n], dbl = n > 0 && chars[n - 1] === ch;
    const acrossSpace = n > 1 && chars[n - 1] === ' ' && chars[n - 2] === ch && !Array.isArray(P);      /* GOOD DAY: the same letter on both sides of a space */
    lab.textContent = (P && P.label) || ch;
    if (ch === 'Z' && chars[n + 1] === 'Z' && Math.random() < 0.5) {      /* ZZ, sometimes: the bent V draws the Z once */
      lab.textContent = 'ZZ'; moveTo(ZZ[0], per * 0.4); await wait(per * 0.45); await steps(ZZ.slice(1), per * 1.2); await wait(per * 0.3); n++; continue;
    }
    if (P.smooth) { const pt = P.quick ? 0.55 : 1.3; moveTo(P[0], per * 0.4); await wait(per * 0.45); playPath(P, per * pt); await wait(per * (pt + 0.15)); continue; }      /* J, and 's (quicker) */
    if (Array.isArray(P)) { await steps(P, per * 1.4); await wait(per * 0.3); continue; }      /* Z */
    if (acrossSpace) {      /* hold through the pause (already done), then open slightly and close again to show the second letter */
      moveTo(DOUBLE[ch] ? DOUBLE[ch](P) : loosen(P, 0.45), per * 0.28); await wait(per * 0.3);
      moveTo(P, per * 0.28); await wait(per * 0.75); continue;
    }
    if (dbl && SLIDE.has(ch) && Math.random() < 0.5) {      /* the double letter slides from right to left */
      moveTo(Object.assign({}, P, { p: [-0.04, 0] }), per * 0.6); await wait(per * 0.9); continue;
    }
    if (dbl) {      /* the double letter loosens about halfway, then closes again */
      moveTo(DOUBLE[ch] ? DOUBLE[ch](P) : loosen(P, 0.45), per * 0.28); await wait(per * 0.3);
      moveTo(P, per * 0.28); await wait(per * 0.75); continue;
    }
    const prevP = n > 0 ? POSE[chars[n - 1]] : null, via = P.via || (prevP && !Array.isArray(prevP) && prevP.via);
    if (via && !(P.via && prevP && prevP.via)) {      /* into or out of G and H: through the natural in-between turn */
      const mid = { f: lerp(cur.f, norm(P).f, 0.5), t: lerp(cur.t, norm(P).t, 0.5), w: via, p: [0, 0] };
      playPath([Object.assign({}, cur, { w: eQw(cur) }), mid, P], per * 0.6); await wait(per * 1.05); continue;
    }
    moveTo(P, per * 0.5); await wait(per);
  }
  const lastP = chars.length ? POSE[chars[chars.length - 1]] : null;
  if (lastP && lastP.via) { playPath([Object.assign({}, cur, { w: eQw(cur) }), { f: lerp(cur.f, norm(POSE.rest).f, 0.5), t: lerp(cur.t, norm(POSE.rest).t, 0.5), w: lastP.via, p: [0, 0] }, POSE.rest], 600); await wait(650); }      /* out of G or H the natural way */
  else moveTo(POSE.rest, 500);
  lab.textContent = '';
}
const PRE_PLANS = /*PRE_PLANS*/{"A>F":[0,0,0,0,0,12,0.7,0.25],"A>G":[-4,0,0,0,0,0,0.6,0.33],"A>H":[-16,0,0,0,0,0,0.6,0.25],"A>K":[-24,0,0,0,0,0,0.6,0.33],"A>M":[-62,-32,-8,16,0,68,0.75,0.44],"A>N":[-44,0,-12,12,44,60,0.73,0.27],"A>O":[0,0,0,0,0,8,0.7,0.25],"A>P":[-24,0,0,0,0,0,0.6,0.33],"A>R":[-16,0,0,0,0,0,0.6,0.25],"A>U":[-16,0,0,0,0,0,0.6,0.25],"A>V":[-16,0,0,0,0,4,0.6,0.33],"A>W":[-16,8,0,0,0,0,0.55,0.33],"D>I":[0,16,16,0,0,0,0.7,0.33],"D>M":[-8,0,0,0,0,74,0.6,0.41],"D>N":[0,-16,0,-12,0,74,0.65,0.41],"D>O":[0,0,0,0,0,20,0.68,0.25],"D>S":[0,20,0,0,0,0,0.7,0.41],"D>V":[-4,0,0,0,0,0,0.7,0.25],"D>X":[0,8,16,0,0,0,0.6,0.33],"F>A":[-8,0,0,0,0,0,0.5,0.25],"F>H":[-4,0,0,0,0,0,0.7,0.25],"F>I":[0,32,4,0,0,12,0.6,0.33],"F>M":[0,16,0,0,0,36,0.6,0.41],"F>N":[16,56,-24,8,0,20,0.6,0.54],"F>R":[-4,0,0,0,0,0,0.7,0.25],"F>S":[0,24,16,0,0,0,0.5,0.33],"F>U":[-4,0,0,0,0,0,0.7,0.25],"F>V":[-12,0,0,0,0,0,0.7,0.25],"F>X":[-16,0,0,0,0,0,0.7,0.25],"G>A":[0,0,0,12,0,0,0.5,0.25],"G>I":[0,16,0,0,0,0,0.8,0.25],"G>K":[0,12,0,0,0,0,0.65,0.25],"G>M":[-16,0,0,16,12,76,0.7,0.41],"G>N":[-40,-8,16,28,20,48,0.6,0.38],"G>P":[0,12,0,0,0,0,0.65,0.25],"G>S":[0,16,0,0,0,0,0.8,0.25],"H>A":[-8,0,0,0,0,52,0.65,0.25],"H>F":[-4,0,0,0,0,0,0.7,0.25],"H>I":[0,24,0,0,0,0,0.7,0.33],"H>M":[14,30,-16,60,0,50,0.43,0.6],"H>N":[-16,0,0,-24,4,52,0.7,0.29],"H>S":[0,20,0,0,0,0,0.8,0.25],"H>V":[-12,0,0,0,0,0,0.7,0.25],"H>W":[-50,0,0,0,0,0,0.6,0.38],"H>X":[-16,0,0,-8,0,0,0.7,0.25],"H>Y":[0,0,0,0,0,16,0.68,0.25],"I>D":[16,32,0,0,0,36,0.5,0.33],"I>F":[0,24,16,0,0,0,0.5,0.33],"I>G":[0,16,0,32,0,28,0.5,0.41],"I>H":[0,24,16,0,0,0,0.5,0.41],"I>K":[0,44,0,0,0,0,0.5,0.33],"I>L":[0,16,28,0,0,0,0.5,0.41],"I>M":[4,-48,-16,16,0,36,0.38,0.48],"I>N":[34,22,0,32,0,30,0.5,0.6],"I>O":[2,32,0,0,0,0,0.6,0.38],"I>P":[0,44,0,0,0,0,0.5,0.33],"I>R":[0,12,24,4,0,20,0.45,0.41],"I>U":[0,24,16,0,0,0,0.5,0.41],"I>V":[2,16,24,0,0,24,0.5,0.46],"I>W":[2,12,32,0,0,28,0.5,0.46],"I>X":[0,32,0,0,0,0,0.6,0.33],"I>rest":[0,24,16,0,0,0,0.45,0.33],"K>A":[0,16,0,12,0,28,0.65,0.33],"K>G":[0,0,0,16,0,4,0.5,0.25],"K>I":[8,16,16,0,0,36,0.8,0.17],"K>M":[-32,0,-12,8,8,60,0.75,0.41],"K>N":[0,16,-20,-20,0,28,0.6,0.3],"K>S":[0,24,0,0,0,0,0.8,0.25],"K>V":[-8,0,0,0,0,0,0.7,0.25],"K>W":[-16,0,0,0,0,0,0.7,0.25],"K>X":[-4,0,0,0,0,0,0.7,0.25],"K>Y":[0,16,0,16,0,20,0.6,0.25],"L>I":[0,24,0,0,0,0,0.7,0.25],"L>M":[0,0,0,8,0,82,0.7,0.33],"L>N":[-14,0,0,8,8,36,0.8,0.34],"L>S":[0,20,0,0,0,0,0.8,0.25],"M>A":[-32,-32,16,-8,0,8,0.3,0.42],"M>D":[16,-20,-12,-12,0,68,0.6,0.33],"M>F":[2,-8,0,0,0,36,0.7,0.3],"M>G":[-62,-62,20,0,8,0,0.4,0.35],"M>H":[-50,-10,0,28,16,50,0.4,0.47],"M>I":[-8,-24,-40,16,-8,40,0.6,0.38],"M>K":[-16,0,8,8,0,72,0.3,0.46],"M>L":[-46,-46,0,-16,-28,6,0.4,0.35],"M>N":[0,-16,0,0,0,76,0.75,0.41],"M>O":[2,-16,0,16,0,28,0.6,0.38],"M>P":[-16,0,8,8,0,72,0.3,0.46],"M>R":[-34,2,-4,0,12,62,0.4,0.59],"M>S":[0,-64,-16,28,-16,36,0.7,0.46],"M>U":[-50,-10,0,28,16,50,0.4,0.47],"M>V":[-14,0,-20,16,28,44,0.83,0.46],"M>X":[32,-52,0,16,-20,16,0.73,0.38],"M>Y":[-56,0,32,-32,4,0,0.4,0.3],"M>rest":[32,0,0,0,0,28,0.6,0.33],"N>A":[-80,16,32,0,0,40,0.3,0.38],"N>D":[-10,-26,-8,12,0,42,0.4,0.51],"N>F":[24,60,-24,24,0,16,0.4,0.38],"N>G":[-30,0,32,24,16,76,0.5,0.38],"N>H":[16,40,-4,0,-8,12,0.4,0.42],"N>I":[46,54,-16,16,0,46,0.5,0.59],"N>K":[2,-16,16,16,-24,56,0.5,0.38],"N>L":[-24,0,-12,16,0,56,0.4,0.38],"N>M":[2,-14,12,12,0,42,0.35,0.57],"N>O":[-16,72,16,-16,0,40,0.3,0.46],"N>P":[2,-16,16,16,-24,56,0.5,0.38],"N>R":[-16,0,0,-32,0,52,0.6,0.45],"N>S":[-54,34,8,0,0,0,0.2,0.55],"N>U":[16,40,-4,0,-8,12,0.4,0.42],"N>V":[-8,8,0,0,0,0,0.6,0.25],"N>W":[0,-16,32,0,-8,8,0.4,0.3],"N>X":[-30,-14,0,16,-16,30,0.2,0.59],"N>Y":[-56,-16,0,-12,12,0,0.4,0.3],"N>rest":[-8,-16,-16,16,-20,28,0.3,0.38],"O>A":[0,0,0,0,0,16,0.5,0.25],"O>D":[0,0,0,0,0,4,0.7,0.25],"O>I":[24,32,4,0,0,44,0.7,0.41],"O>M":[0,0,0,0,0,56,0.5,0.33],"O>N":[14,42,-16,16,0,30,0.6,0.43],"O>S":[0,24,0,0,0,24,0.6,0.41],"O>V":[-4,0,0,0,0,0,0.7,0.25],"O>X":[-12,0,0,0,0,0,0.7,0.25],"P>A":[0,16,0,12,0,28,0.65,0.33],"P>G":[0,0,0,16,0,4,0.5,0.25],"P>I":[8,16,16,0,0,36,0.8,0.17],"P>M":[-32,0,-12,8,8,60,0.75,0.41],"P>N":[0,16,-20,-20,0,28,0.6,0.3],"P>S":[0,24,0,0,0,0,0.8,0.25],"P>V":[-8,0,0,0,0,0,0.7,0.25],"P>W":[-16,0,0,0,0,0,0.7,0.25],"P>X":[-4,0,0,0,0,0,0.7,0.25],"P>Y":[0,16,0,16,0,20,0.6,0.25],"R>A":[-16,0,0,0,0,4,0.65,0.25],"R>F":[-4,0,0,0,0,0,0.7,0.25],"R>I":[0,28,0,0,0,0,0.7,0.25],"R>M":[14,30,-16,60,0,50,0.43,0.6],"R>N":[-12,0,4,-24,-4,52,0.68,0.27],"R>S":[2,24,0,0,0,0,0.7,0.3],"R>V":[-12,0,0,0,0,0,0.7,0.25],"R>W":[-50,0,0,0,0,0,0.6,0.38],"R>X":[-16,0,0,-8,0,0,0.7,0.25],"S>D":[12,32,0,0,0,0,0.5,0.41],"S>F":[0,24,16,0,0,0,0.5,0.33],"S>G":[0,32,8,0,0,0,0.5,0.41],"S>H":[4,32,0,0,0,0,0.5,0.41],"S>K":[0,32,0,0,0,0,0.5,0.41],"S>L":[2,32,28,0,0,0,0.5,0.38],"S>M":[-8,-48,-24,32,-20,32,0.4,0.46],"S>N":[46,46,16,16,0,50,0.6,0.6],"S>O":[0,32,4,0,0,12,0.5,0.33],"S>P":[0,32,0,0,0,0,0.5,0.41],"S>R":[0,32,4,0,0,0,0.5,0.41],"S>U":[4,32,0,0,0,0,0.5,0.41],"S>V":[0,28,0,0,0,0,0.4,0.41],"S>W":[0,44,0,0,0,0,0.4,0.3],"S>X":[2,28,0,0,0,0,0.6,0.38],"S>rest":[0,28,4,0,0,0,0.5,0.41],"U>A":[-8,0,0,0,0,52,0.65,0.25],"U>F":[-4,0,0,0,0,0,0.7,0.25],"U>I":[0,24,0,0,0,0,0.7,0.33],"U>M":[14,30,-16,60,0,50,0.43,0.6],"U>N":[-16,0,0,-24,4,52,0.7,0.29],"U>S":[0,20,0,0,0,0,0.8,0.25],"U>V":[-12,0,0,0,0,0,0.7,0.25],"U>W":[-50,0,0,0,0,0,0.6,0.38],"U>X":[-16,0,0,-8,0,0,0.7,0.25],"U>Y":[0,0,0,0,0,16,0.68,0.25],"V>A":[-16,0,0,0,0,8,0.57,0.25],"V>D":[0,0,0,-8,0,0,0.7,0.25],"V>F":[-32,0,0,-4,0,0,0.6,0.33],"V>H":[0,8,0,0,0,0,0.65,0.25],"V>I":[0,16,8,0,0,0,0.8,0.25],"V>K":[0,8,0,0,0,0,0.5,0.25],"V>M":[-24,16,0,8,-20,0,0.6,0.34],"V>N":[0,16,0,0,0,0,0.5,0.17],"V>O":[0,8,0,0,0,0,0.6,0.25],"V>P":[0,8,0,0,0,0,0.5,0.25],"V>R":[0,8,0,0,0,0,0.65,0.25],"V>S":[2,24,0,0,0,0,0.7,0.3],"V>U":[0,8,0,0,0,0,0.65,0.25],"V>W":[-8,32,4,-16,0,0,0.35,0.3],"V>X":[-30,0,16,0,0,0,0.6,0.3],"V>Y":[0,0,0,0,0,36,0.6,0.25],"W>A":[-12,16,0,0,0,28,0.7,0.25],"W>H":[-12,16,16,0,0,0,0.7,0.33],"W>I":[0,48,0,0,0,0,0.5,0.38],"W>K":[0,0,0,0,0,20,0.7,0.25],"W>N":[-16,-4,0,-8,0,44,0.85,0.25],"W>P":[0,0,0,0,0,20,0.7,0.25],"W>R":[-12,16,16,0,0,0,0.7,0.33],"W>S":[0,52,0,0,0,0,0.5,0.38],"W>U":[-12,16,16,0,0,0,0.7,0.33],"W>V":[-30,12,0,0,0,12,0.68,0.4],"W>X":[-16,0,0,-16,0,12,0.8,0.25],"W>Y":[0,16,0,0,0,20,0.7,0.25],"X>D":[-12,0,0,-16,0,0,0.6,0.33],"X>F":[-32,0,8,-16,0,0,0.6,0.33],"X>H":[-16,0,12,0,0,0,0.3,0.33],"X>I":[0,44,4,0,0,0,0.4,0.3],"X>K":[-8,0,0,0,0,0,0.6,0.33],"X>M":[-26,-30,-12,32,0,46,0.55,0.6],"X>N":[-20,-16,-4,0,0,60,0.57,0.58],"X>O":[0,0,0,-8,0,0,0.6,0.25],"X>P":[-8,0,0,0,0,0,0.6,0.33],"X>R":[-16,0,0,-32,0,0,0.5,0.33],"X>S":[2,12,0,0,0,0,0.7,0.3],"X>U":[-16,0,12,0,0,0,0.3,0.33],"X>V":[0,36,16,0,0,0,0.4,0.3],"X>W":[-46,0,0,0,0,0,0.5,0.38],"Y>H":[0,0,0,0,0,16,0.7,0.25],"Y>K":[-16,0,0,0,0,0,0.7,0.25],"Y>M":[-56,0,-24,-12,-4,12,0.7,0.46],"Y>N":[-40,-16,16,0,16,0,0.7,0.56],"Y>P":[-16,0,0,0,0,0,0.7,0.25],"Y>U":[0,0,0,0,0,16,0.7,0.25],"Y>V":[-12,0,0,0,0,0,0.7,0.25],"Y>W":[-16,12,0,0,0,0,0.7,0.25],"rest>I":[0,12,0,0,0,0,0.8,0.25],"rest>M":[0,0,0,0,0,24,0.7,0.25],"rest>N":[-8,-16,-16,12,-8,48,0.7,0.46],"rest>S":[0,16,0,0,0,0,0.8,0.25],"A>Q":[-4,0,0,0,0,0,0.6,0.33],"I>Q":[0,16,0,32,0,28,0.5,0.41],"K>Q":[0,0,0,16,0,4,0.5,0.25],"M>Q":[-62,-62,20,0,8,0,0.4,0.35],"N>Q":[-30,0,32,24,16,76,0.5,0.38],"P>Q":[0,0,0,16,0,4,0.5,0.25],"Q>A":[0,0,0,12,0,0,0.5,0.25],"Q>I":[0,16,0,0,0,0,0.8,0.25],"Q>K":[0,12,0,0,0,0,0.65,0.25],"Q>M":[-16,0,0,16,12,76,0.7,0.41],"Q>N":[-40,-8,16,28,20,48,0.6,0.38],"Q>P":[0,12,0,0,0,0,0.65,0.25],"Q>S":[0,16,0,0,0,0,0.8,0.25],"S>Q":[0,32,8,0,0,0,0.5,0.41],"A>T":[0,0,0,0,16,76,0.7,0.25],"D>T":[0,8,16,0,0,0,0.6,0.25],"F>T":[0,0,16,0,0,36,0.6,0.41],"G>T":[0,0,0,0,0,12,0.7,0.25],"H>T":[-16,0,0,0,0,8,0.7,0.25],"I>T":[-64,0,16,-24,0,8,0.5,0.46],"K>T":[-8,0,0,0,0,4,0.62,0.25],"L>T":[16,0,0,0,0,8,0.75,0.25],"M>T":[-30,-16,0,32,0,68,0.6,0.5],"N>T":[-30,-8,16,16,-4,48,0.45,0.56],"O>T":[-12,0,0,0,0,32,0.6,0.33],"P>T":[-8,0,0,0,0,4,0.62,0.25],"Q>T":[0,0,0,0,0,12,0.7,0.25],"R>T":[-16,0,0,0,0,12,0.7,0.25],"S>T":[-60,-8,24,-8,0,0,0.5,0.46],"T>A":[-48,16,16,0,0,0,0.5,0.33],"T>D":[-12,0,0,0,0,0,0.7,0.25],"T>F":[-24,-12,0,0,0,64,0.5,0.29],"T>G":[8,0,0,0,0,4,0.5,0.33],"T>H":[-32,0,32,0,0,8,0.6,0.33],"T>I":[0,44,0,0,0,28,0.5,0.49],"T>K":[-12,0,0,0,0,0,0.6,0.25],"T>L":[2,0,-8,0,0,28,0.5,0.38],"T>M":[-46,-24,16,48,0,52,0.7,0.54],"T>N":[-16,-16,0,0,0,88,0.63,0.37],"T>O":[-16,0,16,0,0,60,0.6,0.25],"T>P":[-12,0,0,0,0,0,0.6,0.25],"T>Q":[8,0,0,0,0,4,0.5,0.33],"T>R":[-28,0,32,0,0,4,0.6,0.33],"T>S":[0,44,0,0,0,28,0.5,0.49],"T>U":[-32,0,32,0,0,8,0.6,0.33],"T>V":[-12,36,20,0,0,0,0.4,0.3],"T>W":[-16,32,16,-4,0,0,0.4,0.3],"T>X":[-12,-12,0,0,0,40,0.4,0.25],"T>Y":[-32,12,16,4,0,8,0.5,0.33],"T>rest":[0,-16,-16,0,0,28,0.6,0.33],"U>T":[-16,0,0,0,0,8,0.7,0.25],"V>T":[-8,8,16,0,0,20,0.7,0.33],"W>T":[-8,0,16,0,0,28,0.8,0.25],"X>T":[-8,-16,0,0,0,12,0.7,0.25],"Y>T":[0,0,-16,0,0,56,0.7,0.25],"rest>T":[0,0,0,0,0,20,0.8,0.25],"A>B":[-16,16,0,0,0,0,0.7,0.25],"B>A":[0,16,0,0,0,16,0.6,0.33],"G>B":[0,16,0,0,0,0,0.7,0.25],"B>G":[0,8,0,0,0,0,0.7,0.25],"H>B":[-30,8,0,-12,0,0,0.6,0.38],"B>H":[-16,0,0,0,0,0,0.7,0.25],"M>B":[-16,4,0,0,0,0,0.6,0.33],"B>M":[-4,0,0,0,0,0,0.7,0.25],"N>B":[0,-12,32,-4,0,24,0.5,0.35],"B>N":[-16,-16,0,0,-12,60,0.7,0.25],"R>B":[-30,8,0,-12,0,0,0.6,0.38],"B>R":[-16,0,0,0,0,0,0.7,0.25],"U>B":[-30,8,0,-12,0,0,0.6,0.38],"B>U":[-16,0,0,0,0,0,0.7,0.25],"V>B":[-16,28,0,-16,0,0,0.4,0.3],"B>V":[-22,8,0,0,0,0,0.7,0.3],"W>B":[-8,0,0,0,0,0,0.6,0.33],"B>W":[-4,0,0,0,0,0,0.7,0.25],"I>B":[0,44,8,0,0,0,0.4,0.3],"B>I":[0,56,0,-8,0,0,0.5,0.38],"S>B":[0,48,8,0,0,0,0.4,0.3],"B>S":[0,52,8,0,0,0,0.5,0.38],"X>B":[-58,8,0,0,0,0,0.6,0.38],"B>X":[-8,0,0,-16,0,0,0.8,0.25],"L>B":[0,8,0,0,0,0,0.7,0.25],"B>L":[4,16,0,16,0,0,0.6,0.33],"Y>B":[0,12,0,0,0,0,0.7,0.25],"B>Y":[0,16,0,0,0,8,0.6,0.33],"Q>B":[0,16,0,0,0,0,0.7,0.25],"B>Q":[0,8,0,0,0,0,0.7,0.25],"T>B":[-38,0,12,12,0,0,0.6,0.38],"B>T":[-8,0,16,0,0,0,0.7,0.25],"A>E":[-12,-4,16,28,0,76,0.7,0.33],"E>A":[-28,44,0,28,0,24,0.4,0.38],"F>E":[0,0,0,0,0,32,0.5,0.37],"E>F":[0,16,0,16,0,28,0.6,0.33],"G>E":[-16,0,0,16,16,76,0.8,0.33],"E>G":[8,36,0,0,0,40,0.4,0.3],"H>E":[0,24,32,0,0,0,0.6,0.33],"E>H":[0,36,4,0,0,0,0.4,0.38],"K>E":[0,16,0,0,0,28,0.7,0.25],"E>K":[0,0,16,16,0,28,0.4,0.33],"M>E":[-30,-16,-16,16,-16,48,0.65,0.38],"E>M":[-14,0,-16,16,8,44,0.6,0.38],"N>E":[16,36,-8,28,0,40,0.3,0.4],"E>N":[0,32,-16,0,0,74,0.85,0.57],"O>E":[0,0,0,0,0,56,0.6,0.41],"E>O":[16,28,0,16,0,28,0.6,0.33],"P>E":[0,16,0,0,0,28,0.7,0.25],"E>P":[0,0,16,16,0,28,0.4,0.33],"R>E":[0,24,32,0,0,0,0.6,0.33],"E>R":[0,36,4,0,0,0,0.4,0.38],"U>E":[0,24,32,0,0,0,0.6,0.33],"E>U":[0,36,4,0,0,0,0.4,0.38],"V>E":[2,48,0,0,0,0,0.7,0.46],"E>V":[0,40,4,0,0,0,0.4,0.38],"W>E":[-16,0,8,-12,0,24,0.6,0.25],"E>W":[0,0,12,0,0,0,0.6,0.33],"I>E":[0,32,0,0,0,0,0.6,0.41],"E>I":[0,32,8,0,0,8,0.4,0.38],"S>E":[0,32,4,0,0,0,0.6,0.41],"E>S":[32,24,-4,0,0,28,0.6,0.41],"X>E":[0,40,0,8,0,40,0.4,0.46],"E>X":[-46,-16,-16,24,0,76,0.6,0.54],"D>E":[0,4,0,0,0,60,0.6,0.41],"E>D":[16,8,0,16,0,20,0.6,0.33],"L>E":[0,0,0,32,0,52,0.7,0.33],"E>L":[8,48,0,0,0,24,0.35,0.3],"Y>E":[0,-16,16,16,20,68,0.7,0.37],"E>Y":[0,32,8,16,0,52,0.4,0.38],"rest>E":[0,0,0,0,0,44,0.75,0.25],"E>rest":[0,0,0,16,0,16,0.4,0.33],"Q>E":[-16,0,0,16,16,76,0.8,0.33],"E>Q":[8,36,0,0,0,40,0.4,0.3],"T>E":[-30,-16,16,8,24,68,0.65,0.5],"E>T":[-30,-18,16,12,0,74,0.4,0.43],"B>E":[0,0,0,0,0,8,0.7,0.25],"E>B":[0,0,0,0,0,16,0.5,0.33],"C>E":[0,0,0,0,0,44,0.7,0.25],"E>C":[12,24,0,12,0,44,0.57,0.33],"C>I":[0,16,0,0,0,8,0.7,0.25],"I>C":[0,24,4,0,0,0,0.5,0.33],"C>M":[0,0,0,4,0,60,0.7,0.25],"M>C":[16,-20,-32,-4,0,44,0.6,0.33],"C>N":[0,48,-44,8,0,36,0.85,0.54],"N>C":[30,30,0,24,0,16,0.2,0.51],"C>S":[12,16,0,0,0,0,0.7,0.25],"S>C":[16,16,12,16,0,0,0.5,0.33],"C>T":[-12,0,0,0,0,48,0.7,0.25],"T>C":[-8,-8,0,0,0,28,0.4,0.41],"C>X":[-8,0,0,0,0,0,0.7,0.25],"X>C":[0,0,0,-12,0,0,0.6,0.33]}/*END*/;
/* NUMBERS 0-20 (Colleen's description, 2026-10-13; her region's forms). Each number is a start shape and a list of steps [shape, time];
   times are in "beats" (one beat = one letter's time at the chosen speed). Palm in = the back of the hand toward the student. Not locked until Colleen approves each one. */
const IN = [0, 178, 0], OUT = [0, 0, 0], SIDE = [0, -35, 0];      /* palm in: the hand turns toward the thumb, all the way around (Colleen). SIDE: the 10, thumb print facing the student */
const SP = [[0, 0, 0, 15], [0, 0, 0, 3], [0, 0, 0, -9], [0, 0, 0, -20]];      /* four fingers spread (4 and 5, Colleen: spread apart) */
const TOG4 = [UP, UP, UP, UP];      /* four fingers together (13-15, Colleen) */
const THUMB_OUT = [1, -28, 47, -1, -3], THUMB_TUCK = [50, -45, -60, 50, 20];      /* out to the side (as in Y); flat across the palm (as in B) */
/* LOCKED by Colleen (2026-10-13): ALL of 0-20, both forms of 16-19 (6's pinky: her choice "A"). Do not change them without her say (6's pinky was straightened afterward with her OK). */
/* 1-5 standing alone are palm in; inside a longer number (25, phone numbers) they are palm out (Colleen) */
const SH = {
  0: { f: [[40, 60, 40, 4], [40, 60, 40, 0], [40, 60, 40, -3], [40, 60, 40, -6]], t: [49, 10, 31, 2, 7], w: [0, 85, -20] },      /* as in Colleen's picture: pinky side to the student, the top leaning right; the fingers curl alike and the thumb arches out so the round center shows */
  1: { f: [UP, FIST, FIST, FIST], t: [21, -16, -60, 67, 1], w: IN },
  2: Object.assign({}, POSE.V, { w: IN }),
  3: { f: POSE.V.f, t: THUMB_OUT, w: IN },
  4: { f: SP, t: THUMB_TUCK, w: IN },
  5: { f: SP, t: THUMB_OUT, w: IN },
  /* 6-8: the fingertip meets the thumb tip side by side, the same way as 9: no tucking, no overlap (Colleen) */
  6: { f: [[0, 0, 0, 16], [0, 0, 0, 2], [0, 0, 0, -6], [43, 41, 17, 0, 40]], t: [51, -10, -59, 45, 14], w: OUT },      /* the pinky curves in toward the thumb to meet it; the thumb stays nearly straight, not hooked (Colleen) */      /* the pinky bends at its base, its end tilting in toward the thumb, tip to the thumb tip (Colleen) */
  7: { f: [[0, 0, 0, 14], [0, 0, 0, 0], [50, 50, 50, -2], [0, 0, 0, -20]], t: [51, -7, -52, 42, 10], w: OUT },
  8: { f: [[0, 0, 0, 18], [50, 50, 45, -4], [0, 0, 0, -10], [0, 0, 0, -22]], t: [59, 11, -27, -6, 11], w: OUT },
  9: Object.assign({}, POSE.F, { w: OUT }),
  10: { f: POSE.A.f, t: [-33, -10, 40, 0, 0], w: [-41, 80, 99] }      /* thumbs up as in Colleen's picture: the curled fingers stacked facing the student, thumb straight up, wrist below */
};
const bendAll = (P, k, n) => Object.assign({}, P, { f: P.f.map((g, i) => i < n ? [g[0] + k, g[1], g[2], g[3]] : g) });      /* bend the first n fingers at the big knuckle */
const twist = (P, y) => Object.assign({}, P, { w: [P.w[0], y, P.w[2]] });
const rep = (a, b, times, beat) => { const o = []; for (let i = 0; i < times; i++) o.push([b, beat], [a, beat]); return o; };
/* 11, 12: the finger is held partly bent by the thumb (not tucked all the way down), then flicks up; the thumb stays put so the flick is clean */
const T11 = [32, 1, -57, 15, 23], T12 = [35, 1, -46, 18, 6];
const S11 = { f: [[45, 70, 40, 0], FIST, FIST, FIST], t: T11, w: IN }, E11 = { f: [UP, FIST, FIST, FIST], t: T11, w: IN };
const S12 = { f: [[45, 70, 40, 12], [45, 70, 40, -10], FIST, FIST], t: T12, w: IN }, E12 = { f: [[0, 0, 0, 12], [0, 0, 0, -10], FIST, FIST], t: T12, w: IN };      /* spread a bit more (Colleen) */
const S13 = { f: [UP, UP, FIST, FIST], t: THUMB_OUT, w: IN }, S14 = { f: TOG4, t: THUMB_TUCK, w: IN }, S15 = { f: TOG4, t: THUMB_OUT, w: IN };
const C20 = { f: [[80, 20, 10, 0], FIST, FIST, FIST], t: [36, 32, 48, 4, 2], w: OUT };      /* the pinch: pointer finger and thumb kept straight, bending at the big knuckles (Colleen); palm to the audience */
const NUM = {};
for (let n = 0; n <= 9; n++) NUM[n] = { start: SH[n], steps: [] };
const T10a = Object.assign({}, SH[10], { w: [-83, 62, 138] }), T10b = Object.assign({}, SH[10], { w: [56, 71, 5] });      /* the wrist twisted about 22 degrees each way, around the forearm */
NUM[10] = { start: SH[10], steps: [[T10b, 0.18], [SH[10], 0.2], [T10b, 0.18], [SH[10], 0.2]] };      /* thumb up, a quick wrist twist twice, the push going the other way (Colleen) */
NUM[11] = { start: S11, steps: rep(S11, E11, 2, 0.3) };      /* the index flicks up from the thumb, twice */
NUM[12] = { start: S12, steps: rep(S12, E12, 2, 0.3) };
const S13b = twist(S13, 198);      /* 13 turns further than the other palm-in numbers, past straight back (Colleen) */
NUM[13] = { start: S13b, via: twist(S13, 110), steps: rep(S13b, bendAll(S13b, 60, 2), 2, 0.3) };      /* via: turns in and back out the thumb way, not the short way */      /* index and middle together bend down at the knuckles, twice */
NUM[14] = { start: S14, steps: rep(S14, bendAll(S14, 65, 4), 2, 0.3) };
NUM[15] = { start: S15, steps: rep(S15, bendAll(S15, 65, 4), 2, 0.3) };
/* 16-19, two ways (Colleen): 'ten' (10 + number) is first and the default; 'twist' = starts tipped forward (fingers toward the student, palm toward the right of the screen), the 6-9 shape twists OUT to palm out twice (the push is toward the front, little back of the hand);
   'ten' = 10 + the number: a thumbs-up showing the back of the hand (fingers toward the signer, thumb angled up and toward the signer's right),
   then ONE quick flick forward into the 6-9 shape palm out, and it stays (Colleen) */
const TEN_B = { f: POSE.A.f, t: [-10, -11, 60, -10, -10], w: [0, -140, 30] };      /* starts 25 degrees less turned, so the flick is gentler (Colleen) */      /* starts turned the other way, so the flick swings forward; tipped so the thumb points up, as in the real 10 (Colleen) */
for (let n = 16; n <= 19; n++) { const P = SH[n - 10], F = Object.assign({}, P, { w: [28, 0, 0] }), A = Object.assign({}, P, { w: [25, 45, 0] }), B = Object.assign({}, P, { w: [6, 30, 0] }); NUM[n] = { start: A, steps: [[F, 0.22], [B, 0.28], [F, 0.22]],      /* each push forward tips the palm about 25 degrees toward the floor (not palm down) */ ten: { start: TEN_B, steps: [[P, 0.3]] }      /* ends facing forward, as in 6-9 (Colleen) */ }; }
const O20 = { f: [[35, 0, 0, 0], FIST, FIST, FIST], t: lerp(C20.t, POSE.L.t, 0.5), w: OUT };      /* partly open, not all the way to L, fingers straight (Colleen) */
NUM[20] = { start: O20, steps: rep(O20, C20, 2, 0.22) };      /* partly open, then pinch, pinch */
/* DOUBLES 22-99 (Colleen, 2026-10-13; 11 keeps its own locked flick): the number's handshape, palm down but tipped (not flat), fingertips
   toward the student. Only the hand moves, bending at the wrist (the wrist and arm stay still). The emphasis is DOWN: a firm placing into
   the first down position, then one big, elegant arc: the hand lifts high at the wrist while turning toward the signer's right (the
   student's left), speeding up into a firm placing in the second down position. Keys: [w, p], p keeping the wrist in place. LOCKED by Colleen (2026-10-13). */
const PLACE = [[[60.4, 34.2, -44.7], [-0.048, 0.02]], [[74.7, 18.7, -49.5], [-0.039, 0]], [[30.2, 36, -18.8], [-0.071, 0.035]], [[67.1, 7.2, -16.5], [-0.069, 0]]];
const EASE_IN = k => 1 - Math.cos(k * Math.PI / 2);      /* starts gently, lands firmly */
for (let d = 2; d <= 9; d++) {
  const K = PLACE.map(([w, p]) => Object.assign({}, SH[d], { w, p }));
  NUM[d * 11] = { start: K[0], steps: [[K[1], 0.2], [K[1], 0.3]], arc: { keys: [K[1], K[2], K[3]], beats: 1 } };      /* down (firm), hold, the arc into the second down */
}
/* ROCKING NUMBERS (Colleen, 2026-10-13): 67 68 69 76 78 79 86 87 89 96 97 98. The hand rocks in the plane of the palm while the thumb moves
   to the second digit's finger, one smooth movement. The smaller digit is in the DOWN position (turned counterclockwise as the
   student sees it, 35 degrees, the arm a little lower), the bigger digit upright: 67 rises from down to up, 76 goes from up to down. LOCKED by Colleen (2026-10-13). */
const ROCK_DOWN = [0, 0, 35], ROCK_DROP = [0, -0.015];      /* down: turned 35 degrees, and the whole arm a little lower (Colleen) */
for (const a of [6, 7, 8, 9]) for (const b of [6, 7, 8, 9]) {
  if (a === b) continue;
  const at = (d, low) => Object.assign({}, SH[d], { w: low ? ROCK_DOWN : OUT, p: low ? ROCK_DROP : [0, 0] });
  const A = at(a, a < b), B = at(b, b < a);
  NUM[a * 10 + b] = { start: A, steps: [[A, 0.25], [B, 0.55]] };      /* show the first digit, then rock into the second */
}
/* THE 20s (Colleen, 2026-10-13; 20 and 22 are locked already). The 'twenty' is an L, palm out; 1-5 face palm out inside a number (her rule).
   21: the L, the thumb bends twice. 24, 26-29: the L changes into the number. 23 and 25 come two ways (Colleen: a mix of both):
   SLANG: the 3 or 5 shape with the middle finger bending twice; FORMAL (alt): the L changing into 3 or 5. ALL of the 20s LOCKED by Colleen (2026-10-13). */
const L2 = Object.assign({}, POSE.L, { w: OUT });
const L21 = L2, L21b = Object.assign({}, L2, { t: [L2.t[0], L2.t[1], L2.t[2], 45, 62, -96] }      /* the curl turned 20 degrees up from the version that leaned forward, between it and straight up (Colleen) */);      /* 21: the open thumb is exactly the L thumb; it curls up (the turn that makes the curl go up happens in the thumb itself, so the heel of the hand does not ripple), like a finger beckoning "come here"; never bent back past straight (Colleen) */
const OUT3 = Object.assign({}, SH[3], { w: OUT }), OUT4 = Object.assign({}, SH[4], { w: OUT }), OUT5 = Object.assign({}, SH[5], { w: OUT });
/* 23, 25: the middle finger is pulled forward from the palm knuckle and draws its neighbors along in a cascade (index and ring partly, pinky a little);
   it starts already partly down and dips well below pointing up (Colleen). share = how much each finger follows the middle finger. */
const pull = (P, mcp, share) => Object.assign({}, P, { f: P.f.map((g, i) => share[i] ? [g[0] + mcp * share[i], g[1] + mcp * share[i] * 0.25, g[2] + mcp * share[i] * 0.12, g[3]] : g) });
const twoBends = (P, share) => { const up = pull(P, 22, share), down = pull(P, 62, share), part = pull(P, 28, share); return { start: up, steps: [[down, 0.25], [part, 0.22], [down, 0.25], [up, 0.25]] }; };      /* between the dips the finger comes back only about 85% of the way */
/* the L-to-number 20s slide slightly toward the left of the frame (the signer's right) as they change (Colleen); 21 and the bending 23 and 25 stay in place */
const SLIDE20 = -0.02;
const fromL = P => ({ start: L2, steps: [[L2, 0.3], [Object.assign({}, P, { p: [SLIDE20 * 1.5, 0] }), 0.55]] });      /* show the L, then slide and change in one move, landing in the second digit (Colleen) */
NUM[21] = { start: L21, steps: rep(L21, L21b, 2, 0.45) };      /* no slide; soft and even, not a snap (Colleen) */
NUM[23] = Object.assign(twoBends(OUT3, [0.35, 1, 0, 0]), { alt: fromL(OUT3) });      /* the bending 23 and 25 do not slide; the L versions do (Colleen) */
NUM[24] = fromL(OUT4);
NUM[25] = Object.assign(twoBends(OUT5, [0.35, 1, 0.5, 0.25]), { alt: fromL(OUT5) });
for (let d = 6; d <= 9; d++) NUM[20 + d] = fromL(SH[d]);
/* TENS 30-90 (Colleen, 2026-10-13): the number palm out, no slide, then it closes into a 0 that stays palm out (no wrist twist).
   LOCKED by Colleen (2026-10-13) with the sock-puppet 0 below. */
const ZERO_OUT = { f: SH[0].f.slice(0, 3).map((g, i) => [g[0], g[1] + 10, g[2] + 7, [-4, 6, 14][i], [0, 8, 16][i]]).concat([[24, 66, 44, 6, 6, 10]]), t: SH[0].t, w: [15, 0, 0] };      /* Colleen's closest version: fingers leaning in on top of the thumb and rounded, the wrist tilted down a little; the pinky lifted up level with the ring finger, beside it (never under it) */
for (let d = 3; d <= 9; d++) { const P = Object.assign({}, SH[d], { w: OUT }); NUM[d * 10] = { start: P, steps: [[P, 0.3], [ZERO_OUT, 0.5]] }; }
/* PLAIN TWO-DIGIT NUMBERS 31-99 (Colleen, 2026-10-13): the first digit palm out (1-5 stay palm out inside a number), then the hand slides
   slightly toward the left of the frame (the signer's right) while changing into the second digit, landing in it, as in the 20s.
   Doubles, rocking numbers and tens keep their own forms. LOCKED by Colleen (2026-10-13). */
const DIGIT_OUT = d => Object.assign({}, SH[d], { w: OUT });
for (let a = 3; a <= 9; a++) for (let b = 1; b <= 9; b++) {
  const n = a * 10 + b; if (NUM[n]) continue;
  NUM[n] = { start: DIGIT_OUT(a), steps: [[DIGIT_OUT(a), 0.3], [Object.assign({}, DIGIT_OUT(b), { p: [SLIDE20 * 1.5, 0] }), 0.55]] };
}
/* HUNDREDS 100-900 (Colleen, 2026-10-13): the digit palm forward, then the hand pulls away from the student while changing, two ways:
   'c' = into a full C handshape; 'curl' = only the fingers that were up for the digit hook like the letter X (100 = 1 back into an X). LOCKED by Colleen (2026-10-13). */
const BACK = [0, 0, -0.045];
const C_TURN = [0, 8, 0];      /* only a hint of a turn (Colleen: turning it was a bad idea; 35 and 20 were too much) */
const C_OUT = { f: [[30, 45, 25, 0], [30, 45, 25, 0], [30, 45, 25, 0], [30, 45, 25, 0]], t: [31, 6, -44, 17, 46], w: C_TURN };      /* the hundreds keep their own locked C (the letter C's fingers were pulled together later) */      /* the letter C with the thumb a little lower (Colleen) */
const curlUp = P => Object.assign({}, P, { f: P.f.map(g => g[0] < 20 && g[1] < 30 ? [POSE.X.f[0][0], POSE.X.f[0][1], POSE.X.f[0][2], g[3]] : g),
  t: P.t === THUMB_OUT ? [THUMB_OUT[0], THUMB_OUT[1], THUMB_OUT[2], 45 * 0.7, 62 * 0.7, -96 * 0.7] : P.t });      /* 70% of the way along the 21-style curl (the turn shrinks with the bend, so the joint does not tip down) (Colleen) */      /* if the thumb is out (3, 5), it curls too, UP the way the 21 thumb curls (Colleen: curling in was the wrong way) */      /* the up fingers hook like the letter X (Colleen: 100 = 1 back into an X shape) */
for (let d = 1; d <= 9; d++) {
  const A = Object.assign({}, SH[d], { w: OUT, p: [0, 0, 0] });
  const pullTo = Q => ({ start: A, steps: [[A, 0.3], [Object.assign({}, Q, { w: Q.w || OUT, p: BACK }), 0.55]] });
  NUM[d * 100] = Object.assign(pullTo(C_OUT), { hund: { c: pullTo(C_OUT), curl: pullTo(curlUp(A)) } });
}
async function sign(n, o) {
  o = o || {};
  const N = NUM[n]; if (!N) return;
  const per = o.per || 500, wait = ms => new Promise(r => setTimeout(r, ms));
  let use = (o.teens !== 'twist' && N.ten) ? N.ten : N;      /* 10 + number unless the twist is asked for (Colleen: 10 + number is the default) */
  if (N.alt && (o.form === 'alt' || (o.form !== 'main' && Math.random() < 0.5))) use = N.alt;      /* 23, 25: either way, mixed unless asked (Colleen) */
  if (N.hund) use = N.hund[o.hund === 'c' || o.hund === 'curl' ? o.hund : (Math.random() < 0.5 ? 'c' : 'curl')];      /* HUNDRED: the C or the curl, mixed unless asked */
  if (o.series && n >= 1 && n <= 5) use = { start: DIGIT_OUT(n), steps: [] };      /* inside a longer number, 1-5 face palm out (Colleen) */
  if (o.onLetter) o.onLetter(String(n));
  if (o.series) {      /* the same handshape twice in a row (the 7 of 17 and the 7 of 76 in 1776, Colleen): the touching fingers open a little and tap closed again */
    const A = norm(cur), B = norm(use.via || use.start), diff = A.f.reduce((t, F, i) => t + F.reduce((u, v, j) => u + Math.abs(v - B.f[i][j]), 0), 0) + A.t.reduce((t, v, j) => t + Math.abs(v - B.t[j]), 0);
    if (diff < 40) { moveTo(loosen(B, 0.3), per * 0.22); await wait(per * 0.25); }
  }
  if (use.via) { moveTo(use.via, per * 0.25); await wait(per * 0.25); moveTo(use.start, per * 0.3); await wait(per * 0.45); }
  else { moveTo(use.start, per * 0.5); await wait(per * 0.65); }
  if (use.hold) await wait(per * use.hold);
  if (use.arc) { for (const [P, b] of use.steps) { moveTo(P, per * b * 0.95); await wait(per * b); } playPath(use.arc.keys, per * use.arc.beats, EASE_IN); await wait(per * use.arc.beats); }
  else
  if (use.path) { const total = use.steps.reduce((t, x) => t + x[1], 0); playPath([use.start].concat(use.steps.map(x => x[0])), per * total); await wait(per * total); }
  else for (const [P, b] of use.steps) { if (o.stop && o.stop()) break; moveTo(P, per * b * 0.95); await wait(per * b); }
  await wait(per * 0.7);
  if (o.stay) return;
  if (use.via) { moveTo(use.via, 250); await wait(260); }
  moveTo(POSE.rest, 500); await wait(520);
  if (o.onLetter) o.onLetter('');
}
/* THOUSAND (Colleen's rules and photo, 2026-10-13): two hands, little movement. The left hand turns in its corner so its fingers point at the
   student (still standing vertical, palm toward the signing hand), then just lifts up a little while the right hand, a flattened, slightly bent B
   with the back of the hand to the student, comes in from the left and its fingertips land on the left palm with a clear stop (once, no tapping).
   Then the left hand goes back to its corner. The fingers stay at least 2 cm from the left thumb (Colleen: the pointer passed through it). LOCKED by Colleen (2026-10-13). */
const TH_LEFT = [-180, 90, -105];      /* fingers toward the student, palm toward the signing hand, thumb up */
const HELPER_TURN = { f: HELPER_REST.f, t: HELPER_REST.t, w: TH_LEFT, p: HELPER_REST.p }, HELPER_UP = { f: HELPER_REST.f, t: HELPER_REST.t, w: TH_LEFT, p: [-0.12, -0.04, 0] };
const TH_B = [[35, 25, 10, 2], [35, 25, 10, 0], [35, 25, 10, -2], [35, 25, 10, -4]], TH_T = [50, -45, -60, 50, 20];
const TH_ABOVE = { f: TH_B, t: TH_T, w: [157, 48, -91], p: [-0.056, -0.056, 0] }, TH_TOUCH = { f: TH_B, t: TH_T, w: [157, 48, -91], p: [-0.021, -0.054, 0] };      /* z 0: exactly what Colleen saw and locked (a bug then dropped the -0.03) */      /* the fingertips land in the center of the palm, clear of the thumb, stopping right at the skin (both hands are solid, measured from the skin itself) */
/* MILLION (Colleen, 2026-10-13): the THOUSAND move, then the hand pulls back twice as far and moves toward the student, and the fingertips land
   a second time on the very tips of the left fingers (palm side), then return. LOCKED by Colleen (2026-10-14). */
const TM_ABOVE1 = { f: TH_B, t: TH_T, w: [157, 48, -91], p: [-0.056, -0.046, 0.01] }, TM_TOUCH1 = { f: TH_B, t: TH_T, w: [157, 48, -91], p: [-0.021, -0.044, 0.01] };      /* MILLION's first tap: the true center of the left palm, below the left thumb (checked from above; THOUSAND keeps its locked spot) */
const TH_ABOVE2 = { f: TH_B, t: TH_T, w: [157, 48, -91], p: [-0.044, -0.019, 0.063] }, TH_TOUCH2 = { f: TH_B, t: TH_T, w: [157, 48, -91], p: [-0.022, -0.023, 0.083] };      /* after tap 1 the hand pushes forward toward the student and its fingertips land on the pads of the left fingertips (aimed from the right fingertip's skin to the left fingertip pad's skin) (Colleen) */
async function thousand(o, last, million) {
  const per = o.per || 500, wait = ms => new Promise(r => setTimeout(r, ms));
  if (o.onLetter) o.onLetter(million ? 'MILLION' : 'THOUSAND');
  /* one fluid movement: the left hand turns to point at the student and lifts, while the right hand sweeps in and its fingertips land on the palm */
  helperMove(HELPER_UP, per * 0.45);
  playPath([Object.assign({}, cur, { w: eQw(cur) }), million ? TM_ABOVE1 : TH_ABOVE, million ? TM_TOUCH1 : TH_TOUCH], per * 0.55, EASE_IN); await wait(per * 0.57);      /* fastest at the end: an abrupt stop, as if contact happened */
  await wait(per * (million ? 0.22 : 0.35));      /* a clear stop on the palm */
  if (million) {      /* lift off a little and land again, near the knuckles */
    playPath([Object.assign({}, cur, { w: eQw(cur) }), TH_ABOVE2, TH_TOUCH2], per * 0.55, EASE_IN); await wait(per * 0.57);
    await wait(per * 0.35);
  }
  if (last) { moveTo(million ? TH_ABOVE2 : TH_ABOVE, per * 0.25); await wait(per * 0.28); }
  helperMove(HELPER_REST, per * 0.6);      /* back to the corner while the number goes on */
}
/* a whole number from blocks, in spoken order (Colleen's rules): tokens are numbers 0-99 and 'H' (HUNDRED, after a digit 1-9).
   The parts flow into each other with no return to rest in between; onPart(i) tells which block is playing. */
function partsOf(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (tokens[i + 1] === 'H' && t >= 1 && t <= 9) { out.push({ n: t * 100, blocks: [i, i + 1] }); i++; }
    else if (t === 'T' || t === 'M') out.push({ n: t, blocks: [i] });
    else if (t !== 'H') out.push({ n: t, blocks: [i] });
  }
  return out;
}
async function signParts(tokens, o) {
  o = o || {};
  const parts = partsOf(tokens);
  for (let k = 0; k < parts.length; k++) {
    if (o.stop && o.stop()) break;
    if (o.onPart) o.onPart(parts[k].blocks);
    if (parts[k].n === 'T' || parts[k].n === 'M') { await thousand(o, k === parts.length - 1, parts[k].n === 'M'); continue; }
    await sign(parts[k].n, Object.assign({}, o, { stay: k < parts.length - 1, series: parts.length > 1 }));      /* inside a longer number, 1-5 face palm out */
  }
  if (o.onPart) o.onPart([]);
  if (tokens.indexOf('T') >= 0 || tokens.indexOf('M') >= 0) { moveTo(POSE.rest, 500); await new Promise(r => setTimeout(r, 520)); }
}
/* YEARS (Colleen, 2026-10-15; dev/ASL-number-rules.md "Years"). Three types:
   1000-1999: the first two digits (10-19, always the 10 + number form) + the last two as ONE number (76 rocks, 22 double-bounces);
              01-09 at the end: 0 then the digit, no slide (1906 = 19, 0, 6); 00 at the end: a 0 that slides (1900 = 19, sliding 0).
   2000-2009: 2 palm out, a 0 that slides toward the signer's right, the last digit palm out; 2000 = 2 and a slightly longer slide.
   2010-2099: TWENTY + the last two as ONE number. Any 16-19 in a year uses the 10 + number form. */
const SLIDE_X = -0.085, SLIDE_LONG = -0.12;      /* toward the signer's right (the student's left), like the doubles' arc */
async function zeroSlide(o, long, last) {
  const per = o.per || 500, wait = ms => new Promise(r => setTimeout(r, ms));
  const Z = Object.assign({}, NUM[0].start, { p: [0, 0] }), Z2 = Object.assign({}, NUM[0].start, { p: [long ? SLIDE_LONG : SLIDE_X, 0] });
  if (o.onLetter) o.onLetter('0');
  moveTo(Z, per * 0.45); await wait(per * 0.5);
  playPath([Z, Z2], per * (long ? 1.0 : 0.75)); await wait(per * (long ? 1.05 : 0.8));
  await wait(per * 0.5);
  if (last) { moveTo(POSE.rest, 500); await wait(520); if (o.onLetter) o.onLetter(''); }
}
function yearParts(y) {      /* [[part, how]]: how 'n' (a number), 'z' (sliding 0), 'zl' (longer sliding 0) */
  y = Math.floor(+y); if (!(y >= 1000 && y <= 2099)) return null;
  const a = Math.floor(y / 100), b = y % 100;
  if (y >= 2000 && y <= 2009) return b ? [[2, 'n'], [0, 'z'], [b, 'n']] : [[2, 'n'], [0, 'zl']];
  if (y >= 2010) return [[20, 'n'], [b, 'n']];
  if (b === 0) return [[a, 'n'], [0, 'z']];
  if (b < 10) return [[a, 'n'], [0, 'n'], [b, 'n']];
  return [[a, 'n'], [b, 'n']];
}
async function signYear(y, o) {
  o = o || {};
  const parts = yearParts(y); if (!parts) return;
  for (let k = 0; k < parts.length; k++) {
    if (o.stop && o.stop()) break;
    const [n, how] = parts[k], last = k === parts.length - 1;
    if (o.onPart) o.onPart(k);
    if (how !== 'n') { await zeroSlide(o, how === 'zl', last); continue; }
    await sign(n, Object.assign({}, o, { teens: 'ten', stay: !last, series: true }));      /* 1-5 palm out inside a year; 16-19 always 10 + number */
  }
  if (o.onPart) o.onPart(-1);
}
/* every pair of still letters (and rest) was planned ahead of time (PRE_PLANS, made with planMove); load them so words start right away.
   Pairs not listed need no dodge. Anything else (doubles, habits) is planned the first time it comes up. */
(function preload() {
  const L = 'ABCDEFGHIKLMNOPQRSTUVWXY'.split('').concat(['rest']);
  L.forEach(a => L.forEach(b => { if (a !== b) PLANS.set(planKey(norm(POSE[a]), norm(POSE[b])), PRE_PLANS[a + '>' + b] || null); }));
})();
/* every letter as a still picture, to review the whole alphabet at once; tap one to see it move */
/* the alphabet chart: every letter framed the same way on its own card, with motion arrows for J and Z; tap a card to see it move; printable */
function chartImage(still) {
  if (H2) H2.mirror.visible = false;      /* stills show the signing hand only */
  try { return chartShot(still); } finally { if (H2) H2.mirror.visible = helperOn; }
}
function chartShot(still) {
  apply(Object.assign({ w: [0, 0, 0], p: [0, 0] }, norm(still), { q: null })); scene.updateMatrixWorld(true);
  const box = new THREE.Box3(); Object.values(H.bones).forEach(b => box.expandByPoint(b.getWorldPosition(new THREE.Vector3())));
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), r = Math.max(size.x, size.y) * 0.5 + 0.025;      /* room around the hand, so nothing is cut off */
  const keep = cam.position.clone(); cam.position.set(c.x, c.y - 0.006, c.z + r / Math.tan(15 * Math.PI / 180) * 1.06); cam.lookAt(c);
  const url = snap(); cam.position.copy(keep); camFor(helperOn); return url;
}
const ARROW = {      /* drawn over the card, as the student sees the movement */
  J: '<path d="M30 18 C 30 60, 34 80, 55 82 C 70 83, 78 72, 80 62" />',
  Z: '<path d="M78 20 L 24 20 L 76 56 L 22 56" />'
};
const snap = () => { renderer.render(scene, cam); return renderer.domElement.toDataURL(); };
const letterStill = c => { const P0 = POSE[c]; return Array.isArray(P0) ? P0[0] : P0; };
if (opts.debug) window.__hand = { get H() { return H; }, get H2() { return H2; }, apply, snap, scene, cam, POSE, norm, moveTo, NUM, SH, helperMove, withHand };      /* dev pages only: lets the review tools reach the joints */
return { ready, spell, sign, signParts, signYear, yearParts, helper, numberImage: n => chartImage(NUM[n].start), setTone, TONES, dealTone, chartImage: c => chartImage(letterStill(c)), letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', get tone() { return toneNow; } };
}
window.FSHand = { create };
})();
