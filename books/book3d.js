/* A horizontally opening pop-up book in real 3D (three.js).
   The book lies on a desk with its spine running away from the reader. The right half stays on the desk; the left page
   turns about the spine. A spread is drawn for an opening angle θ between its two pages (0 = closed, 180 = flat):

   - V-folds ('v') sit across the gutter. Each half is glued to its page along a line at angle σ to the spine's normal;
     the crease is perpendicular to both glue lines, so the geometry is exact for any θ and folds flat when the book closes.
     σ < 0 puts the crease toward the reader (it folds forward), σ > 0 puts it away.
   - Standing pieces ('stand') sit on one page and rise about their base line as the book opens.
   - 'custom' pieces get their pose from the book (bascules, moving parts); 'card' pieces are lift-up flaps or lids.
   - 'box' pieces are folded paper boxes (front, back, sides, roof) that rise with the page; 'zigzag' is a W-fold whose
     panels stand up and fan out as it unfolds (s.u = 0 … 1).

   Turning a page starts like a real book: the bottom corner curls up first (a cylinder curl in the page's own
   coordinates), then the page swings over. Pieces near the corner ride the curl rigidly, using the curled frame at
   their base point. Hovering a bottom corner lifts it a little, and clicking it turns the page.

   Pieces can also be handled directly, the way a real pop-up is: a piece with drag: tabId slides when you drag it
   (driving that pull-tab), and a piece with dial: (deg, ctx) => … turns like a wheel or clock hand when you drag
   around it. Pull-tabs run in a slot cut into the page; a tab can be hidden and driven only through its piece.

   Paper rules the engine keeps to, so every piece could be made from card:
   - A piece standing on one page and facing the reader is hinged at its base and falls forward (toward the reader)
     as the book closes. A strut hidden behind it runs to the opposite page and pulls it up as the book opens; the
     linkage runs under the page, out of sight (drawn only with def.showStrut). Its far end sits where a fixed-length
     strip works both open and closed (Zq = Zb − 2·|X|·dq/s).
   - A wall standing roughly parallel to the spine falls away from the spine; it is tied to the backdrop fold.
   - The side fin of a cross piece is creased at the slot and folds flat against the main plane.
   - Small parts (clock hands, a wheel, a sign) are riveted or hinged to a parent piece: their pose is given in the
     parent's own frame (def.parent, x along its base, y up its face, z out of its face), so they fold with it.
   - Turning the page puts pull-tabs back and closes flaps first, as you would before closing a real book.

   Moving pieces ease toward their target position. A piece with follow: id unfolds when that card opens.

   Book content works in flat-world units: X from -100 (left edge) to 100 (right edge), Z from -65 (far edge) to
   65 (near edge), Y up; 1u = 1% of a page's width. A piece on the left page rides with that page as it turns. */
import * as THREE from 'three';

const U = 0.01, PW = 100, PD = 130;
const BT = 0.012, T = 0.042;              // board thickness, page surface height above the desk
const PX = 12, FLOOR_PX = 10;             // texture pixels per unit
// texture resolution scale: phones drop a step (createReader sets it), which roughly halves texture memory
let Q = 1;
// longest side a piece texture may have (a budget can lower it); wider art is drawn at a lower scale instead
let MAX_TEX = Infinity;
// plain paper backs are only grain, so a budget prints them at half size (a quarter of the memory)
let BACK_K = 1;
const artScale = a => Q * Math.min(1, MAX_TEX / (Math.max(a.w, a.h) * PX * Q));
const rad = d => d * Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export const LIGHTS = {
  morning:   {dir: '#fff3e2', di: 2.6, hemi: .7,  sky: '#fff6e8', exp: 1.0},
  afternoon: {dir: '#fff0d8', di: 2.4, hemi: .62, sky: '#fff3e0', exp: 1.0},
  golden:    {dir: '#ffb766', di: 2.8, hemi: .42, sky: '#ffd29a', exp: 1.0},
  evening:   {dir: '#ffad6e', di: 1.15, hemi: .52, sky: '#d7c8d4', exp: .95},
  night:     {dir: '#b0bdff', di: 1.5, hemi: .7, sky: '#8a98d0', exp: 1.15},
};

