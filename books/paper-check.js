/* Paper-engineering check for a 3D pop-up book: can every piece actually be made from card and fold flat?
   Works on the book's data (no rendering). Flat-world units as in book3d.js: X across the spread (spine at 0, pages
   ±100), Z along the spine (far edge -65, near edge +65). Returns one row per piece. */

const PW = 100, PD = 65;
const f1 = v => (Math.round(v * 10) / 10).toString();
const rad = d => d * Math.PI / 180;

// footprint of a piece once the book is closed, as [X, Z] corners on its page
function footprint(d) {
  const w = d.w ?? d.art?.w ?? 0, h = d.h ?? d.art?.h ?? 0;
  if (d.type === 'stand' || d.type === 'box') {
    const y = rad(d.yaw || 0), ex = [Math.cos(y), -Math.sin(y)];
    // reader-facing pieces fold forward (toward the reader); walls fold away from the spine
    const fold = foldDir(d), depth = d.type === 'box' ? (d.d || 0) : 0, H = d.type === 'box' ? d.h + depth : h;
    const b = [d.X - fold[0] * depth / 2, d.Z - fold[1] * depth / 2], hw = (d.type === 'box' ? d.w : w) / 2;
    const pts = [[b[0] - ex[0] * hw, b[1] - ex[1] * hw], [b[0] + ex[0] * hw, b[1] + ex[1] * hw]];
    pts.push([pts[0][0] + fold[0] * H, pts[0][1] + fold[1] * H], [pts[1][0] + fold[0] * H, pts[1][1] + fold[1] * H]);
    if (d.cross) { const c = d.cross / 2; pts.push([d.X - fold[0] * 0 + fold[1] * c, d.Z]); }
    return pts;
  }
  if (d.type === 'v') {
    // the panel folds down beside its glue lines, toward the reader when sigma < 0
    const s = rad(d.sigma), dir = Math.sign(d.sigma) < 0 ? 1 : -1, n = [-Math.sin(s) * dir, Math.cos(s) * dir];
    const H = d.art.h + (d.lift || 0), pts = [];
    for (const [sx, half] of [[-1, d.wl], [1, d.wr]]) {
      const g = [sx * Math.cos(s), Math.sin(s)];
      pts.push([0, d.Z], [g[0] * half, d.Z + g[1] * half], [n[0] * sx * H, d.Z + n[1] * H], [g[0] * half + n[0] * sx * H, d.Z + g[1] * half + n[1] * H]);
    }
    return pts;
  }
  return null;
}
// which way a standing piece falls when the book closes
export function foldDir(d) {
  const y = rad(d.yaw || 0), ex = [Math.cos(y), -Math.sin(y)];
  const facingReader = Math.abs(ex[0]) > .5;                   // base runs across the page
  if (facingReader) return [0, 1];                             // falls forward, its strut hidden behind it
  const out = Math.sign(d.X) || 1;                             // walls fall away from the spine
  const n = [-ex[1], ex[0]];
  return n[0] * out > 0 ? n : [-n[0], -n[1]];
}

export function paperCheck(book) {
  const rows = [];
  book.spreads.forEach((sp, si) => {
    const ids = new Set(sp.pieces.map(p => p.id));
    for (const d of sp.pieces) {
      const r = {spread: si, id: d.id, type: d.type, issues: [], mechanism: ''};
      const side = Math.sign(d.X ?? 0);
      const fp = footprint(d);
      if (fp) for (const [x, z] of fp) {
        if (Math.abs(z) > PD + .01) { r.issues.push(`合书时伸出书页（${z > 0 ? '下' : '上'}边缘，Z=${z.toFixed(1)}）`); break; }
        if (Math.abs(x) > PW + .01) { r.issues.push(`合书时伸出书页（外侧边缘，X=${x.toFixed(1)}）`); break; }
        if (d.type !== 'v' && side && Math.sign(x) && Math.sign(x) !== side && Math.abs(x) > .5) { r.issues.push('合书时越过书脊'); break; }
      }
      if (d.type === 'v') r.mechanism = 'V 折：跨书脊，翻开时自己立起';
      else if (d.type === 'stand' || d.type === 'box') {
        if ((d.Y || 0) > .5 && !d.parent) r.issues.push('悬空：底边没有粘在页面上，需要支撑');
        const f = foldDir(d);
        r.mechanism = f[1] === 1 ? '单页立片：底边铰接，背后一根撑条连到对页，翻开时被拉起、合书时向前倒平'
          : '侧墙：底边铰接，撑条跨过书脊连到对页';
        if (d.parent) r.mechanism = `附在「${d.parent}」上的折片，随它一起折叠`;
      } else if (d.type === 'card') r.mechanism = '翻盖：顶边铰接，平放在页面上';
      else if (d.type === 'custom') {
        if (d.parent && !ids.has(d.parent)) r.issues.push(`找不到所附着的纸片「${d.parent}」`);
        r.mechanism = d.parent ? `铆钉/铰接在「${d.parent}」上，随它一起折叠` : d.dial ? '铆钉转盘：平放在页面上' : '平放的活动纸片（滑槽或铰链）';
      }
      if (d.type === 'custom' && d.pose) { try { const o = d.pose({...d}, 1, {open: 0}).o; if (o[1] > .6 && !d.parent) r.issues.push('离开页面的部件没有附着在任何纸片上（合书时无处可折）'); } catch (e) {} }
      if (d.bob || d.rock) r.issues.push('动作做不出来：纸片不能自己上下浮动或摇晃');
      if (d.tick && d.type === 'v') r.issues.push('动作做不出来：V 折的角度不能自己改变');
      rows.push(r);
    }
  });
  return rows;
}

