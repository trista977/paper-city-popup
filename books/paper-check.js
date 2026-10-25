/* Paper-engineering check for a 3D pop-up book: can every piece actually be made from card and fold flat?
   Works on the book's data (no rendering). Flat-world units as in book3d.js: X across the spread (spine at 0, pages
   ±100), Z along the spine (far edge -65, near edge +65). Returns one row per piece. */

const PW = 100, PD = 65;
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
