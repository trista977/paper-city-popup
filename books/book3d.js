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

   Moving pieces ease toward their target position. A piece with bob (and rock) bounces and sways while it moves,
   so vehicles roll and figures walk instead of sliding. A piece with follow: id unfolds when that card opens.

   Book content works in flat-world units: X from -100 (left edge) to 100 (right edge), Z from -65 (far edge) to
   65 (near edge), Y up; 1u = 1% of a page's width. A piece on the left page rides with that page as it turns. */
import * as THREE from 'three';

const U = 0.01, PW = 100, PD = 130;
const BT = 0.012, T = 0.042;              // board thickness, page surface height above the desk
const PX = 12, FLOOR_PX = 10;             // texture pixels per unit
const rad = d => d * Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export const LIGHTS = {
  morning:   {dir: '#fff3e2', di: 2.6, hemi: .7,  sky: '#fff6e8', exp: 1.0},
  afternoon: {dir: '#fff0d8', di: 2.4, hemi: .62, sky: '#fff3e0', exp: 1.0},
  golden:    {dir: '#ffb766', di: 2.8, hemi: .42, sky: '#ffd29a', exp: 1.0},
  evening:   {dir: '#ffad6e', di: 1.15, hemi: .34, sky: '#c4b0c6', exp: .95},
  night:     {dir: '#b0bdff', di: 1.5, hemi: .7, sky: '#8a98d0', exp: 1.15},
};

/* ---------- textures ---------- */
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
function loadSVG(svg) {
  const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => { URL.revokeObjectURL(url); res(i); }; i.onerror = rej; i.src = url; });
}
let maxAniso = 4;
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; }
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
async function pieceTextures(a) {
  const w = a.w * PX, h = a.h * PX, img = await loadSVG(a.svg);
  const c = canvasOf(w, h); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const sil = fill(c, '#fbf7ee'), f = canvasOf(w, h), x = f.getContext('2d');
  for (const r of [1.6, 3.4]) for (let k = 0; k < 12; k++) x.drawImage(sil, r * Math.cos(k * Math.PI / 6), r * Math.sin(k * Math.PI / 6));
  x.drawImage(c, 0, 0);
  return {front: tex(f), back: tex(fill(f, '#ece2cc')), mask: alphaMask(f)};
}
async function plainTexture(a) {
  const img = await loadSVG(a.svg), c = canvasOf(a.w * PX, a.h * PX);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return tex(c);
}
// floor art covers the whole spread (2000 × 1300 px); returns [left, right] textures with gutter shading
async function floorTextures(svg, texts = []) {
  const img = await loadSVG(svg), W = 2 * PW * FLOOR_PX, H = PD * FLOOR_PX;
  const full = canvasOf(W, H), x = full.getContext('2d');
  x.drawImage(img, 0, 0, W, H);
  for (const t of texts) {
    x.save(); x.font = t.font; x.fillStyle = t.color || '#3a3129'; x.textAlign = t.align || 'left';
    if ('letterSpacing' in x) x.letterSpacing = (t.ls || 0) + 'px';
    x.fillText(t.text, t.x, t.y); x.restore();
  }
  return [0, 1].map(k => {
    const c = canvasOf(W / 2, H), y = c.getContext('2d');
    y.drawImage(full, k * W / 2, 0, W / 2, H, 0, 0, W / 2, H);
    const g = y.createLinearGradient(k ? 0 : W / 2, 0, k ? 90 : W / 2 - 90, 0);
    g.addColorStop(0, 'rgba(70,45,20,.28)'); g.addColorStop(1, 'rgba(70,45,20,0)');
    y.fillStyle = g; y.fillRect(0, 0, W / 2, H);
    return tex(c);
  });
}