/* ---------- structure report: for every piece, where it folds, what lifts it, and where it lies once closed ----------
   Layers count up from the page: 1 lies on the paper, higher numbers lie on top. A piece that falls (forward, or
   outward for walls, toward the reader for V-folds) over another piece's flattened footprint lies on top of it;
   two pieces that would each fall on the other's hinge cross through each other and are reported as an issue. */
const hull = pts => { const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1)); };
const overlap = (A, B) => { // separating-axis test on two convex polygons, shrunk a little so touching edges don't count
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], n = [a[1] - b[1], b[0] - a[0]];
    const pa = A.map(q => q[0] * n[0] + q[1] * n[1]), pb = B.map(q => q[0] * n[0] + q[1] * n[1]), L = Math.hypot(...n) * .6;
    if (Math.max(...pa) - L < Math.min(...pb) || Math.max(...pb) - L < Math.min(...pa)) return false; }
  return true; };
// the hinge (base line) and the direction a piece falls in when the book closes
function hinge(d) {
  if (d.type === 'v') { const s = rad(d.sigma); return {pts: [[-Math.cos(s) * d.wl, d.Z + Math.sin(s) * d.wl], [0, d.Z], [Math.cos(s) * d.wr, d.Z + Math.sin(s) * d.wr]], fall: [0, Math.sign(d.sigma) < 0 ? 1 : -1]}; }
  const w = (d.type === 'box' ? d.w : d.w ?? d.art?.w ?? 0) / 2, y = rad(d.yaw || 0), ex = [Math.cos(y), -Math.sin(y)];
  return {pts: [[d.X - ex[0] * w, d.Z - ex[1] * w], [d.X + ex[0] * w, d.Z + ex[1] * w]], fall: foldDir(d)};
}
// hinge points sampled along the base (ends and middles)
const samples = h => h.pts.flatMap((p, i) => i ? [[(p[0] + h.pts[i - 1][0]) / 2, (p[1] + h.pts[i - 1][1]) / 2], p] : [p]);
const inside = (P, q) => { let sgn = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length];
  const c = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]); if (Math.abs(c) < 1) return false; if (sgn && Math.sign(c) !== sgn) return false; sgn = Math.sign(c); }
  return true; };
const covers = (P, h) => samples(h).some(q => inside(P, q));
// is h2's hinge further along h's falling direction than h's own hinge?
const ahead = (h, h2) => { const c = q => q.reduce((m, p) => [m[0] + p[0] / q.length, m[1] + p[1] / q.length], [0, 0]), a = c(h.pts), b = c(h2.pts);
  return (b[0] - a[0]) * h.fall[0] + (b[1] - a[1]) * h.fall[1] > 0; };