/* ---------- textures ---------- */
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
function loadSVG(svg) {
  const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => { URL.revokeObjectURL(url); res(i); }; i.onerror = rej; i.src = url; });
}
let maxAniso = 4;
// one double-sided material for a piece: the art on the front face and, chosen per pixel, the back (a texture, or a
// plain colour for the inside of a box) on the other, so each piece costs one draw call instead of two
function twoFaced(map, back, roughness = .9) {
  const m = new THREE.MeshStandardMaterial({map, alphaTest: .5, roughness, side: THREE.DoubleSide}), isTex = !!(back && back.isTexture);
  m.userData.backMap = isTex ? back : null;
  m.onBeforeCompile = sh => {
    sh.uniforms.backMap = {value: isTex ? back : null}; sh.uniforms.backColor = {value: new THREE.Color(isTex ? '#ffffff' : back)};
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `uniform ${isTex ? 'sampler2D backMap' : 'vec3 backColor'};\nvoid main() {`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  if ( !gl_FrontFacing ) sampledDiffuseColor = ${isTex ? 'texture2D( backMap, vMapUv )' : 'vec4( backColor, sampledDiffuseColor.a )'};
  diffuseColor *= sampledDiffuseColor;
#endif`).replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
  vec4 emissiveColor = gl_FrontFacing ? texture2D( emissiveMap, vEmissiveMapUv ) : ${isTex ? 'texture2D( backMap, vEmissiveMapUv )' : 'vec4( backColor, 1.0 )'};
  totalEmissiveRadiance *= emissiveColor.rgb;
#endif`);
  };
  m.customProgramCacheKey = () => isTex ? 'twoFacedMap' : 'twoFacedColor';
  return m;
}
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; }
// a faint paper grain, shared by every back: warm white with a few darker fibres
let grainCanvas;
function paperGrain() {
  if (grainCanvas) return grainCanvas;
  const c = grainCanvas = canvasOf(256, 256), x = c.getContext('2d'), img = x.createImageData(256, 256);
  let s = 7; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < img.data.length; i += 4) { const v = 236 + (r() - .5) * 14; img.data[i] = v + 4; img.data[i + 1] = v - 3; img.data[i + 2] = v - 18; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(150,120,80,${.05 + r() * .07})`; x.lineWidth = .6; x.beginPath(); const X = r() * 256, Y = r() * 256; x.moveTo(X, Y); x.quadraticCurveTo(X + (r() - .5) * 20, Y + (r() - .5) * 20, X + (r() - .5) * 30, Y + (r() - .5) * 30); x.stroke(); }
  return c;
}
// the plain back of a piece: its silhouette in grained warm-white card
function backOf(src) {
  const c = canvasOf(src.width * BACK_K, src.height * BACK_K), x = c.getContext('2d');
  x.drawImage(src, 0, 0, c.width, c.height); x.globalCompositeOperation = 'source-in'; x.fillStyle = x.createPattern(paperGrain(), 'repeat'); x.fillRect(0, 0, c.width, c.height);
  return c;
}
function fill(src, color) {
  const c = canvasOf(src.width, src.height), x = c.getContext('2d');
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}
function alphaMask(c) {
  const w = Math.max(1, c.width >> 2), h = Math.max(1, c.height >> 2), s = canvasOf(w, h), x = s.getContext('2d', {willReadFrequently: true});
  x.drawImage(c, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
  return {w, h, a, at: (u, v) => a[clamp(Math.floor((1 - v) * h), 0, h - 1) * w + clamp(Math.floor(u * w), 0, w - 1)]};
}
// die-cut piece: the art with a thin paper border, a plain paper back, and a hit mask
async function pieceTextures(a, need = {}) {
  const q = artScale(a), w = a.w * PX * q, h = a.h * PX * q, img = await loadSVG(a.svg);
  const c = canvasOf(w, h); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const sil = fill(c, a.edgeColor || '#fbf7ee'), f = canvasOf(w, h), x = f.getContext('2d');
  for (const r of [1.6 * q, 3.4 * q]) for (let k = 0; k < 12; k++) x.drawImage(sil, r * Math.cos(k * Math.PI / 6), r * Math.sin(k * Math.PI / 6));
  x.drawImage(c, 0, 0);
  // printed on both sides: the back shows the same picture, flipped so it reads correctly from behind
  let printedBack = null;
  if (need.printed) { const m = canvasOf(w, h), mx = m.getContext('2d'); mx.translate(m.width, 0); mx.scale(-1, 1); mx.drawImage(f, 0, 0); printedBack = tex(m); }
  return {front: tex(f), back: need.plainBack === false ? null : tex(backOf(f)), printedBack, mask: alphaMask(f)};
}
async function plainTexture(a) {
  const q = artScale(a), img = await loadSVG(a.svg), c = canvasOf(a.w * PX * q, a.h * PX * q);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return tex(c);
}
// floor art covers the whole spread (2000 × 1300 px); returns [left, right] textures with gutter shading
async function floorTextures(svg, texts = [], creases = []) {
  const img = await loadSVG(svg), W = Math.round(2 * PW * FLOOR_PX * Q), H = Math.round(PD * FLOOR_PX * Q);
  const full = canvasOf(W, H), x = full.getContext('2d');
  x.drawImage(img, 0, 0, W, H);
  x.scale(Q, Q);                           // creases and texts are laid out in full-resolution floor pixels
  // creases: a soft shadow where the card meets the page, a dark score line and a lighter lip beside it
  const px = ([X, Z]) => [(X + PW) * FLOOR_PX, (Z + PD / 2) * FLOOR_PX];
  for (const [a, b] of creases) {
    const [x1, y1] = px(a), [x2, y2] = px(b);
    const line = (w, style, dx = 0, dy = 0, blur = 0) => { x.save(); x.strokeStyle = style; x.lineWidth = w; x.lineCap = 'round';
      if (blur) { x.shadowColor = style; x.shadowBlur = blur; } x.beginPath(); x.moveTo(x1 + dx, y1 + dy); x.lineTo(x2 + dx, y2 + dy); x.stroke(); x.restore(); };
    line(7, 'rgba(40,25,10,.10)', 0, 0, 8); line(1.8, 'rgba(60,40,20,.42)'); line(1.2, 'rgba(255,250,235,.35)', 1.2, 1.6);
  }
  for (const t of texts) {
    x.save(); x.font = t.font; x.fillStyle = t.color || '#3a3129'; x.textAlign = t.align || 'left';
    if ('letterSpacing' in x) x.letterSpacing = (t.ls || 0) + 'px';
    x.translate(t.x, t.y); if (t.rot) x.rotate(t.rot);
    // maxWidth squeezes a line that would run past its frame
    t.maxWidth ? x.fillText(t.text, 0, 0, t.maxWidth) : x.fillText(t.text, 0, 0); x.restore();
  }
  return [0, 1].map(k => {
    const c = canvasOf(W / 2, H), y = c.getContext('2d');
    y.drawImage(full, k * W / 2, 0, W / 2, H, 0, 0, W / 2, H);
    const g = y.createLinearGradient(k ? 0 : W / 2, 0, k ? 90 * Q : W / 2 - 90 * Q, 0);
    g.addColorStop(0, 'rgba(70,45,20,.28)'); g.addColorStop(1, 'rgba(70,45,20,0)');
    y.fillStyle = g; y.fillRect(0, 0, W / 2, H);
    return tex(c);
  });
}

/* ---------- procedural materials for the desk and the book ---------- */
function woodTexture() {
  // drawn at 1024 and, under a budget, kept at 512: it repeats across the desk, so the grain only gets softer
  const c = canvasOf(1024, 1024), x = c.getContext('2d');
  x.fillStyle = '#6a4329'; x.fillRect(0, 0, 1024, 1024);
  let s = 3; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 260; i++) {
    const y = r() * 1024, a = .04 + r() * .1;
    x.strokeStyle = r() < .5 ? `rgba(40,22,10,${a})` : `rgba(160,110,70,${a})`;
    x.lineWidth = 1 + r() * 5; x.beginPath(); x.moveTo(0, y);
    for (let X = 0; X <= 1024; X += 64) x.lineTo(X, y + Math.sin(X / 140 + i) * 6 + (r() - .5) * 3);
    x.stroke();
  }
  for (let i = 0; i < 9; i++) { const y = r() * 1024; x.fillStyle = 'rgba(30,15,6,.10)'; x.fillRect(0, y, 1024, 2); }
  let out = c;
  if (BACK_K < 1) { out = canvasOf(512, 512); out.getContext('2d').drawImage(c, 0, 0, 512, 512); }
  const t = tex(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
}
function clothTexture(color) {
  const c = canvasOf(256, 256), x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) { x.fillStyle = `rgba(255,255,255,${i % 4 ? .03 : .06})`; x.fillRect(i, 0, 1, 256); x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(0, i, 256, 1); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 5); return t;
}
function edgeTexture() {
  const c = canvasOf(64, 256), x = c.getContext('2d');
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 256; i += 3) { x.fillStyle = `rgba(120,95,60,${.08 + (i % 7) * .015})`; x.fillRect(0, i, 64, 1); }
  return tex(c);
}

// where each piece is glued and folds: [[X1, Z1], [X2, Z2]] in flat-world units. Pieces that slide, ride on another
// piece or sit above the page (def.Y) have no fixed crease on the page.
function creaseLines(pieces) {
  const out = [];
  for (const d of pieces) {
    if (d.parent || d.drag || d.noCrease || Math.abs(d.Y || 0) > .3) continue;
    if (d.type === 'stand' || d.type === 'box') {
      const w = (d.type === 'box' ? d.w : d.w ?? d.art.w) / 2, y = rad(d.yaw || 0), ex = [Math.cos(y), -Math.sin(y)];
      if (d.type === 'box') { const dz = d.d / 2, ez = [Math.sin(y), Math.cos(y)];
        for (const sgn of [-1, 1]) out.push([[d.X - ex[0] * w + ez[0] * dz * sgn, d.Z - ex[1] * w + ez[1] * dz * sgn], [d.X + ex[0] * w + ez[0] * dz * sgn, d.Z + ex[1] * w + ez[1] * dz * sgn]]); }
      else out.push([[d.X - ex[0] * w, d.Z - ex[1] * w], [d.X + ex[0] * w, d.Z + ex[1] * w]]);
    } else if (d.type === 'v') {
      const sg = rad(d.sigma);
      for (const [sx, half] of [[-1, d.wl], [1, d.wr]]) out.push([[0, d.Z], [sx * Math.cos(sg) * half, d.Z + Math.sin(sg) * half]]);
    }
  }
  return out;
}

/* ---------- page curl ----------
   In page coordinates (u = distance from the spine 0…100, z along the spine, near edge at z = +65) the paper past a
   fold line near the bottom outer corner rolls onto a cylinder of radius CURL_R, lifting toward the page's top side.
   q = 0 … 1 is how far the corner has been lifted. Returns null for points the curl doesn't reach. */
const CURL_GAMMA = rad(34), CEU = Math.cos(CURL_GAMMA), CEZ = Math.sin(CURL_GAMMA), CURL_R = 9;
function curl(u, z, q) {
  if (q <= .001) return null;
  const s = 40 * q, d = (u - (PW - CEU * s)) * CEU + (z - (PD / 2 - CEZ * s)) * CEZ;
  if (d <= 0) return null;
  const amax = rad(115) * Math.min(1, q * 1.15);
  let a = d / CURL_R, p, h;
  if (a <= amax) { p = CURL_R * Math.sin(a); h = CURL_R * (1 - Math.cos(a)); }
  else { a = amax; p = CURL_R * Math.sin(a) + (d - CURL_R * a) * Math.cos(a); h = CURL_R * (1 - Math.cos(a)) + (d - CURL_R * a) * Math.sin(a); }
  return {u: u - CEU * (d - p), z: z - CEZ * (d - p), h, a};
}
// how a vector (vu, vy, vz) in page coordinates turns where the paper has curled by angle a
function curlVec(a, vu, vy, vz) {
  const ve = vu * CEU + vz * CEZ, vl = -vu * CEZ + vz * CEU, te = ve * Math.cos(a) - vy * Math.sin(a);
  return [CEU * te - CEZ * vl, ve * Math.sin(a) + vy * Math.cos(a), CEZ * te + CEU * vl];
}
export const CORNER = {u: 84, z: 46};        // the bottom corner hot zone, in page coordinates

/* ---------- geometry helpers ---------- */
function planeGeo(x0, x1, y0, y1, u0 = 0, u1 = 1) {
  const g = new THREE.PlaneGeometry((x1 - x0) * U, (y1 - y0) * U);
  g.translate((x0 + x1) / 2 * U, (y0 + y1) / 2 * U, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
  return g;
}
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _m = new THREE.Matrix4(), _z = V3();

/* ---------- one spread ---------- */
class Spread {
  constructor(engine, def, index) { this.e = engine; this.def = def; this.index = index; this.lit = this.litTarget = def.lit || 0; }

  async build() {
    if (this.ready) return this.ready;
    return this.ready = this._build();
  }
  async _build() {
    const d = this.def, g = this.group = new THREE.Group();
    g.position.set(0, T, 0); g.visible = false;
    this.left = new THREE.Group(); g.add(this.left);
    const [lt, rt] = await floorTextures(d.floor.svg, d.texts, creaseLines(d.pieces));
    // pages are subdivided so the corner can curl; each side keeps its flat vertex positions to deform from
    const pageGeo = sign => { const q = new THREE.PlaneGeometry(PW * U, PD * U, 30, 39).rotateX(-Math.PI / 2).translate(sign * PW / 2 * U, 0, 0);
      q.userData.base = q.attributes.position.array.slice(); return q; };
    this.geo = {L: pageGeo(-1), R: pageGeo(1)};
    const pageMat = map => new THREE.MeshStandardMaterial({map, roughness: .95});
    const grainTex = tex(paperGrain()); grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.repeat.set(3, 4);
    const backMat = new THREE.MeshStandardMaterial({map: grainTex, roughness: .95, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2});
    const lp = new THREE.Mesh(this.geo.L, pageMat(lt)); lp.position.set(0, .0004, 0); lp.receiveShadow = true; lp.castShadow = true; this.left.add(lp);
    const rp = new THREE.Mesh(this.geo.R, pageMat(rt)); rp.position.set(0, .0004, 0); rp.receiveShadow = true; rp.castShadow = true; g.add(rp);
    const lb = new THREE.Mesh(this.geo.L, backMat); lb.position.copy(lp.position); this.left.add(lb);
    const rb = new THREE.Mesh(this.geo.R, backMat); rb.position.copy(rp.position); g.add(rb);
    this.pages = {L: lp, R: rp};
    this.peelSide = 'R'; this.peelQ = 0; this.peelTarget = 0; this.peelKey = '';
    if (d.floorLit) {
      const [ll, rl] = await floorTextures(d.floorLit.svg);
      const litMat = map => new THREE.MeshBasicMaterial({map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending});
      const a = new THREE.Mesh(this.geo.L, litMat(ll)); a.position.copy(lp.position).y += .0004; this.left.add(a);
      const b = new THREE.Mesh(this.geo.R, litMat(rl)); b.position.copy(rp.position).y += .0004; g.add(b);
      this.floorLit = [a, b];
    }
    this.pieces = []; this.byId = {}; this.pick = []; this.tabs = [];
    await Promise.all(d.pieces.map(def => this.addPiece(def)));
    for (const c of d.controls || []) await this.addTab(c);
    for (const c of d.controls || []) this.applyTab(c.id, c.init || 0);
    this.e.scene.add(g);
    this.built = true;
  }

  // free everything this spread put on the GPU; build() makes it again when it is needed
  dispose() {
    if (!this.built) return;
    const seen = new Set(), free = o => { if (o && !seen.has(o)) { seen.add(o); o.dispose(); } };
    this.group.traverse(o => {
      if (o.geometry) free(o.geometry);
      for (const m of [].concat(o.material || [])) { for (const k of ['map', 'emissiveMap', 'alphaMap']) free(m[k]); free(m.userData.backMap); free(m); }
    });
    this.e.scene.remove(this.group);
    this.group = this.left = this.pages = this.floorLit = null;
    this.pieces = []; this.byId = {}; this.pick = []; this.tabs = []; this.flags = {};
    this.built = false; this.ready = null; this.touched = new Set();
  }

  async addPiece(def) {
    const p = {def, s: {...def}, parts: [], hop: 0, open: 0};
    this.pieces.push(p); if (def.id) this.byId[def.id] = p;
    if (def.type === 'box') return this.addBox(p, def);
    const tx = await pieceTextures(def.art, {printed: !!(def.cross || def.twoSided), plainBack: !(def.artBack || def.cross || def.twoSided)}), lit = def.artLit ? await plainTexture(def.artLit) : null;
    // a cross piece's fin shows both faces as you walk round it, so it is printed on both sides (as a real one would be)
    const backMap = def.artBack ? await plainTexture(def.artBack) : (def.cross || def.twoSided) ? tx.printedBack : tx.back;
    const front = twoFaced(tx.front, backMap);
    const litMat = lit && new THREE.MeshBasicMaterial({map: lit, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4});
    const w = def.w ?? def.art.w, h = def.h ?? def.art.h;
    const part = geo => {
      const f = new THREE.Mesh(geo, front);
      f.castShadow = true; f.receiveShadow = true;
      const pt = {front: f, back: null, lit: litMat ? new THREE.Mesh(geo, litMat) : null};
      for (const m of [f, pt.lit]) if (m) { m.matrixAutoUpdate = false; this.group.add(m); }
      // solidHit: the whole rectangle is tappable, not just the painted pixels (a wheel with gaps between its spokes)
      f.userData = {piece: p, mask: def.solidHit ? null : tx.mask};
      if (def.tap || def.drag || def.dial || def.type === 'card') this.pick.push(f);
      p.parts.push(pt); return pt;
    };
    if (def.type === 'v') {
      const wl = def.wl, wr = def.wr, k = wl / (wl + wr);
      part(planeGeo(-wl, 0, 0, h, 0, k)); part(planeGeo(0, wr, 0, h, k, 1));
    } else if (def.type === 'card') {
      part(planeGeo(-def.w / 2, def.w / 2, 0, def.h));
    } else if (def.type === 'zigzag') {
      for (let k = 0; k < def.n; k++) part(planeGeo(0, def.pw, 0, h, k / def.n, (k + 1) / def.n));
    } else if (def.type === 'custom') {
      const a = def.anchor || 'bottom';
      part(a === 'left' ? planeGeo(0, w, 0, h) : a === 'right' ? planeGeo(-w, 0, 0, h) : a === 'center' ? planeGeo(-w / 2, w / 2, -h / 2, h / 2) : planeGeo(-w / 2, w / 2, 0, h));
    } else {
      part(planeGeo(-w / 2, w / 2, 0, h));
      if (def.cross) part(planeGeo(-def.cross / 2, def.cross / 2, 0, h, (1 - def.cross / w) / 2, (1 + def.cross / w) / 2));
    }
    p.mats = {front, litMat}; p.hl = [front];
  }
  async addBox(p, def) {
    const f = def.faces, w = def.w, d = def.d, h = def.h;
    for (const [k, fw, fh] of [['front', w, h], ['back', w, h], ['left', d, h], ['right', d, h], ['top', w, d]]) {
      if (!f[k]) { p.parts.push(null); continue; }
      const tx = await pieceTextures(f[k]), geo = planeGeo(-fw / 2, fw / 2, 0, fh);
      const fr = new THREE.Mesh(geo, twoFaced(tx.front, def.inside || '#e9dfc8'));
      fr.castShadow = true; fr.receiveShadow = true; fr.matrixAutoUpdate = false; this.group.add(fr);
      fr.userData = {piece: p, mask: tx.mask};
      if (def.tap || def.drag) this.pick.push(fr);
      p.parts.push({front: fr, back: null, lit: null}); (p.hl = p.hl || []).push(fr.material);
    }
    p.mats = {};
  }

  async addTab(c) {
    if (c.hidden) { this.tabs.push({c, v: c.init || 0}); return; }
    const art = this.e.tabArt(c), t = await plainTexture(art);
    const m = new THREE.Mesh(planeGeo(-art.w / 2, art.w / 2, -art.h / 2, art.h / 2),
      new THREE.MeshStandardMaterial({map: t, roughness: .8, alphaTest: .5, side: THREE.DoubleSide}));
    m.matrixAutoUpdate = false; m.castShadow = true; m.userData = {tab: c};
    // the slot the tab slides in, so you can see which way it goes
    const sw = (c.slotW ?? 1.1) / 2, L = c.len + art.h * .6, slot = new THREE.Mesh(planeGeo(-sw, sw, -art.h * .3, L - art.h * .3),
      new THREE.MeshStandardMaterial({color: '#241a12', roughness: 1, transparent: true, opacity: .78, depthWrite: false}));
    slot.matrixAutoUpdate = false;
    this.group.add(m, slot); this.tabs.push({c, mesh: m, slot, v: c.init || 0});
  }
  dirty() {
    return this.tabs.some(t => Math.abs(t.v - (t.c.init || 0)) > .01) || this.pieces.some(p => p.s.opened) || Math.abs((this.litTarget || 0) - (this.def.lit || 0)) > .01;
  }
  reset() {
    this.flags = {};
    for (const p of this.pieces) { p.s.opened = false; p.hop = 0; }
    for (const t of this.tabs) this.applyTab(t.c.id, t.c.init || 0);
    this.litTarget = this.def.lit || 0;
  }
  applyTab(id, v) {
    const t = this.tabs.find(t => t.c.id === id); if (!t) return;
    t.v = clamp(v, 0, 1); if (t.c.apply) t.c.apply(t.v, this.e.ctx(this));
  }

  /* Things you can play with glow softly when the page opens, and again after a while with nothing touched.
     Anything you have already played with stops glowing. */
  hint(dt) {
    if (!this.hinting) return;
    this.age = (this.age || 0) + dt; this.idle = (this.idle || 0) + dt;
    const pulse = t => t > 0 && t < 2.4 ? Math.pow(Math.sin(t / 2.4 * Math.PI * 2), 2) : 0;
    const k = .55 * Math.max(pulse(this.age - .8), this.idle > 12 ? pulse((this.idle - 12) % 14) : 0);
    const glow = (mat, on) => { if (!mat) return; if (!mat.emissiveMap && mat.map) { mat.emissiveMap = mat.map; mat.emissive.set('#ffcf6a'); mat.needsUpdate = true; } mat.emissiveIntensity = on ? k : 0; };
    // a spread's signature move (def.signature: a piece id) glows on its own until it has been played with
    const sig = this.def.signature && this.byId[this.def.signature], sigTab = sig && sig.def.drag && this.tabs.find(t => t.c.id === sig.def.drag);
    const only = sig && !this.touched.has(sig) ? new Set([sig, sigTab]) : null;
    for (const p of this.pieces) if (p.hl && (p.def.tap || p.def.drag || p.def.dial || p.def.type === 'card')) p.hl.forEach(m => glow(m, !this.touched.has(p) && (!only || only.has(p))));
    for (const t of this.tabs) if (t.mesh) glow(t.mesh.material, !this.touched.has(t) && (!only || only.has(t)));
  }
  startHints() { this.hinting = true; this.age = 0; this.idle = 0; this.touched = this.touched || new Set(); }
  stopHints() { this.age = 99; this.hint(0); this.hinting = false; }
  touch(x) { if (this.touched) { this.touched.add(x); this.idle = 0; } }

  // page frame for opening angle θ
  frame(theta) {
    const t = rad(theta);
    this.uL = V3(Math.cos(t), Math.sin(t), 0); this.nL = V3(Math.sin(t), -Math.cos(t), 0);
  }
  // page coordinates (u from the spine, y off the page, z) → spread-local vector
  fromPage(side, u, y, z) { return side === 'L' ? V3().addScaledVector(this.uL, u).addScaledVector(this.nL, y).add(V3(0, 0, z)) : V3(u, y, z); }
  // a piece is placed rigidly in the page frame at its base point; if that point is on the curled corner, the frame curls
  anchor(side, X, Z) {
    const u = side === 'L' ? -X : X, c = this.peelSide === side ? curl(u, Z, this.peelQ) : null;
    this.anc = c ? {side, u, z: Z, c} : null;
  }
  bend(side, vu, vy, vz) { const A = this.anc; return A && A.side === side ? curlVec(A.c.a, vu, vy, vz) : [vu, vy, vz]; }
  // flat-world direction (X, Y, Z) on page side → spread-local direction (no scaling)
  map(side, X, Y, Z) { return this.fromPage(side, ...this.bend(side, side === 'L' ? -X : X, Y, Z)); }
  // flat-world point → spread-local point in scene units
  pt(side, X, Y, Z) {
    const v = this.map(side, X, Y, Z), A = this.anc;
    if (A && A.side === side) { const [bu, by, bz] = this.bend(side, A.u, 0, A.z); v.add(this.fromPage(side, A.c.u - bu, A.c.h - by, A.c.z - bz)); }
    return v.multiplyScalar(U);
  }
  // deform the page meshes for the current curl
  drawPeel() {
    const key = this.peelQ > .001 ? this.peelSide + this.peelQ.toFixed(4) : '';
    if (key === this.peelKey) return;
    for (const side of ['L', 'R']) {
      if (!(this.peelKey[0] === side || key[0] === side)) continue;
      const g = this.geo[side], pos = g.attributes.position.array, base = g.userData.base, on = key[0] === side, sg = side === 'L' ? -1 : 1;
      for (let i = 0; i < pos.length; i += 3) {
        const c = on ? curl(sg * base[i] / U, base[i + 2] / U, this.peelQ) : null;
        if (c) { pos[i] = sg * c.u * U; pos[i + 1] = base[i + 1] + c.h * U; pos[i + 2] = c.z * U; }
        else { pos[i] = base[i]; pos[i + 1] = base[i + 1]; pos[i + 2] = base[i + 2]; }
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
    }
    this.peelKey = key;
  }
  // which page and where on it, for a ray hit on a page mesh; uses the texture coordinates, so it is the flat-paper
  // position even while the corner is curled
  pageHit(h) {
    const side = h.object === this.pages.L ? 'L' : 'R';
    return {side, u: (side === 'L' ? 1 - h.uv.x : h.uv.x) * PW, z: (.5 - h.uv.y) * PD};
  }
  place(pt, o, ex, ey, show = true) {
    _z.crossVectors(ex, ey).normalize(); _m.makeBasis(ex, ey, _z).setPosition(o);
    // a light layer that is off isn't drawn at all (a transparent mesh at opacity 0 still costs a draw call)
    for (const m of [pt.front, pt.back, pt.lit]) if (m) { m.matrix.copy(_m); m.matrixWorldNeedsUpdate = true; m.visible = show && (m !== pt.lit || m.material.opacity > .004); }
  }

  update(theta, flip, dt) {
    const g = this.group;
    g.rotation.z = flip ? rad(180 - theta) : 0;
    this.left.rotation.z = rad(theta - 180);
    this.frame(theta);
    this.drawPeel();
    const rise = smooth(clamp((theta - 100) / 75, 0, 1)), shown = theta > 1.5;
    this.lit = lerp(this.lit, this.litTarget, 1 - Math.exp(-dt * 4));
    if (this.floorLit) this.floorLit.forEach(m => { m.material.opacity = this.lit; m.visible = this.lit > .004; });
    this.hint(dt);
    for (const p of this.pieces) if (p.flash > 0) { p.flash = Math.max(0, p.flash - dt * 1.6);
      const v = Math.sin(p.flash * Math.PI) * .6;
      (p.hl || []).forEach(m => { if (!m.emissiveMap && m.map) { m.emissiveMap = m.map; m.emissive.set('#ffcf6a'); m.needsUpdate = true; } m.emissiveIntensity = this.hinting && this.age < 4 ? Math.max(m.emissiveIntensity || 0, v) : v; }); }
    for (const p of this.pieces) {
      const s = p.s, d = p.def;
      p.hop = Math.max(0, p.hop - dt / .45);
      p.open = lerp(p.open, s.opened ? 1 : 0, 1 - Math.exp(-dt * (d.speed || 7)));
      if (d.follow && this.byId[d.follow]) { const dl = d.delay || 0; s.u = smooth(clamp((this.byId[d.follow].open - dl) / (1 - dl), 0, 1)); }
      if (d.tick) d.tick(s, dt, this.e.ctx(this), p);
      this.ease(p, dt);
      this.anc = null;
      // a piece with its own light (def.ownLight) glows when s.on, independent of the page's lights
      if (d.ownLight) p.glow = lerp(p.glow || 0, s.on ? 1 : 0, 1 - Math.exp(-dt * 4));
      if (p.mats.litMat) p.mats.litMat.opacity = d.ownLight ? p.glow : this.lit;
      if (d.type === 'v') this.updateV(p, theta, shown);
      else if (d.type === 'card') this.updateCard(p, shown);
      else if (d.type === 'custom') this.updateCustom(p, rise, shown);
      else if (d.type === 'box') this.updateBox(p, rise, shown);
      else if (d.type === 'zigzag') this.updateZigzag(p, rise, shown);
      else this.updateStand(p, rise, shown);
    }
    for (const t of this.tabs) {
      if (!t.mesh) continue;
      const c = t.c, side = c.X < 0 ? 'L' : 'R', dir = c.dir || [0, 0, 1];
      this.anchor(side, c.X, c.Z);
      const o = this.pt(side, c.X + dir[0] * c.len * t.v, .3, c.Z + dir[2] * c.len * t.v);
      const up = this.map(side, 0, 1, 0), ey = this.map(side, -dir[0], 0, -dir[2]).normalize(), ex = V3().crossVectors(ey, up);
      _m.makeBasis(ex, ey, up).setPosition(o); t.mesh.matrix.copy(_m); t.mesh.matrixWorldNeedsUpdate = true;
      t.mesh.visible = shown && theta > 150;
      const along = ey.clone().negate();
      _m.makeBasis(V3().crossVectors(along, up), along, up).setPosition(this.pt(side, c.X, .08, c.Z));
      t.slot.matrix.copy(_m); t.slot.matrixWorldNeedsUpdate = true; t.slot.visible = t.mesh.visible;
    }
  }
  // pieces glide to where the book puts them; bob/rock make the motion read as rolling or walking
  ease(p, dt) {
    const s = p.s, d = p.def, tgt = {X: s.X || 0, Y: s.Y || 0, Z: s.Z || 0, raise: s.raise ?? 1, tilt: s.tilt || 0};
    if (!p.cur) { p.cur = {...tgt}; p.phase = 0; p.moving = 0; return; }
    const k = 1 - Math.exp(-dt * (d.ease || 9)), x0 = p.cur.X, z0 = p.cur.Z;
    for (const key in tgt) p.cur[key] = lerp(p.cur[key], tgt[key], k);
    const dist = Math.hypot(p.cur.X - x0, p.cur.Z - z0), speed = dt > 0 ? dist / dt : 0;
    p.phase += dist * (d.stride || .5);
    p.moving = lerp(p.moving, clamp(speed / 6, 0, 1), 1 - Math.exp(-dt * 8));
  }
  bob(p) { const d = p.def; return d.bob ? Math.abs(Math.sin(p.phase)) * d.bob * p.moving : 0; }
  rock(p) { const d = p.def; return p.cur.tilt + (d.rock ? Math.sin(p.phase) * d.rock * p.moving : 0); }
  updateV(p, theta, shown) {
    const s = p.s, sg = rad(s.sigma), cs = Math.cos(sg), sn = Math.sin(sg);
    const gL = this.uL.clone().multiplyScalar(cs).add(V3(0, 0, sn)), gR = V3(cs, 0, sn);
    const c = V3().crossVectors(gL, gR), len = c.length();
    const ok = shown && len > 1e-4;
    if (ok) c.divideScalar(len).multiplyScalar(Math.sign(sg) || 1);
    const o = V3(0, 0, s.Z * U).addScaledVector(c, (s.lift || 0) * U);
    this.place(p.parts[0], o, gL.clone().negate(), ok ? c : V3(0, 1, 0), ok);
    this.place(p.parts[1], o, gR, ok ? c : V3(0, 1, 0), ok);
  }
  updateStand(p, rise, shown) {
    const s = p.s, c = p.cur, side = s.page || (c.X < 0 ? 'L' : 'R'), e = rad(90 * rise * c.raise), t = rad(this.rock(p));
    this.anchor(side, c.X, c.Z);
    const yw = s.yaw || 0, y = rad(yw), exMain = V3(Math.cos(y), 0, -Math.sin(y)), n = V3(-Math.sin(y), 0, -Math.cos(y));
    // which way it lies when the book is closed: reader-facing pieces forward, walls away from the spine
    const fb = Math.abs(exMain.x) > .5 ? n.clone().negate() : (n.x * (c.X < 0 ? -1 : 1) > 0 ? n.clone() : n.clone().negate());
    p.foldF = fb.z > .5;
    const planes = [exMain]; if (p.def.cross) { const a = e; planes.push(exMain.clone().multiplyScalar(Math.cos(a)).addScaledVector(n.clone().negate(), Math.sin(a))); }
    planes.forEach((ex1base, k) => {
      const ex1 = ex1base.clone();
      const ey1 = fb.clone().multiplyScalar(Math.cos(e)).add(V3(0, Math.sin(e), 0));
      // rock about the base point, within the piece's own plane
      const ex0 = ex1.clone().multiplyScalar(Math.cos(t)).addScaledVector(ey1, Math.sin(t));
      const ey0 = ey1.clone().multiplyScalar(Math.cos(t)).addScaledVector(ex1, -Math.sin(t));
      const o = this.pt(side, c.X, c.Y + .05 + k * .01, c.Z);
      this.place(p.parts[k], o, this.map(side, ex0.x, ex0.y, ex0.z), this.map(side, ey0.x, ey0.y, ey0.z), shown && s.hidden !== true);
    });
    this.updateStrut(p, side, e, shown && s.hidden !== true);
  }
  // the strut behind a reader-facing piece: from its back, 55% up, to a point on the opposite page near the spine
  updateStrut(p, side, e, shown) {
    const d = p.def;
    if (!p.strut) {
      // in a book that opens flat, the linkage that lifts a free-standing piece runs under the page and can't be seen;
      // draw it only when asked (def.showStrut), e.g. for a structure view
      const need = d.showStrut && p.foldF && !d.drag && !d.parent && d.raise === undefined && (d.Y || 0) < .5;
      p.strut = need ? this.makeStrut() : 'none';
    }
    if (p.strut === 'none') return;
    const c = p.cur, h = d.h ?? d.art.h, s = .55 * h, X = Math.abs(c.X);
    const dq = Math.max(1.2, Math.min(4, (c.Z + 60) * s / (2 * X)));
    const Zq = c.Z - 2 * X * dq / s, opp = side === 'L' ? 'R' : 'L';
    this.anchor(side, c.X, c.Z);
    const P = this.pt(side, c.X, s * Math.sin(e) + .05, c.Z + s * Math.cos(e) - .15);
    this.anc = null;
    const Q = this.pt(opp, opp === 'L' ? -dq : dq, .05, Zq);
    const along = Q.clone().sub(P), len = along.length();
    if (len < 1e-4) { p.strut.visible = false; return; }
    const ey = along.clone().divideScalar(len), up = V3(0, 1, 0), ex = V3().crossVectors(ey, up);
    if (ex.lengthSq() < 1e-6) ex.set(1, 0, 0); ex.normalize();
    _z.crossVectors(ex, ey).normalize(); _m.makeBasis(ex, ey, _z).setPosition(P);
    p.strut.matrix.copy(_m); p.strut.matrix.scale(V3(1, len / U, 1)); p.strut.matrixWorldNeedsUpdate = true;
    p.strut.visible = shown;
  }
  makeStrut() {
    const m = new THREE.Mesh(planeGeo(-.6, .6, 0, 1), new THREE.MeshStandardMaterial({color: '#d9c9a6', roughness: .95, side: THREE.DoubleSide}));
    m.matrixAutoUpdate = false; m.castShadow = true; this.group.add(m); return m;
  }
  updateBox(p, rise, shown) {
    const s = p.s, c = p.cur, side = c.X < 0 ? 'L' : 'R', y = rad(s.yaw || 0), hf = Math.max(.02, rise * c.raise);
    const cs = Math.cos(y), sn = Math.sin(y), b = this.bob(p);
    this.anchor(side, c.X, c.Z);
    const at = (x, yy, z) => this.pt(side, c.X + x * cs + z * sn, c.Y + b + yy + .05, c.Z - x * sn + z * cs);
    const dir = (x, yy, z) => this.map(side, x * cs + z * sn, yy, -x * sn + z * cs);
    const up = this.map(side, 0, hf, 0), W = s.w, D = s.d, H = s.h, show = shown && hf > .03;
    const poses = [[at(0, 0, D / 2), dir(1, 0, 0), up], [at(0, 0, -D / 2), dir(-1, 0, 0), up],
      [at(-W / 2, 0, 0), dir(0, 0, 1), up], [at(W / 2, 0, 0), dir(0, 0, -1), up], [at(0, H * hf, D / 2), dir(1, 0, 0), dir(0, 0, -1)]];
    poses.forEach(([o, ex, ey], k) => { if (p.parts[k]) this.place(p.parts[k], o, ex, ey, show); });
  }
  updateZigzag(p, rise, shown) {
    // W-fold: in plan view the panels zigzag at ±φ to the X axis; φ closes from ~86° (stacked) to φOpen (fanned out)
    const s = p.s, c = p.cur, side = c.X < 0 ? 'L' : 'R', u = s.u ?? 1, n = s.n, pw = s.pw;
    const phi = lerp(s.phiClosed ?? 86, s.phiOpen ?? 32, u), e = rad(90 * rise * u);
    const pts = [[0, 0]];
    for (let k = 0; k < n; k++) { const th = rad(k % 2 ? -phi : phi), q = pts[k]; pts.push([q[0] + pw * Math.cos(th), q[1] - pw * Math.sin(th)]); }
    const [ox, oz] = pts[n].map(v => v / 2);
    this.anchor(side, c.X, c.Z);
    for (let k = 0; k < n; k++) {
      const th = rad(k % 2 ? -phi : phi), ex0 = V3(Math.cos(th), 0, -Math.sin(th)), fb = V3(-Math.sin(th), 0, -Math.cos(th));
      const ey0 = fb.multiplyScalar(Math.cos(e)).add(V3(0, Math.sin(e), 0));
      const o = this.pt(side, c.X + pts[k][0] - ox, c.Y + .05 + k * .01, c.Z + pts[k][1] - oz);
      this.place(p.parts[k], o, this.map(side, ex0.x, ex0.y, ex0.z), this.map(side, ey0.x, ey0.y, ey0.z), shown && rise > .02);
    }
  }
  updateCard(p, shown) {
    // lies flat; hinged along its far edge, lifts toward the far side when opened
    const s = p.s, side = s.X < 0 ? 'L' : 'R', a = rad((s.max ?? 150) * smooth(p.open)), dz = V3(0, Math.sin(a), Math.cos(a));
    const hinge = V3(s.X, (s.Y || 0) + .12, s.Z - s.h / 2), o0 = hinge.clone().addScaledVector(dz, s.h);
    const ey0 = dz.clone().negate();
    this.anchor(side, s.X, s.Z);
    // cards lie flat, so they also show on the page peeking out from under a lifted corner
    this.place(p.parts[0], this.pt(side, o0.x, o0.y, o0.z), this.map(side, 1, 0, 0), this.map(side, ey0.x, ey0.y, ey0.z), shown || (this.peek && !p.def.Y));
  }
  updateCustom(p, rise, shown) {
    const pose = p.def.pose(p.s, rise, p);
    if (!pose) { this.place(p.parts[0], V3(), V3(1, 0, 0), V3(0, 1, 0), false); return; }
    if (p.def.parent) {
      // riveted or hinged to its parent: the pose is in the parent's own frame, so it folds with the parent
      const par = this.byId[p.def.parent], pm = par.parts[p.def.parentPart || 0].front;
      const lx = V3(...pose.x).normalize(), ly = V3(...pose.y).normalize(), lz = V3().crossVectors(lx, ly).normalize();
      const local = new THREE.Matrix4().makeBasis(lx, ly, lz).setPosition(V3(...pose.o).multiplyScalar(U));
      const m = pm.matrix.clone().multiply(local);
      for (const mesh of [p.parts[0].front, p.parts[0].back, p.parts[0].lit]) if (mesh) { mesh.matrix.copy(m); mesh.matrixWorldNeedsUpdate = true;
        mesh.visible = shown && pm.visible && (mesh !== p.parts[0].lit || mesh.material.opacity > .004); }
      return;
    }
    const side = p.s.page || (pose.o[0] < 0 ? 'L' : 'R');
    this.anchor(side, pose.o[0], pose.o[2]);
    this.place(p.parts[0], this.pt(side, ...pose.o), this.map(side, ...pose.x).normalize(), this.map(side, ...pose.y).normalize(), shown && rise > .97);
  }
}

/* ---------- pull-tabs ----------
   A kraft-paper tab with stitched edges: a little picture of what it moves at the far end, chevrons pointing the way
   to pull, and a ribbon tied through a punched hole at the end you hold. c.tab = {icon, color} picks the picture. */
const TAB_ICONS = {
  bus: c => `<rect x="-11" y="-12" width="22" height="24" rx="4" fill="${c}"/><rect x="-8" y="-9" width="16" height="6" fill="#dfeef3"/><rect x="-8" y="0" width="16" height="6" fill="#dfeef3"/><circle cx="-6" cy="12" r="2.6" fill="#222"/><circle cx="6" cy="12" r="2.6" fill="#222"/>`,
  boat: c => `<path d="M-14,2 H14 L9,10 H-9 Z" fill="${c}"/><rect x="-8" y="-6" width="15" height="8" rx="2" fill="#f4f1ea" stroke="#3a3129" stroke-width="1.2"/><path d="M-16,13 q4,-3 8,0 t8,0 t8,0 t8,0" fill="none" stroke="#5f86a3" stroke-width="1.6"/>`,
  meet: c => `<circle cx="-7" cy="-6" r="4" fill="#3a3129"/><path d="M-12,8 q5,-10 10,0 Z" fill="#5b86d6"/><circle cx="7" cy="-6" r="4" fill="#6b4226"/><path d="M2,8 q5,-10 10,0 Z" fill="#d9a441"/><path d="M0,-14 c-3,-4 -7,0 0,4 c7,-4 3,-8 0,-4 Z" fill="${c}"/>`,
  dino: c => `<path d="M-14,8 Q-6,-2 4,0 Q8,-10 14,-10 Q16,-6 12,-4 Q12,4 6,6 L7,12 H3 L2,8 H-6 L-7,12 H-11 L-10,8 Z" fill="${c}"/><circle cx="12" cy="-8" r="1.2" fill="#222"/>`,
  card: c => `<rect x="-12" y="-6" width="20" height="14" rx="2" fill="#c9a26b" stroke="#3a3129" stroke-width="1.2"/><rect x="-8" y="-11" width="20" height="14" rx="2" fill="#e2c592" stroke="#3a3129" stroke-width="1.2"/><path d="M-4,-6 h12" stroke="#3a3129" stroke-width="1.2"/>`,
  star: c => `<path d="M0,-13 L4,-4 L13,-4 L6,2 L9,12 L0,6 L-9,12 L-6,2 L-13,-4 L-4,-4 Z" fill="${c}"/>`,
};
const tabArt = c => {
  const t = c.tab || {}, col = t.color || '#c8423a', icon = (TAB_ICONS[t.icon] || TAB_ICONS.star)(col);
  return {w: 7, h: 16, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 160" width="70" height="160">
    <path d="M6,14 Q6,4 16,4 H54 Q64,4 64,14 V118 Q64,124 58,126 Q35,150 12,126 Q6,124 6,118 Z" fill="#d7b688" stroke="#8a6a3e" stroke-width="2.5"/>
    <path d="M12,16 Q12,10 18,10 H52 Q58,10 58,16 V116 Q35,140 12,116 Z" fill="none" stroke="#f6ead2" stroke-width="2" stroke-dasharray="5 4"/>
    <circle cx="35" cy="38" r="21" fill="#fbf4e4" stroke="#8a6a3e" stroke-width="2"/>
    <g transform="translate(35 38)">${icon}</g>
    <path d="M24,74 l11,9 l11,-9 M24,90 l11,9 l11,-9" fill="none" stroke="${col}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="35" cy="122" r="6.5" fill="#5b4326" stroke="#f6ead2" stroke-width="1.6"/>
    <path d="M35,122 C22,130 16,150 24,156 C28,150 31,140 35,128 M35,122 C48,130 54,150 46,156 C42,150 39,140 35,128" fill="${col}" stroke="#7d221d" stroke-width="1.4"/>
    <path d="M30,118 q5,8 10,0" fill="none" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/></svg>`};
};