/* ---------- procedural materials for the desk and the book ---------- */
function woodTexture() {
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
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
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
    const [lt, rt] = await floorTextures(d.floor.svg, d.texts);
    const pageGeo = new THREE.PlaneGeometry(PW * U, PD * U).rotateX(-Math.PI / 2);
    const pageMat = map => new THREE.MeshStandardMaterial({map, roughness: .95});
    const lp = new THREE.Mesh(pageGeo, pageMat(lt)); lp.position.set(-PW / 2 * U, .0004, 0); lp.receiveShadow = true; this.left.add(lp);
    const rp = new THREE.Mesh(pageGeo, pageMat(rt)); rp.position.set(PW / 2 * U, .0004, 0); rp.receiveShadow = true; g.add(rp);
    if (d.floorLit) {
      const [ll, rl] = await floorTextures(d.floorLit.svg);
      const litMat = map => new THREE.MeshBasicMaterial({map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending});
      const a = new THREE.Mesh(pageGeo, litMat(ll)); a.position.copy(lp.position).y += .0004; this.left.add(a);
      const b = new THREE.Mesh(pageGeo, litMat(rl)); b.position.copy(rp.position).y += .0004; g.add(b);
      this.floorLit = [a, b];
    }
    this.pieces = []; this.byId = {}; this.pick = []; this.tabs = [];
    await Promise.all(d.pieces.map(def => this.addPiece(def)));
    for (const c of d.controls || []) await this.addTab(c);
    for (const c of d.controls || []) this.applyTab(c.id, c.init || 0);
    this.e.scene.add(g);
    this.built = true;
  }

  async addPiece(def) {
    const p = {def, s: {...def}, parts: [], hop: 0, open: 0};
    this.pieces.push(p); if (def.id) this.byId[def.id] = p;
    if (def.type === 'box') return this.addBox(p, def);
    const tx = await pieceTextures(def.art), lit = def.artLit ? await plainTexture(def.artLit) : null;
    const front = new THREE.MeshStandardMaterial({map: tx.front, alphaTest: .5, roughness: .9, side: THREE.FrontSide, shadowSide: THREE.DoubleSide});
    const back = new THREE.MeshStandardMaterial({map: def.artBack ? await plainTexture(def.artBack) : tx.back, alphaTest: .5, roughness: .95, side: THREE.BackSide});
    const litMat = lit && new THREE.MeshBasicMaterial({map: lit, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4});
    const w = def.w ?? def.art.w, h = def.h ?? def.art.h;
    const part = geo => {
      const f = new THREE.Mesh(geo, front), b = new THREE.Mesh(geo, back);
      f.castShadow = true; f.receiveShadow = true;
      const pt = {front: f, back: b, lit: litMat ? new THREE.Mesh(geo, litMat) : null};
      for (const m of [f, b, pt.lit]) if (m) { m.matrixAutoUpdate = false; this.group.add(m); }
      f.userData = {piece: p, mask: tx.mask};
      if (def.tap || def.type === 'card') this.pick.push(f);
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
      part(a === 'left' ? planeGeo(0, w, 0, h) : a === 'right' ? planeGeo(-w, 0, 0, h) : planeGeo(-w / 2, w / 2, 0, h));
    } else {
      part(planeGeo(-w / 2, w / 2, 0, h));
      if (def.cross) part(planeGeo(-def.cross / 2, def.cross / 2, 0, h, (1 - def.cross / w) / 2, (1 + def.cross / w) / 2));
    }
    p.mats = {front, litMat};
  }
  async addBox(p, def) {
    const f = def.faces, w = def.w, d = def.d, h = def.h;
    for (const [k, fw, fh] of [['front', w, h], ['back', w, h], ['left', d, h], ['right', d, h], ['top', w, d]]) {
      if (!f[k]) { p.parts.push(null); continue; }
      const tx = await pieceTextures(f[k]), geo = planeGeo(-fw / 2, fw / 2, 0, fh);
      const fr = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({map: tx.front, alphaTest: .5, roughness: .9, side: THREE.FrontSide, shadowSide: THREE.DoubleSide}));
      const bk = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color: def.inside || '#e9dfc8', roughness: .95, side: THREE.BackSide}));
      fr.castShadow = true; fr.receiveShadow = true;
      for (const m of [fr, bk]) { m.matrixAutoUpdate = false; this.group.add(m); }
      fr.userData = {piece: p, mask: tx.mask};
      if (def.tap) this.pick.push(fr);
      p.parts.push({front: fr, back: bk, lit: null});
    }
    p.mats = {};
  }

  async addTab(c) {
    const art = this.e.tabArt(c.label || '拉'), t = await plainTexture(art);
    const m = new THREE.Mesh(planeGeo(-art.w / 2, art.w / 2, -art.h / 2, art.h / 2),
      new THREE.MeshStandardMaterial({map: t, roughness: .8}));
    m.matrixAutoUpdate = false; m.castShadow = true; m.userData = {tab: c};
    this.group.add(m); this.tabs.push({c, mesh: m, v: c.init || 0});
  }
  applyTab(id, v) {
    const t = this.tabs.find(t => t.c.id === id); if (!t) return;
    t.v = clamp(v, 0, 1); if (t.c.apply) t.c.apply(t.v, this.e.ctx(this));
  }

  // page frame for opening angle θ
  frame(theta) {
    const t = rad(theta);
    this.uL = V3(Math.cos(t), Math.sin(t), 0); this.nL = V3(Math.sin(t), -Math.cos(t), 0);
  }
  // flat-world vector (X, Y, Z) on page side → spread-local vector (no scaling)
  map(side, X, Y, Z) {
    return side === 'L' ? V3().addScaledVector(this.uL, -X).addScaledVector(this.nL, Y).add(V3(0, 0, Z)) : V3(X, Y, Z);
  }
  place(pt, o, ex, ey, show = true) {
    _z.crossVectors(ex, ey).normalize(); _m.makeBasis(ex, ey, _z).setPosition(o);
    for (const m of [pt.front, pt.back, pt.lit]) if (m) { m.matrix.copy(_m); m.matrixWorldNeedsUpdate = true; m.visible = show; }
  }

  update(theta, flip, dt) {
    const g = this.group;
    g.rotation.z = flip ? rad(180 - theta) : 0;
    this.left.rotation.z = rad(theta - 180);
    this.frame(theta);
    const rise = smooth(clamp((theta - 100) / 75, 0, 1)), shown = theta > 1.5;
    this.lit = lerp(this.lit, this.litTarget, 1 - Math.exp(-dt * 4));
    if (this.floorLit) this.floorLit.forEach(m => m.material.opacity = this.lit);
    for (const p of this.pieces) {
      const s = p.s, d = p.def;
      p.hop = Math.max(0, p.hop - dt / .45);
      p.open = lerp(p.open, s.opened ? 1 : 0, 1 - Math.exp(-dt * (d.speed || 7)));
      if (d.follow && this.byId[d.follow]) { const dl = d.delay || 0; s.u = smooth(clamp((this.byId[d.follow].open - dl) / (1 - dl), 0, 1)); }
      this.ease(p, dt);
      if (p.mats.litMat) p.mats.litMat.opacity = this.lit;
      if (d.type === 'v') this.updateV(p, theta, shown);
      else if (d.type === 'card') this.updateCard(p, shown);
      else if (d.type === 'custom') this.updateCustom(p, rise, shown);
      else if (d.type === 'box') this.updateBox(p, rise, shown);
      else if (d.type === 'zigzag') this.updateZigzag(p, rise, shown);
      else this.updateStand(p, rise, shown);
    }
    for (const t of this.tabs) {
      const c = t.c, side = c.X < 0 ? 'L' : 'R', dir = c.dir || [0, 0, 1];
      const o = this.map(side, c.X + dir[0] * c.len * t.v, .3, c.Z + dir[2] * c.len * t.v).multiplyScalar(U);
      const up = this.map(side, 0, 1, 0), ey = this.map(side, -dir[0], 0, -dir[2]).normalize(), ex = V3().crossVectors(ey, up);
      _m.makeBasis(ex, ey, up).setPosition(o); t.mesh.matrix.copy(_m); t.mesh.matrixWorldNeedsUpdate = true;
      t.mesh.visible = shown && theta > 150;
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
    const yaws = [s.yaw || 0]; if (p.def.cross) yaws.push((s.yaw || 0) + 90);
    yaws.forEach((yw, k) => {
      const y = rad(yw), ex1 = V3(Math.cos(y), 0, -Math.sin(y)), fb = V3(-Math.sin(y), 0, -Math.cos(y));
      const ey1 = fb.multiplyScalar(Math.cos(e)).add(V3(0, Math.sin(e), 0));
      // rock about the base point, within the piece's own plane
      const ex0 = ex1.clone().multiplyScalar(Math.cos(t)).addScaledVector(ey1, Math.sin(t));
      const ey0 = ey1.clone().multiplyScalar(Math.cos(t)).addScaledVector(ex1, -Math.sin(t));
      const hop = Math.sin(Math.PI * p.hop) * 2 + this.bob(p);
      const o = this.map(side, c.X + ey1.x * hop, c.Y + ey1.y * hop + .05 + k * .01, c.Z + ey1.z * hop).multiplyScalar(U);
      this.place(p.parts[k], o, this.map(side, ex0.x, ex0.y, ex0.z), this.map(side, ey0.x, ey0.y, ey0.z), shown && s.hidden !== true);
    });
  }
  updateBox(p, rise, shown) {
    const s = p.s, c = p.cur, side = c.X < 0 ? 'L' : 'R', y = rad(s.yaw || 0), hf = Math.max(.02, rise * c.raise);
    const cs = Math.cos(y), sn = Math.sin(y), b = this.bob(p);
    const at = (x, yy, z) => this.map(side, c.X + x * cs + z * sn, c.Y + b + yy + .05, c.Z - x * sn + z * cs).multiplyScalar(U);
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
    for (let k = 0; k < n; k++) {
      const th = rad(k % 2 ? -phi : phi), ex0 = V3(Math.cos(th), 0, -Math.sin(th)), fb = V3(-Math.sin(th), 0, -Math.cos(th));
      const ey0 = fb.multiplyScalar(Math.cos(e)).add(V3(0, Math.sin(e), 0));
      const o = this.map(side, c.X + pts[k][0] - ox, c.Y + .05 + k * .01, c.Z + pts[k][1] - oz).multiplyScalar(U);
      this.place(p.parts[k], o, this.map(side, ex0.x, ex0.y, ex0.z), this.map(side, ey0.x, ey0.y, ey0.z), shown && rise > .02);
    }
  }
  updateCard(p, shown) {
    // lies flat; hinged along its far edge, lifts toward the far side when opened
    const s = p.s, side = s.X < 0 ? 'L' : 'R', a = rad((s.max ?? 150) * smooth(p.open)), dz = V3(0, Math.sin(a), Math.cos(a));
    const hinge = V3(s.X, (s.Y || 0) + .12, s.Z - s.h / 2), o0 = hinge.clone().addScaledVector(dz, s.h);
    const ey0 = dz.clone().negate();
    this.place(p.parts[0], this.map(side, o0.x, o0.y, o0.z).multiplyScalar(U), this.map(side, 1, 0, 0), this.map(side, ey0.x, ey0.y, ey0.z), shown);
  }
  updateCustom(p, rise, shown) {
    const pose = p.def.pose(p.s, rise, p);
    if (!pose) { this.place(p.parts[0], V3(), V3(1, 0, 0), V3(0, 1, 0), false); return; }
    const side = p.s.page || (pose.o[0] < 0 ? 'L' : 'R');
    this.place(p.parts[0], this.map(side, ...pose.o).multiplyScalar(U), this.map(side, ...pose.x).normalize(), this.map(side, ...pose.y).normalize(), shown && rise > .97);
  }
}