export function structureReport(book) {
  const out = [];
  book.spreads.forEach((sp, si) => {
    const ds = sp.pieces, byId = Object.fromEntries(ds.map(d => [d.id, d]));
    const solid = ds.filter(d => (d.type === 'stand' || d.type === 'box' || d.type === 'v') && !d.parent && Math.abs(d.Y || 0) <= .3);
    const polys = d => { const p = footprint(d); return d.type === 'v' ? [hull(p.slice(0, 4)), hull(p.slice(4))] : [hull(p)]; };
    const fp = new Map(solid.map(d => [d, polys(d)]));
    const hit = (A, B) => A.some(a => B.some(b => overlap(a, b))), coversAny = (A, h) => A.some(a => covers(a, h));
    // above[a] = pieces a lies on top of
    const above = new Map(solid.map(d => [d, new Set()])), cross = [];
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i], b = solid[j];
      if (a.type !== 'v' && b.type !== 'v' && Math.sign(a.X) !== Math.sign(b.X)) continue;
      if (!hit(fp.get(a), fp.get(b))) continue;
      // a piece whose flattened panel covers the other's glued hinge lies on top of it; if each covers the other's
      // hinge they would have to pass through each other
      const ha = hinge(a), hb = hinge(b), ab = coversAny(fp.get(a), hb), ba = coversAny(fp.get(b), ha);
      if (ab && ba) cross.push([a.id, b.id]);
      else if (ab || (!ba && ahead(ha, hb))) above.get(a).add(b); else above.get(b).add(a);
    }
    const layer = new Map(), depth = d => { if (layer.has(d)) return layer.get(d); layer.set(d, 1); const L = 1 + Math.max(0, ...[...above.get(d)].map(depth)); layer.set(d, L); return L; };
    solid.forEach(depth);
    const rootOf = d => d.parent ? rootOf(byId[d.parent]) : d;
    for (const d of ds) {
      const h = (d.type === 'stand' || d.type === 'box' || d.type === 'v') ? hinge(d) : null;
      let fold, driver;
      if (d.parent) {
        fold = `${d.type === 'custom' && d.pose ? '铰接 / 铆在' : '粘在'}「${d.parent}」上${d.parentPart !== undefined ? `（${d.parentPart ? '右' : '左'}半）` : ''}`;
        driver = d.dial ? '手指绕圈转（铆钉）' : d.tick ? '随父纸片折叠；自身由点击 / 拉片带动' : '随父纸片一起立起、折平';
      } else if (d.type === 'v') {
        fold = `V 折：书脊 Z=${f1(d.Z)} 处起，左右粘贴线各长 ${f1(d.wl)} / ${f1(d.wr)}，与书脊法线成 ${f1(Math.abs(d.sigma))}°`;
        driver = '书页张开，两条粘贴线拉开，自己立起';
      } else if (d.type === 'stand') {
        fold = `底边 (${f1(h.pts[0][0])}, ${f1(h.pts[0][1])}) – (${f1(h.pts[1][0])}, ${f1(h.pts[1][1])})${Math.abs(d.Y || 0) > .3 ? `，在页面上方 ${f1(d.Y)}` : ''}`;
        const facing = h.fall[1] === 1;
        driver = d.drag ? `拖动 / 拉片「${d.drag}」在槽里滑动；开书时${facing ? '背后撑条' : '跨书脊撑条'}拉起` : d.raise !== undefined ? '拉片控制立起角度' : facing ? '开书时背后的撑条从对页拉起' : '开书时跨书脊的撑条拉起';
      } else if (d.type === 'box') {
        fold = `箱形折：前后两条底边，宽 ${f1(d.w)}、深 ${f1(d.d)}、高 ${f1(d.h)}`;
        driver = d.drag ? `两侧页面拉开盒子；拖动 / 拉片「${d.drag}」沿轨道滑` : '两侧页面拉开盒子';
      } else if (d.type === 'custom') {
        fold = d.dial ? '铆钉：平放在页面上转' : '平放在页面上（铰链 / 滑槽 / 口袋）';
        driver = d.dial ? '手指绕圈转' : d.drag ? `拖动 / 拉片「${d.drag}」` : '点击';
      } else { fold = '平放'; driver = '点击'; }
      if (d.driver) driver = d.driver;
      const r = rootOf(d), L = layer.get(r);
      const on = L ? [...above.get(r)].map(x => x.id) : [], under = L ? solid.filter(x => above.get(x).has(r)).map(x => x.id) : [];
      const closed = d.parent ? `贴着「${r.id}」折平（第 ${L ?? 1} 层）` : L ? `第 ${L} 层${on.length ? `，压在 ${on.join('、')} 上` : '，直接贴着页面'}${under.length ? `；被 ${under.join('、')} 盖住` : ''}` : '第 1 层（平放在页面上）';
      out.push({spread: si, title: sp.title, id: d.id, type: d.type, fold, driver, closed,
        issues: cross.filter(c => c.includes(d.id)).map(c => `合书时和「${c[0] === d.id ? c[1] : c[0]}」互相穿插`)});
    }
  });
  return out;
}