/* GPU budget tiers for hosts that ask for one (createReader's `budget`): the drawing buffer's pixel ratio and pixel
   count, the longest texture side, texture scale and shadow map size. The reader starts on tier 0 and steps down while
   frames stay slow; on the last tier it only renders while something moves or the reader is touched. */
export const BUDGET_TIERS = [
  {dpr: 1.5, pixels: 2e6, tex: 2048, q: .57, shadow: 1024},
  {dpr: 1, pixels: 1e6, tex: 1024, q: .42, shadow: 0},
  {dpr: 1, pixels: 1e6, tex: 1024, q: .42, shadow: 0, still: true},
];

/* ---------- the reader ---------- */
// budget: optional {tier: start tier, adapt: step down on slow frames}; without it the reader uses the full desktop /
// phone settings. ui.gpu(kind), if given, hears about 'tier' changes, 'lost' / 'restored' contexts and 'dead'.
export async function createReader({canvas, book, ui, budget = null}) {
  const phone = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
  let tier = budget ? clamp(budget.tier || 0, 0, BUDGET_TIERS.length - 1) : -1;
  const B = () => BUDGET_TIERS[tier];
  Q = budget ? Math.min(B().q, phone ? .7 : 1) : phone ? .7 : 1;
  MAX_TEX = budget ? B().tex : Infinity; BACK_K = budget ? .5 : 1;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: budget ? 'default' : 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 1.75));
  renderer.shadowMap.enabled = !budget || B().shadow > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // a shader that doesn't compile leaves a blank book: hosts with a fallback page hear about it instead
  if (ui.gpu) renderer.debug.onShaderError = () => ui.gpu('dead');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#171009');
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 40);

  const hemi = new THREE.HemisphereLight('#fff4e0', '#3a2a1e', .6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  sun.position.set(-1.1, 5.2, 1.4); sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -1.6, right: 1.6, top: 1.4, bottom: -1.4, near: .5, far: 8});
  sun.shadow.mapSize.setScalar(budget ? B().shadow || 512 : 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .012;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#ffe9d0', .35); fill.position.set(2, 1.5, 1); scene.add(fill);

  const woodTex = woodTexture(); woodTex.repeat.set(2 * 30 / 9, 2 * 30 / 9);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({map: woodTex, roughness: .62}));
  desk.receiveShadow = true; scene.add(desk);

  /* what lies on the desk around the book (book.desk): a mat and craft things that stay, and each spread's travel props
     (spread.desk) beside the book. All of it is painted into one texture, so it costs one draw call; the props change
     half way through a page turn. Art is in book units centred on the spine (10 px a unit, like the page floors);
     taps are {x, z, w, h, note} rectangles in the same units. bookShadow: a soft shadow round the book's footprint
     (the right half while it is closed), so the pages stand clear of a pale mat. */
  let deskLayer = null;
  if (book.desk) {
    const dk = book.desk, k = Math.min(Q * .42, (budget ? MAX_TEX : 4096) / (dk.w * 10));
    const W = Math.round(dk.w * 10 * k), H = Math.round(dk.h * 10 * k);
    const wrap = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dk.w * 10} ${dk.h * 10}" width="${W}" height="${H}">${inner}</svg>`;
    const base = await loadSVG(wrap(dk.base)), c = canvasOf(W, H), t = tex(c), props = new Map();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(dk.w * U, dk.h * U).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({map: t, transparent: true, depthWrite: false, roughness: .85}));
    mesh.position.y = .0006; mesh.receiveShadow = true; scene.add(mesh);
    const deskOf = i => book.spreads[i] && book.spreads[i].desk;
    // keep the props of at most two spreads loaded: the one shown and the one coming
    const load = i => { if (!deskOf(i)) return Promise.resolve(null);
      if (!props.has(i)) { props.set(i, loadSVG(wrap(deskOf(i).art))); for (const key of props.keys()) if (props.size > 2 && key !== i) props.delete(key); }
      return props.get(i); };
    let shown = null, shownOpen = null;
    const draw = async (i, isOpen = cur >= 0) => {
      if (i === shown && isOpen === shownOpen) return; shown = i; shownOpen = isOpen;
      const img = await load(i); if (shown !== i || shownOpen !== isOpen) return;
      const x = c.getContext('2d'); x.clearRect(0, 0, W, H); x.drawImage(base, 0, 0, W, H);
      if (dk.bookShadow) {
        const s = W / dk.w, X0 = isOpen ? -PW - 4 : -2, X1 = PW + 4, Z0 = -PD / 2 - 4, Z1 = PD / 2 + 4;
        x.save(); x.fillStyle = x.shadowColor = 'rgba(28,16,6,.5)'; x.shadowBlur = 9 * s; x.shadowOffsetY = 2 * s;
        x.fillRect((X0 + dk.w / 2) * s, (Z0 + dk.h / 2) * s, (X1 - X0) * s, (Z1 - Z0) * s); x.restore();
      }
      if (img) x.drawImage(img, 0, 0, W, H);
      t.needsUpdate = true;
    };
    // the note for a tap at a desk point, if it lands on something
    const tapAt = (X, Z) => { const all = (dk.taps || []).concat((deskOf(shown) || {}).taps || []);
      for (let n = all.length - 1; n >= 0; n--) { const r = all[n]; if (Math.abs(X - r.x) < r.w / 2 && Math.abs(Z - r.z) < r.h / 2) return r.note; } return null; };
    deskLayer = {mesh, draw, load, tapAt, toDesk: uv => [(uv.x - .5) * dk.w, (.5 - uv.y) * dk.h]};
    await draw(0, false);
  }

  /* book body: right half stays on the desk, the left half turns with the cover */
  const cloth = new THREE.MeshStandardMaterial({map: clothTexture(book.color || '#6b1e2a'), roughness: .85});
  const edge = new THREE.MeshStandardMaterial({map: edgeTexture(), roughness: .95});
  const paper = new THREE.MeshStandardMaterial({color: '#f3ebda', roughness: .95});
  const bw = PW * U + .03, bd = PD * U + .05;
  const blockGeo = new THREE.BoxGeometry(PW * U, T - BT - .002, PD * U);
  const boardGeo = new THREE.BoxGeometry(bw, BT, bd);
  const blockMats = [edge, paper, paper, paper, edge, edge];
  // a box with a material per face draws once per face; with its faces regrouped by material it draws once per material
  const byMaterial = (geo, mats) => {
    const g = geo.clone(), src = geo.index.array, uniq = [...new Set(mats)], idx = [];
    g.clearGroups();
    uniq.forEach((m, k) => { const s0 = idx.length;
      for (const gr of geo.groups) if (mats[gr.materialIndex] === m) for (let i = gr.start; i < gr.start + gr.count; i++) idx.push(src[i]);
      g.addGroup(s0, idx.length - s0, k); });
    g.setIndex(idx); return [g, uniq];
  };
  const rightHalf = new THREE.Group(); scene.add(rightHalf);
  const rb = new THREE.Mesh(boardGeo, cloth); rb.position.set(bw / 2, BT / 2, 0);
  const rk = new THREE.Mesh(...byMaterial(blockGeo, blockMats)); rk.position.set(PW / 2 * U, BT + (T - BT) / 2 - .001, 0);
  rightHalf.add(rb, rk);
  const leftHalf = new THREE.Group(); leftHalf.position.set(0, T, 0); scene.add(leftHalf);
  const coverTex = book.cover ? await coverTexture(book) : null;
  const coverMat = coverTex ? new THREE.MeshStandardMaterial({map: coverTex, roughness: .8}) : cloth;
  const lb = new THREE.Mesh(...byMaterial(boardGeo, [cloth, cloth, cloth, coverMat, cloth, cloth])); lb.position.set(-bw / 2, -T + BT / 2, 0);
  const lk = new THREE.Mesh(...byMaterial(blockGeo, [paper, edge, paper, paper, edge, edge])); lk.position.set(-PW / 2 * U, -(T - BT) / 2 - .001, 0);
  leftHalf.add(lb, lk);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(.012, 2 * T, bd), cloth); spine.position.set(-.006, T, 0); scene.add(spine);
  for (const m of [rb, rk, lb, lk, spine]) { m.castShadow = true; m.receiveShadow = true; }

  /* camera orbit */
  const target = V3(.5, .05, .02), targetGoal = target.clone();
  const view = {az: 0, pol: rad(50), r: 2.6}, goal = {...view};
  let fit = 2.6;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    // under a budget the drawing buffer keeps to its pixel ratio and pixel count
    if (budget) renderer.setPixelRatio(Math.max(.5, Math.min(devicePixelRatio, B().dpr, Math.sqrt(B().pixels / Math.max(1, w * h)))));
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const hf = 2 * Math.atan(Math.tan(rad(camera.fov / 2)) * camera.aspect);
    // portrait phones: frame the open book edge to edge instead of leaving a margin
    fit = camera.aspect < 1 ? 1.1 / Math.tan(hf / 2) : Math.max(2.3, 1.22 / Math.tan(hf / 2) + .25);
    goal.r = clamp(goal.r, fit * .45, fit * 1.5);
    // turning the phone between portrait and landscape changes how the open book is framed
    const p = portrait(); if (p !== wasPortrait) { wasPortrait = p; if (cur >= 0 && !busy) resetView(); }
  }
  const portrait = () => camera.aspect < .85;
  let zoomed = false, wasPortrait = null;
  /* portrait phones: the open book is framed larger than the screen, so its pages don't shrink to fit the width.
     Dragging sideways moves the view along the book; it glides on a little after a flick and stops at the book's edges. */
  const PORTRAIT_R = .58, BOOK_HALF = PW * U + .08;
  let panV = 0;
  const halfWidthAt = r => r * Math.tan(Math.atan(Math.tan(rad(camera.fov / 2)) * camera.aspect));
  const panLimit = () => Math.max(0, BOOK_HALF - halfWidthAt(goal.r));
  function resetView(open = cur >= 0) {
    zoomed = false; panV = 0;
    if (open && portrait()) { goal.az = 0; goal.pol = rad(30); goal.r = fit * PORTRAIT_R; targetGoal.set(0, .06, -.02); return; }
    goal.az = 0; goal.pol = rad(open ? 52 : 46); goal.r = open ? fit * 1.20 : fit * .78;
    targetGoal.set(open ? 0 : .52, .05, open ? .02 : 0);
  }
  // double-tap / double-click a page to look at it close up; again to step back
  function zoomAt(e) {
    if (cur < 0 || busy) return;
    if (zoomed && portrait()) { zoomed = false; goal.pol = rad(30); goal.r = fit * PORTRAIT_R; targetGoal.set(targetGoal.x, .06, -.02); return; }
    if (zoomed) { resetView(); return; }
    pick(e, []);
    if (!ray.ray.intersectPlane(pagePlane, _hit)) return;
    const side = _hit.x < 0 ? -1 : 1;
    zoomed = true;
    // portrait: close in on the tapped spot, which stays where it is across the book; aimed a little low so the page
    // stays clear of the reader's navigation
    if (portrait()) { targetGoal.set(clamp(_hit.x, -.75, .75), -.04, clamp(_hit.z, -.3, .3)); goal.az = 0; goal.pol = rad(28); goal.r = fit * .4; return; }
    targetGoal.set(side * PW / 2 * U, .08, clamp(_hit.z, -.25, .25));
    goal.az = 0; goal.pol = rad(portrait() ? 28 : 44); goal.r = fit * (portrait() ? .56 : .62);
  }

  /* state */
  const spreads = book.spreads.map((d, i) => new Spread(engine(), d, i));
  let coverTheta = 0, cur = -1, turn = null, busy = false;
  let coverIdx = 0;                       // the spread lying under the cover while it opens or closes
  const light = {...LIGHTS[book.spreads[0].light || 'morning']}, lightGoal = {...light};
  function setLight(p) { Object.assign(lightGoal, p); }

  function engine() {
    return {
      scene,
      tabArt,
      ctx: sp => ctxFor(sp),
    };
  }
  let actx;
  function ctxFor(sp) {
    return {
      note: (text, ev) => ui.note(text, ev ? ev.clientX : innerWidth / 2, ev ? ev.clientY : innerHeight / 2),
      // Follow the speakers while the meeting pull-tab finishes moving them.
      say: (text, ids) => ui.note(text, 0, 0, {anchor: () => {
        const points = ids.map(id => sp.byId[id]).filter(Boolean).map(p => {
          const f = p.parts[0].front; f.geometry.computeBoundingBox();
          return f.geometry.boundingBox.getCenter(V3()).applyMatrix4(f.matrixWorld);
        });
        if (!points.length) return [innerWidth / 2, innerHeight / 2];
        const center = points.reduce((a, b) => a.add(b), V3()).multiplyScalar(1 / points.length);
        const [x, y] = screenOf(center); return [x, y - 22];
      }}),
      // paper can't jump: a tapped piece just catches the light for a moment
      hop: id => { const p = sp.byId[id]; if (p) p.flash = 1; },
      set: (id, props) => { const p = sp.byId[id]; if (p) Object.assign(p.s, props); },
      get: id => sp.byId[id] && sp.byId[id].s,
      toggle: id => { const p = sp.byId[id]; if (p) p.s.opened = !p.s.opened; },
      tab: (id, v) => sp.applyTab(id, v),
      tabV: id => (sp.tabs.find(t => t.c.id === id) || {}).v ?? 0,
      once: key => { sp.flags = sp.flags || {}; if (sp.flags[key]) return false; return sp.flags[key] = true; },
      lights: v => { sp.litTarget = v === 'toggle' ? (sp.litTarget > .5 ? 0 : 1) : v; },
      light: (a, b, t) => { const A = LIGHTS[a], B = LIGHTS[b || a]; t = t ?? 0;
        if (sp.index === cur) setLight({dir: mix(A.dir, B.dir, t), di: lerp(A.di, B.di, t), hemi: lerp(A.hemi, B.hemi, t), sky: mix(A.sky, B.sky, t), exp: lerp(A.exp, B.exp, t)}); },
      bong, shutter,
    };
  }
  const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

  async function ensure(i) {
    if (i < 0 || i >= spreads.length) return;
    const sp = spreads[i];
    if (!sp.ready) { ui.loading('正在装订这一页…'); await sp.build(); ui.loading(null); }
    else await sp.ready;
  }
  const preload = i => { if (i >= 0 && i < spreads.length) spreads[i].build(); };

  function enter(i) {
    if (cur >= 0 && spreads[cur].built) spreads[cur].stopHints();
    cur = i;
    if (i >= 0) spreads[i].startHints();
    const d = book.spreads[Math.max(0, i)];
    setLight({...LIGHTS[d.light || 'morning']});
    ui.state({cur, total: spreads.length, spread: i >= 0 ? d : null, open: i >= 0});
    // only the open spread and its two neighbours stay in memory; under a budget only the next one
    const back = !budget;
    preload(i + 1); if (back) preload(i - 1);
    spreads.forEach((sp, k) => { const d = k - Math.max(0, i); if (d > 1 || d < (back ? -1 : 0)) sp.dispose(); });
    if (i >= 0 && i < spreads.length - 1 && hints < 2) {
      hints++; const sp = spreads[i];
      setTimeout(() => { if (cur === i && !busy) { sp.peelSide = 'R'; sp.peelTarget = .34; setTimeout(() => sp.peelTarget = 0, 900); } }, 900);
    }
  }
  let hints = 0;
  function animate(ms, step) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = 1;
    return new Promise(res => { turn = {t0: performance.now(), ms, step, res}; });
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  async function open() {
    if (busy || cur >= 0) return; busy = true;
    await ensure(0);
    resetView(true);
    coverIdx = 0;
    await animate(1700, t => { coverTheta = 180 * ease(t); if (deskLayer && t > .4) deskLayer.draw(0, true); });
    enter(0); busy = false;
  }
  // the corner curls up before the page turns; underneath, the next page shows through
  let lifting = null;
  async function lift(a, side, b) {
    lifting = {a, b, side};
    const q0 = a.peelSide === side ? a.peelQ : 0; a.peelSide = side;
    swish();
    await animate(420, t => { a.peelQ = q0 + (1 - q0) * (1 - Math.pow(1 - t, 3)); });
    lifting = null;
  }
  const relax = (a, t) => { a.peelQ = 1 - smooth(clamp(t / .6, 0, 1)); a.peelTarget = 0; };
  async function close() {
    if (busy || cur < 0) return; busy = true;
    // close straight from whatever page is open: mechanisms fold away, the left page lifts, and the cover comes
    // down over this spread (no leafing back through the earlier pages)
    const a = spreads[cur];
    preload(0);                           // the title spread is what opens next
    const was = a.dirty(); a.reset(); if (was) await animate(650, () => {});
    a.stopHints();
    await lift(a, 'L', null);
    coverIdx = cur; cur = -1;
    await animate(1300, t => { coverTheta = 180 * (1 - ease(t)); relax(a, t); if (deskLayer && t > .6) deskLayer.draw(0, false); });
    setLight({...LIGHTS[book.spreads[0].light || 'morning']});
    resetView(false); ui.state({cur: -1, total: spreads.length, spread: null, open: false}); busy = false;
  }
  async function go(i, inner) {
    if ((busy && !inner) || i === cur || i < 0 || i >= spreads.length || cur < 0) return;
    busy = true;
    if (portrait()) resetView(true);   // a page turn is seen from the middle of the book
    while (cur !== i) {
      const fwd = i > cur, a = spreads[cur], n = fwd ? cur + 1 : cur - 1;
      await ensure(n); const b = spreads[n];
      const was = a.dirty(); a.reset(); if (was) await animate(650, () => {});
      if (deskLayer) deskLayer.load(n);
      await lift(a, fwd ? 'R' : 'L', b);
      turnPair = {a, b, fwd};
      await animate(1500, t => { turnPair.t = ease(t); relax(a, t); if (deskLayer && t > .5) deskLayer.draw(n, true); });
      a.peelQ = 0; turnPair = null; enter(n);
    }
    busy = inner ? busy : false;
  }
  let turnPair = null;

  /* pointer: tabs and taps first, otherwise orbit */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pointers = new Map(); let drag = null, pinch = null;
  function pickAt(x, y, list) {
    const r = canvas.getBoundingClientRect();
    ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const h of ray.intersectObjects(list, false)) {
      if (!h.object.visible) continue;                         // hidden pieces can't be touched
      const m = h.object.userData.mask;
      if (!m || (h.uv && m.at(h.uv.x, h.uv.y) > 100)) return h;
    }
    return null;
  }
  // a fingertip covers more than a pixel: on touch screens, look around the touch point too
  const RING = [[1, 0], [.7, .7], [0, 1], [-.7, .7], [-1, 0], [-.7, -.7], [0, -1], [.7, -.7]];
  function pick(e, list, fuzzy = true) {
    const h = pickAt(e.clientX, e.clientY, list);
    if (h || !fuzzy || e.pointerType !== 'touch' || !list.length) { pickAt(e.clientX, e.clientY, []); return h; }
    for (const rr of [14, 26]) for (const [dx, dy] of RING) { const q = pickAt(e.clientX + dx * rr, e.clientY + dy * rr, list); if (q) return q; }
    pickAt(e.clientX, e.clientY, []);
    return null;
  }
  const screenOf = v => { const p = v.clone().project(camera), r = canvas.getBoundingClientRect(); return [(p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height]; };
  let lastTouch = -1e9;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') lastTouch = performance.now();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }

    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), r: goal.r}; drag = null; return; }
    const sp = cur >= 0 && !busy ? spreads[cur] : null;
    if (sp) {
      const grabTab = (t, tapPiece) => {
        const c = t.c, side = c.X < 0 ? 'L' : 'R', dir = c.dir || [0, 0, 1];
        sp.anchor(side, c.X, c.Z);
        const w0 = sp.pt(side, c.X, .3, c.Z).applyMatrix4(sp.group.matrixWorld);
        const w1 = sp.pt(side, c.X + dir[0] * c.len, .3, c.Z + dir[2] * c.len).applyMatrix4(sp.group.matrixWorld);
        const a = screenOf(w0), b = screenOf(w1), r = canvas.getBoundingClientRect();
        drag = {tab: t, sp, a, b, x0: e.clientX - r.left, y0: e.clientY - r.top, v0: t.v, sx: e.clientX, sy: e.clientY, tapPiece};
        ui.hint(null);
      };
      // exact hits first; on touch screens, then whatever is nearest the fingertip
      const tabMeshes = sp.tabs.filter(t => t.mesh).map(t => t.mesh);
      let th = pick(e, tabMeshes, false), ph = th ? null : pick(e, sp.pick, false);
      if (!th && !ph) { th = pick(e, tabMeshes); if (!th) ph = pick(e, sp.pick); }
      if (th) { const t = sp.tabs.find(t => t.mesh === th.object); sp.touch(t); grabTab(t); return; }
      const pp = ph && ph.object.userData.piece;
      if (pp) { sp.touch(pp); if (pp.def.drag) sp.touch(sp.tabs.find(t => t.c.id === pp.def.drag)); }
      if (pp && pp.def.drag) { grabTab(sp.tabs.find(t => t.c.id === pp.def.drag), pp); return; }
      if (pp && pp.def.dial) {
        const ctr = screenOf(V3().setFromMatrixPosition(pp.parts[0].front.matrixWorld)), r = canvas.getBoundingClientRect();
        drag = {dial: pp, sp, cx: ctr[0] + r.left, cy: ctr[1] + r.top, a: null, sx: e.clientX, sy: e.clientY};
        ui.hint(null); return;
      }
      const cn = ph ? null : cornerAt(e, sp);
      drag = {orbit: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, tap: ph, corner: cn, sp};
      if (cn) { sp.peelSide = cn; sp.peelTarget = .45; }
      return;
    }
    if (cur < 0 && !busy && pick(e, [lb])) { drag = {cover: true, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, orbit: true}; return; }
    drag = {orbit: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY};
  });
  // the bottom-left and bottom-right corners of the open book turn the page
  // hit-tested against the flat page plane, so it keeps working while the corner is curled up under the pointer
  const pagePlane = new THREE.Plane(V3(0, 1, 0), -T), _hit = V3();
  function cornerAt(e, sp) {
    pick(e, []);
    if (!ray.ray.intersectPlane(pagePlane, _hit)) return null;
    const X = _hit.x / U, z = _hit.z / U, side = X < 0 ? 'L' : 'R', u = Math.abs(X);
    return u > CORNER.u && u < PW + 2 && z > CORNER.z && z < PD / 2 + 3 && (side === 'L' || cur < spreads.length - 1) ? side : null;
  }
  let hoverCorner = null;
  function hover(e) {
    const sp = cur >= 0 && !busy ? spreads[cur] : null, cn = sp && !pick(e, sp.pick) ? cornerAt(e, sp) : null;
    if (cn === hoverCorner) return;
    hoverCorner = cn; canvas.style.cursor = cn ? 'pointer' : '';
    if (sp) { if (cn) sp.peelSide = cn; sp.peelTarget = cn ? .3 : 0; }
  }
  canvas.addEventListener('pointerleave', () => { if (cur >= 0 && spreads[cur].built) spreads[cur].peelTarget = 0; hoverCorner = null; canvas.style.cursor = ''; });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) { if (e.pointerType === 'mouse') hover(e); return; }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; goal.r = clamp(pinch.r * pinch.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])), fit * .45, fit * 1.5); return; }
    if (!drag) return;
    if (drag.dial) {
      const a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
      if (drag.a !== null && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 3) {
        let d = a - drag.a; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
        drag.dial.def.dial(d * 180 / Math.PI, ctxFor(drag.sp), drag.dial);
      }
      drag.a = a; return;
    }
    if (drag.tab) {
      const r = canvas.getBoundingClientRect(), [ax, ay] = drag.a, [bx, by] = drag.b;
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
      const v = drag.v0 + ((e.clientX - r.left - drag.x0) * dx + (e.clientY - r.top - drag.y0) * dy) / L;
      drag.sp.applyTab(drag.tab.c.id, v);
      return;
    }
    // portrait, book open: a sideways drag slides between the pages, an up-and-down one tilts; elsewhere it orbits
    if (portrait() && cur >= 0 && !busy) {
      if (!drag.axis && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) drag.axis = Math.abs(e.clientX - drag.sx) > Math.abs(e.clientY - drag.sy) ? 'x' : 'y';
      if (drag.axis === 'x') {
        // the book follows the finger
        const now = performance.now(), dx = (e.clientX - drag.x) * 2 * halfWidthAt(view.r) / canvas.clientWidth, lim = panLimit();
        targetGoal.x = clamp(targetGoal.x - dx, -lim, lim); goal.az = 0; panV = 0;
        drag.vx = lerp(drag.vx || 0, -dx / Math.max(8, now - (drag.t || now - 16)) * 1000, .5); drag.t = now;
      } else if (drag.axis === 'y') goal.pol = clamp(goal.pol - (e.clientY - drag.y) * .004, .3, 1.25);
      drag.x = e.clientX; drag.y = e.clientY;
      return;
    }
    goal.az = clamp(goal.az - (e.clientX - drag.x) * .005, -1.1, 1.1);
    goal.pol = clamp(goal.pol - (e.clientY - drag.y) * .004, .3, 1.25);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  let lastTap = null;
  const end = e => {
    pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
    const d = drag; drag = null; if (!d) return;
    // a flick glides on
    if (d.axis === 'x') { panV = performance.now() - (d.t || 0) < 80 ? clamp(d.vx || 0, -3, 3) : 0; return; }
    const still = Math.hypot(e.clientX - (d.sx ?? e.clientX), e.clientY - (d.sy ?? e.clientY)) < (e.pointerType === 'touch' ? 14 : 6);
    if (d.cover && still) { open(); return; }
    // Match desktop double-clicking: the page can be zoomed even when a printed mechanism is under the finger.
    if (still && !d.corner && !d.tab && e.pointerType === 'touch') {
      const now = performance.now();
      if (lastTap && now - lastTap.t < 400 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
        lastTap = null; zoomAt(e); return;
      }
      lastTap = {t: now, x: e.clientX, y: e.clientY};
    }
    // a short tap on a draggable or turnable piece still counts as a tap
    const tp = d.tapPiece || d.dial;
    if (tp) { if (still && tp.def.tap) tp.def.tap(ctxFor(d.sp), e); return; }
    if (d.corner) {
      if (still) { hoverCorner = null; d.corner === 'R' ? go(cur + 1) : (cur > 0 ? go(cur - 1) : close()); }
      else d.sp.peelTarget = 0;
      return;
    }
    // a tap on something lying on the desk says what it is
    if (still && !d.tap && !d.cover && deskLayer) {
      const h = pick(e, [deskLayer.mesh], false), note = h && h.uv && deskLayer.tapAt(...deskLayer.toDesk(h.uv));
      if (note) { lastTap = null; ui.note(note, e.clientX, e.clientY); return; }
    }

    if (d.tap && still) {
      const p = d.tap.object.userData.piece;
      if (p.def.type === 'card') { p.s.opened = !p.s.opened; if (p.def.tap) p.def.tap(ctxFor(d.sp), e); }
      else p.def.tap(ctxFor(d.sp), e);
      ui.hint(null);
    }
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => { e.preventDefault(); goal.r = clamp(goal.r * Math.exp(e.deltaY * .001), fit * .45, fit * 1.5); }, {passive: false});
  // mouse double-clicks zoom; on touch screens the browser fires dblclick after two taps as well, which would undo the
  // zoom the taps just made, so a dblclick right after a touch is ignored
  canvas.addEventListener('dblclick', e => { if (performance.now() - lastTouch > 800) zoomAt(e); });


  /* sound */
  let ac;
  function bong() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime;
      [[164.8, .5], [329.6, .28], [392, .12], [494, .1], [659, .05]].forEach(([f, g]) => {
        const o = ac.createOscillator(), v = ac.createGain();
        o.frequency.value = f; v.gain.setValueAtTime(.0001, t);
        v.gain.exponentialRampToValueAtTime(g * .5, t + .015); v.gain.exponentialRampToValueAtTime(.0001, t + 3.5);
        o.connect(v).connect(ac.destination); o.start(t); o.stop(t + 3.6);
      });
    } catch (err) {}
  }

  // a camera shutter: a click, a short whirr, a second click
  function shutter() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime;
      const click = (at, f, g) => { const len = ac.sampleRate * .03, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), v = ac.createGain();
        src.buffer = buf; fl.type = 'highpass'; fl.frequency.value = f; v.gain.value = g;
        src.connect(fl).connect(v).connect(ac.destination); src.start(t + at); };
      click(0, 1500, .5); click(.09, 900, .35);
      const o = ac.createOscillator(), v = ac.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(180, t + .14); o.frequency.linearRampToValueAtTime(120, t + .5);
      v.gain.setValueAtTime(.0001, t + .14); v.gain.exponentialRampToValueAtTime(.025, t + .18); v.gain.exponentialRampToValueAtTime(.0001, t + .55);
      o.connect(v).connect(ac.destination); o.start(t + .14); o.stop(t + .6);
    } catch (err) {}
  }
  function swish() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime, len = ac.sampleRate * .5, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), v = ac.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(700, t + .45); f.Q.value = .7;
      v.gain.setValueAtTime(.0001, t); v.gain.exponentialRampToValueAtTime(.12, t + .06); v.gain.exponentialRampToValueAtTime(.0001, t + .5);
      src.connect(f).connect(v).connect(ac.destination); src.start(t);
    } catch (err) {}
  }

  /* frame loop */
  let last = performance.now(), hold = null, raf = 0, lost = false, losses = 0, awake = performance.now(), calm = 0, slow = [];
  const loop = () => { if (!raf && !lost && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const poke = () => { awake = performance.now(); };
  function setTier(n) {
    tier = n; const b = B();
    Q = Math.min(b.q, phone ? .7 : 1); MAX_TEX = b.tex; resize();
    if (!b.shadow && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false; sun.castShadow = false;
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      scene.traverse(o => { for (const m of [].concat(o.material || [])) m.needsUpdate = true; });
    }
    slow = []; if (ui.gpu) ui.gpu('tier', n);
  }
  // frames slower than ~22 fps for most of two seconds of settled reading (no page turn or build going on) step down
  function watch(now, raw) {
    if (busy || turn || lifting) { calm = now; slow = []; return; }
    if (now - calm < 1200) return;
    slow.push(raw); if (slow.length < 60) return;
    const sorted = slow.slice().sort((a, b) => a - b); slow = [];
    if (sorted[30] > 45 && tier < BUDGET_TIERS.length - 1) setTier(tier + 1);
  }
  function frame(now) {
    raf = 0;
    const raw = now - last, dt = Math.min(.05, raw / 1000); last = now;
    if (budget && budget.adapt !== false) watch(now, raw);
    // the last tier draws only while something is moving or was touched in the last two seconds
    if (budget && B().still && !busy && !turn && !lifting && now - awake > 2000) { raf = requestAnimationFrame(frame); return; }
    if (turn) { const t = clamp((now - turn.t0) / turn.ms, 0, 1); turn.step(t); if (t >= 1) { const r = turn.res; turn = null; r(); } }
    // light
    const k = 1 - Math.exp(-dt * 3);
    for (const key of ['di', 'hemi', 'exp']) light[key] = lerp(light[key], lightGoal[key], k);
    light.dir = mix(light.dir, lightGoal.dir, k); light.sky = mix(light.sky, lightGoal.sky, k);
    sun.color.set(light.dir); sun.intensity = light.di; hemi.intensity = light.hemi; hemi.color.set(light.sky);
    renderer.toneMappingExposure = light.exp * (phone ? 1 + .32 * clamp((2.2 - light.di) / .9, 0, 1) : 1);
    // camera
    for (const key of ['az', 'pol', 'r']) view[key] = lerp(view[key], goal[key], 1 - Math.exp(-dt * 6));
    if (portrait() && cur >= 0) {
      if (panV && !drag) { targetGoal.x += panV * dt; panV *= Math.exp(-dt * 5); if (Math.abs(panV) < .01) panV = 0; }
      const lim = panLimit(); if (Math.abs(targetGoal.x) > lim) { targetGoal.x = clamp(targetGoal.x, -lim, lim); panV = 0; }
    }
    target.lerp(targetGoal, 1 - Math.exp(-dt * (drag && drag.axis === 'x' || panV ? 14 : 4)));
    camera.position.set(target.x + view.r * Math.sin(view.pol) * Math.sin(view.az), target.y + view.r * Math.cos(view.pol), target.z + view.r * Math.sin(view.pol) * Math.cos(view.az));
    camera.lookAt(target);
    // book and spreads
    leftHalf.rotation.z = rad((hold !== null && cur >= 0 && !turnPair && !lifting ? hold : cur < 0 || (cur === 0 && turnPair === null && coverTheta < 180) ? coverTheta : 180) - 180);
    spine.visible = coverTheta < 25 && cur < 0;
    spreads.forEach(s => { if (s.built) { s.group.visible = false; s.group.position.y = T; } });
    if (!busy && cur >= 0 && spreads[cur].built) { const sp = spreads[cur]; sp.peelQ = lerp(sp.peelQ, sp.peelTarget, 1 - Math.exp(-dt * 8)); }
    if (lifting) {
      const {a, b, side} = lifting;
      a.group.visible = true; a.update(180, false, dt);
      // under a forward lift lies the next spread's right page; under a backward lift, the previous spread's left page
      if (b) { b.group.visible = true; b.group.position.y = T - .0015; b.peek = true; b.update(0, side === 'L', dt); b.peek = false; }
    } else if (turnPair) {
      const {a, b, fwd, t = 0} = turnPair;
      // forward: a's right page lifts and turns left (a flipped), b opens underneath; backward: the mirror image
      if (fwd) { a.group.visible = b.group.visible = true; a.update(180 - 180 * t, true, dt); b.update(180 * t, false, dt); }
      else { a.group.visible = b.group.visible = true; a.update(180 - 180 * t, false, dt); b.update(180 * t, true, dt); }
    } else if (cur < 0 || (cur === 0 && coverTheta < 180)) {
      const s = spreads[cur < 0 ? coverIdx : 0]; if (s.built) { s.group.visible = coverTheta > .5; s.update(coverTheta, false, dt); }
    } else if (spreads[cur].built) { spreads[cur].group.visible = true; spreads[cur].update(hold ?? 180, false, dt); }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else addEventListener('resize', resize);
  resize(); resetView();
  Object.assign(view, goal); target.copy(targetGoal);
  ui.state({cur: -1, total: spreads.length, spread: null, open: false});
  // hidden pages stop drawing and sound; coming back restarts the clock so nothing jumps
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; if (ac && ac.suspend) ac.suspend().catch(() => {}); }
    else { slow = []; calm = performance.now(); poke(); loop(); }
  });
  for (const ev of ['pointerdown', 'pointermove', 'wheel']) canvas.addEventListener(ev, poke, {passive: true});
  // a lost GPU context stops the loop; three.js restores its state when the context comes back, twice at most
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); cancelAnimationFrame(raf); raf = 0; lost = true; losses++;
    if (ui.gpu) ui.gpu(losses > 2 ? 'dead' : 'lost');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (losses > 2) return;
    lost = false; poke(); loop(); if (ui.gpu) ui.gpu('restored');
  });
  loop();
  spreads[0].build();

  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea')) return;
    poke();
    if (e.key === 'ArrowRight') cur < 0 ? open() : go(cur + 1);
    if (e.key === 'ArrowLeft') cur > 0 ? go(cur - 1) : close();
  });

  function reset() {
    if (cur < 0 || busy) return;
    spreads[cur].reset();
    setLight({...LIGHTS[book.spreads[cur].light || 'morning']});
  }

  return {camera, scene,
    open, close, reset, next: () => go(cur + 1), prev: () => cur > 0 ? go(cur - 1) : close(), go, resetView: () => resetView(),
    get cur() { return cur; }, get busy() { return busy; }, spreads,
    // test hook: drag a tab programmatically
    pull: (id, v) => cur >= 0 && spreads[cur].applyTab(id, v),
    // set the camera straight away (for still renders): azimuth and polar angle in degrees, distance as a multiple of
    // the fitted distance, and the point looked at in world units
    setView: ({az, pol, r, target: t} = {}) => {
      if (az !== undefined) goal.az = rad(az); if (pol !== undefined) goal.pol = rad(pol); if (r !== undefined) goal.r = fit * r;
      if (t) targetGoal.set(...t); Object.assign(view, goal); target.copy(targetGoal);
    },
    // hold the open spread at an opening angle (0 closed … 180 flat), or null to let it lie flat again
    hold: th => { hold = th; },
    // render the open spread to an image (for the share card): w × h pixels, from the reader's default framing or from
    // {az, pol, r (× fitted distance), target}, or close in on a piece ({focus: id, r}). Hints are switched off first.
    snapshot: ({w = 1600, h = 900, view = {}, focus} = {}) => {
      if (cur < 0 || busy || !spreads[cur].built) return null;
      const sp = spreads[cur]; sp.stopHints();
      const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio(), aspect = camera.aspect;
      renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      const hf = 2 * Math.atan(Math.tan(rad(camera.fov / 2)) * camera.aspect), fitS = Math.max(2.3, 1.22 / Math.tan(hf / 2) + .25);
      let tg = V3(...(view.target || [0, .05, .03]));
      if (focus && sp.byId[focus]) { const m = sp.byId[focus].parts[0].front; m.updateMatrixWorld(); tg = V3().setFromMatrixPosition(m.matrixWorld); tg.y = Math.max(tg.y, .08); }
      const az = rad(view.az ?? 0), pol = rad(view.pol ?? 47), r = fitS * (view.r ?? (focus ? .42 : .98));
      const keep = camera.position.clone(), keepQ = camera.quaternion.clone();
      camera.position.set(tg.x + r * Math.sin(pol) * Math.sin(az), tg.y + r * Math.cos(pol), tg.z + r * Math.sin(pol) * Math.cos(az)); camera.lookAt(tg);
      renderer.render(scene, camera);
      const out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d').drawImage(canvas, 0, 0, w, h);
      camera.position.copy(keep); camera.quaternion.copy(keepQ);
      renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false); camera.aspect = aspect; camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      return out;
    },
    // GPU memory in use: {geometries, textures} counts, and an estimate of texture bytes
    // and what the last frame drew (draw calls, triangles), the longest texture side, the budget tier and buffer size
    memory: () => { let bytes = 0, maxSide = 0; const seen = new Set();
      scene.traverse(o => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'emissiveMap', 'alphaMap', 'backMap']) { const t = m[k] || m.userData[k];
        if (t && !seen.has(t) && t.image && t.image.width) { seen.add(t); maxSide = Math.max(maxSide, t.image.width, t.image.height); bytes += t.image.width * t.image.height * 4 * 4 / 3; } } });
      if (renderer.shadowMap.enabled) bytes += sun.shadow.mapSize.x * sun.shadow.mapSize.y * 4;
      const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
      return {...renderer.info.memory, textureMB: Math.round(bytes / 1e6), maxSide, calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles, tier, buffer: [buf.x, buf.y], pixelRatio: renderer.getPixelRatio()}; }};
}

async function coverTexture(book) {
  const k = Math.min(1, MAX_TEX / 1350), c = book.cover, img = await loadSVG(c.svg), W = Math.round(1030 * k), H = Math.round(1350 * k);
  const cv = canvasOf(W, H), x = cv.getContext('2d');
  // the board is turned over when closed, so the cover is drawn rotated half a turn
  x.translate(W, H); x.scale(-1, -1); x.drawImage(img, 0, 0, W, H);
  return tex(cv);
}