/* ---------- the reader ---------- */
export async function createReader({canvas, book, ui}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#171009');
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 40);

  const hemi = new THREE.HemisphereLight('#fff4e0', '#3a2a1e', .6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
  sun.position.set(-1.5, 3.2, 2.1); sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -1.6, right: 1.6, top: 1.4, bottom: -1.4, near: .5, far: 8});
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .012;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#ffe9d0', .35); fill.position.set(2, 1.5, 1); scene.add(fill);

  const desk = new THREE.Mesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({map: woodTexture(), roughness: .62}));
  desk.receiveShadow = true; scene.add(desk);

  /* book body: right half stays on the desk, the left half turns with the cover */
  const cloth = new THREE.MeshStandardMaterial({map: clothTexture(book.color || '#6b1e2a'), roughness: .85});
  const edge = new THREE.MeshStandardMaterial({map: edgeTexture(), roughness: .95});
  const paper = new THREE.MeshStandardMaterial({color: '#f3ebda', roughness: .95});
  const bw = PW * U + .03, bd = PD * U + .05;
  const blockGeo = new THREE.BoxGeometry(PW * U, T - BT - .002, PD * U);
  const boardGeo = new THREE.BoxGeometry(bw, BT, bd);
  const blockMats = [edge, paper, paper, paper, edge, edge];
  const rightHalf = new THREE.Group(); scene.add(rightHalf);
  const rb = new THREE.Mesh(boardGeo, cloth); rb.position.set(bw / 2, BT / 2, 0);
  const rk = new THREE.Mesh(blockGeo, blockMats); rk.position.set(PW / 2 * U, BT + (T - BT) / 2 - .001, 0);
  rightHalf.add(rb, rk);
  const leftHalf = new THREE.Group(); leftHalf.position.set(0, T, 0); scene.add(leftHalf);
  const coverTex = book.cover ? await coverTexture(book) : null;
  const coverMat = coverTex ? new THREE.MeshStandardMaterial({map: coverTex, roughness: .8}) : cloth;
  const lb = new THREE.Mesh(boardGeo, [cloth, cloth, cloth, coverMat, cloth, cloth]); lb.position.set(-bw / 2, -T + BT / 2, 0);
  const lk = new THREE.Mesh(blockGeo, [paper, edge, paper, paper, edge, edge]); lk.position.set(-PW / 2 * U, -(T - BT) / 2 - .001, 0);
  leftHalf.add(lb, lk);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(.012, 2 * T, bd), cloth); spine.position.set(-.006, T, 0); scene.add(spine);
  for (const m of [rb, rk, lb, lk, spine]) { m.castShadow = true; m.receiveShadow = true; }

  /* camera orbit */
  const target = V3(.5, .05, .02), targetGoal = target.clone();
  const view = {az: 0, pol: rad(50), r: 2.6}, goal = {...view};
  let fit = 2.6;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const hf = 2 * Math.atan(Math.tan(rad(camera.fov / 2)) * camera.aspect);
    fit = Math.max(2.3, 1.22 / Math.tan(hf / 2) + .25);
    goal.r = clamp(goal.r, fit * .55, fit * 1.5);
  }
  function resetView(open = cur >= 0) {
    goal.az = 0; goal.pol = rad(open ? 52 : 46); goal.r = open ? fit * 1.02 : fit * .78;
    targetGoal.set(open ? 0 : .52, open ? .13 : .05, open ? .02 : 0);
  }

  /* state */
  const spreads = book.spreads.map((d, i) => new Spread(engine(), d, i));
  let coverTheta = 0, cur = -1, turn = null, busy = false;
  const light = {...LIGHTS[book.spreads[0].light || 'morning']}, lightGoal = {...light};
  function setLight(p) { Object.assign(lightGoal, p); }

  function engine() {
    return {
      scene,
      tabArt: label => ({w: 6, h: 14, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 140" width="60" height="140">
        <rect x="3" y="2" width="54" height="136" rx="12" fill="#b8372f"/><rect x="3" y="2" width="54" height="136" rx="12" fill="none" stroke="#7d221d" stroke-width="3"/>
        ${[...label].map((ch, i) => `<text x="30" y="${38 + i * 26}" text-anchor="middle" font-size="22" fill="#fbf2e2" font-family="sans-serif" font-weight="700">${ch}</text>`).join('')}
        <path d="M30,${54 + label.length * 22} v32 m-11,-11 l11,11 l11,-11" fill="none" stroke="#fbf2e2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`}),
      ctx: sp => ctxFor(sp),
    };
  }
  let actx;
  function ctxFor(sp) {
    return {
      note: (text, ev) => ui.note(text, ev ? ev.clientX : innerWidth / 2, ev ? ev.clientY : innerHeight / 2),
      hop: id => { const p = sp.byId[id]; if (p) p.hop = 1; },
      set: (id, props) => { const p = sp.byId[id]; if (p) Object.assign(p.s, props); },
      get: id => sp.byId[id] && sp.byId[id].s,
      toggle: id => { const p = sp.byId[id]; if (p) p.s.opened = !p.s.opened; },
      once: key => { sp.flags = sp.flags || {}; if (sp.flags[key]) return false; return sp.flags[key] = true; },
      lights: v => { sp.litTarget = v === 'toggle' ? (sp.litTarget > .5 ? 0 : 1) : v; },
      light: (a, b, t) => { const A = LIGHTS[a], B = LIGHTS[b || a]; t = t ?? 0;
        if (sp.index === cur) setLight({dir: mix(A.dir, B.dir, t), di: lerp(A.di, B.di, t), hemi: lerp(A.hemi, B.hemi, t), sky: mix(A.sky, B.sky, t), exp: lerp(A.exp, B.exp, t)}); },
      bong,
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
    cur = i;
    const d = book.spreads[Math.max(0, i)];
    setLight({...LIGHTS[d.light || 'morning']});
    ui.state({cur, total: spreads.length, spread: i >= 0 ? d : null, open: i >= 0});
    preload(i + 1); preload(i - 1);
  }
  function animate(ms, step) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = 1;
    return new Promise(res => { turn = {t0: performance.now(), ms, step, res}; });
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  async function open() {
    if (busy || cur >= 0) return; busy = true;
    await ensure(0);
    resetView(true);
    await animate(1700, t => { coverTheta = 180 * ease(t); });
    enter(0); busy = false;
  }
  async function close() {
    if (busy || cur < 0) return; busy = true;
    if (cur > 0) { await go(0, true); }
    await animate(1300, t => { coverTheta = 180 * (1 - ease(t)); });
    cur = -1; resetView(false); ui.state({cur: -1, total: spreads.length, spread: null, open: false}); busy = false;
  }
  async function go(i, inner) {
    if ((busy && !inner) || i === cur || i < 0 || i >= spreads.length || cur < 0) return;
    busy = true;
    while (cur !== i) {
      const fwd = i > cur, a = spreads[cur], n = fwd ? cur + 1 : cur - 1;
      await ensure(n); const b = spreads[n];
      turnPair = {a, b, fwd};
      await animate(1500, t => { turnPair.t = ease(t); });
      turnPair = null; enter(n);
    }
    busy = inner ? busy : false;
  }
  let turnPair = null;

  /* pointer: tabs and taps first, otherwise orbit */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pointers = new Map(); let drag = null, pinch = null;
  function pick(e, list) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const h of ray.intersectObjects(list, false)) {
      const m = h.object.userData.mask;
      if (!m || (h.uv && m.at(h.uv.x, h.uv.y) > 100)) return h;
    }
    return null;
  }
  const screenOf = v => { const p = v.clone().project(camera), r = canvas.getBoundingClientRect(); return [(p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height]; };
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), r: goal.r}; drag = null; return; }
    const sp = cur >= 0 && !busy ? spreads[cur] : null;
    if (sp) {
      const th = pick(e, sp.tabs.map(t => t.mesh));
      if (th) {
        const t = sp.tabs.find(t => t.mesh === th.object), c = t.c, side = c.X < 0 ? 'L' : 'R', dir = c.dir || [0, 0, 1];
        const w0 = sp.map(side, c.X, .3, c.Z).multiplyScalar(U).applyMatrix4(sp.group.matrixWorld);
        const w1 = sp.map(side, c.X + dir[0] * c.len, .3, c.Z + dir[2] * c.len).multiplyScalar(U).applyMatrix4(sp.group.matrixWorld);
        const a = screenOf(w0), b = screenOf(w1), r = canvas.getBoundingClientRect();
        drag = {tab: t, sp, a, b, x0: e.clientX - r.left, y0: e.clientY - r.top, v0: t.v};
        ui.hint(null); return;
      }
      const ph = pick(e, sp.pick);
      drag = {orbit: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, tap: ph, sp};
      return;
    }
    if (cur < 0 && !busy && pick(e, [lb])) { drag = {cover: true, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, orbit: true}; return; }
    drag = {orbit: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY};
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; goal.r = clamp(pinch.r * pinch.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])), fit * .55, fit * 1.5); return; }
    if (!drag) return;
    if (drag.tab) {
      const r = canvas.getBoundingClientRect(), [ax, ay] = drag.a, [bx, by] = drag.b;
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
      const v = drag.v0 + ((e.clientX - r.left - drag.x0) * dx + (e.clientY - r.top - drag.y0) * dy) / L;
      drag.sp.applyTab(drag.tab.c.id, v);
      return;
    }
    goal.az = clamp(goal.az - (e.clientX - drag.x) * .005, -1.1, 1.1);
    goal.pol = clamp(goal.pol - (e.clientY - drag.y) * .004, .3, 1.25);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const end = e => {
    pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
    const d = drag; drag = null; if (!d) return;
    const still = Math.hypot(e.clientX - (d.sx ?? e.clientX), e.clientY - (d.sy ?? e.clientY)) < 6;
    if (d.cover && still) { open(); return; }
    if (d.tap && still) {
      const p = d.tap.object.userData.piece;
      if (p.def.type === 'card') { p.s.opened = !p.s.opened; if (p.def.tap) p.def.tap(ctxFor(d.sp), e); }
      else p.def.tap(ctxFor(d.sp), e);
      ui.hint(null);
    }
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => { e.preventDefault(); goal.r = clamp(goal.r * Math.exp(e.deltaY * .001), fit * .55, fit * 1.5); }, {passive: false});
  canvas.addEventListener('dblclick', () => resetView());

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

  /* frame loop */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (turn) { const t = clamp((now - turn.t0) / turn.ms, 0, 1); turn.step(t); if (t >= 1) { const r = turn.res; turn = null; r(); } }
    // light
    const k = 1 - Math.exp(-dt * 3);
    for (const key of ['di', 'hemi', 'exp']) light[key] = lerp(light[key], lightGoal[key], k);
    light.dir = mix(light.dir, lightGoal.dir, k); light.sky = mix(light.sky, lightGoal.sky, k);
    sun.color.set(light.dir); sun.intensity = light.di; hemi.intensity = light.hemi; hemi.color.set(light.sky);
    renderer.toneMappingExposure = light.exp;
    // camera
    for (const key of ['az', 'pol', 'r']) view[key] = lerp(view[key], goal[key], 1 - Math.exp(-dt * 6));
    target.lerp(targetGoal, 1 - Math.exp(-dt * 4));
    camera.position.set(target.x + view.r * Math.sin(view.pol) * Math.sin(view.az), target.y + view.r * Math.cos(view.pol), target.z + view.r * Math.sin(view.pol) * Math.cos(view.az));
    camera.lookAt(target);
    // book and spreads
    leftHalf.rotation.z = rad((cur < 0 || (cur === 0 && turnPair === null && coverTheta < 180) ? coverTheta : 180) - 180);
    spine.visible = coverTheta < 25 && cur < 0;
    spreads.forEach(s => { if (s.built) s.group.visible = false; });
    if (turnPair) {
      const {a, b, fwd, t = 0} = turnPair;
      // forward: a's right page lifts and turns left (a flipped), b opens underneath; backward: the mirror image
      if (fwd) { a.group.visible = b.group.visible = true; a.update(180 - 180 * t, true, dt); b.update(180 * t, false, dt); }
      else { a.group.visible = b.group.visible = true; a.update(180 - 180 * t, false, dt); b.update(180 * t, true, dt); }
    } else if (cur < 0 || (cur === 0 && coverTheta < 180)) {
      const s = spreads[0]; if (s.built) { s.group.visible = coverTheta > .5; s.update(coverTheta, false, dt); }
    } else if (spreads[cur].built) { spreads[cur].group.visible = true; spreads[cur].update(180, false, dt); }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  new ResizeObserver(resize).observe(canvas); resize(); resetView();
  Object.assign(view, goal); target.copy(targetGoal);
  ui.state({cur: -1, total: spreads.length, spread: null, open: false});
  requestAnimationFrame(frame);
  spreads[0].build();

  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea')) return;
    if (e.key === 'ArrowRight') cur < 0 ? open() : go(cur + 1);
    if (e.key === 'ArrowLeft') cur > 0 ? go(cur - 1) : close();
  });

  return {open, close, next: () => go(cur + 1), prev: () => cur > 0 ? go(cur - 1) : close(), go, resetView: () => resetView(),
    get cur() { return cur; }, get busy() { return busy; }, spreads,
    // test hook: drag a tab programmatically
    pull: (id, v) => cur >= 0 && spreads[cur].applyTab(id, v)};
}

async function coverTexture(book) {
  const c = book.cover, img = await loadSVG(c.svg), W = 1030, H = 1350;
  const cv = canvasOf(W, H), x = cv.getContext('2d');
  // the board is turned over when closed, so the cover is drawn rotated half a turn
  x.translate(W, H); x.scale(-1, -1); x.drawImage(img, 0, 0, W, H);
  return tex(cv);
}
