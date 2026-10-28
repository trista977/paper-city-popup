/* The share cards, for memory.html and the mini tool alike. 1080 × 1440 at 2×.
   pageCard: one page — a close-up polaroid of the page's own framing above, the whole open spread below, on paper,
   with the page's Chinese title first, its English name small, one line about it and a quiet author credit.
   coverCard: the cover of a set — one big line in Chinese over the four stops in a 2 × 2 grid (a still pre-rendered by
   tools/render-share-grid.mjs, so the cover doesn't need every page built), for a feed where it shows half a screen
   wide. */

export const AUTHOR = 'Trista Hu';
const SERIF = '"Cormorant Garamond", Georgia, serif', INK = '#2e2218', BROWN = '#6d5a44', RED = '#9a3a2e';
// the grid still; the mini tool build swaps this line for the picture inlined as a data URL
const GRID = new URL('./assets/share-grid.jpg', import.meta.url).href;
export const GRID_TILE = {w: 800, h: 600};

// the close-up for a page: its own camera for the card (shareView: az, pol, r, a target point or a piece to focus on,
// lit) if it has one, else its signature piece close in
export function closeView(sp, i) {
  const sv = sp.shareView, focus = sv ? sv.focus || null : sp.signature || (i === 0 ? 'file' : null);
  return {focus, view: sv || (focus ? {} : {az: 24, pol: 40, r: .62}), lit: !!(sv && sv.lit)};
}

function paper(W, H, k) {
  const c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
  const x = c.getContext('2d'); x.scale(k, k);
  // paper, with a soft light and a double frame
  x.fillStyle = '#f3ead8'; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W * .2, H * .1, 0, W * .2, H * .1, W); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#b9a37a'; x.lineWidth = 2; x.strokeRect(22, 22, W - 44, H - 44); x.strokeStyle = '#d6c4a0'; x.lineWidth = 1; x.strokeRect(31, 31, W - 62, H - 62);
  const text = (t, X, Y, font, color, align = 'left', ls = 0) => { x.font = font; x.fillStyle = color; x.textAlign = align; if ('letterSpacing' in x) x.letterSpacing = ls + 'px'; x.fillText(t, X, Y); if ('letterSpacing' in x) x.letterSpacing = '0px'; };
  return {c, x, text};
}

// A quiet colophon, aligned with the page's text margin.
function signature(text, W, H) {
  text(`by ${AUTHOR}`, W - 70, H - 58, `italic 400 20px ${SERIF}`, '#8a7964', 'right');
}

// These are real interactions defined by memory-london.js, rather than decorative landmarks.
const PLAY = [
  [{id: 'file', icon: '↔', label: '拉开卡片盒'}, {id: 'lid', icon: '☝︎', label: '点开路线'}],
  [{id: 'dino', icon: '↔', label: '拉起恐龙'}, {id: 'whale', icon: '☝︎', label: '轻点摆鳍'}, {id: 'leaf0', icon: '☝︎', label: '翻开小册'}],
  [{id: 'clockFace', icon: '↻', label: '拨动时间'}, {id: 'boat', icon: '↔', label: '拖动游船'}, {id: 'cam', icon: '☝︎', label: '点按出片'}],
  [{id: 'bus', icon: '↔', label: '拖动巴士'}, {id: 'me', icon: '↔', label: '拉动相遇'}, {id: 'env', icon: '☝︎', label: '点开戏票'}],
  [{id: 'crank', icon: '↻', label: '转动开桥'}, {id: 'factsKnob', icon: '↻', label: '转动读小知识'}],
];

// Keep the hint outside the object's silhouette. Coordinates come from the exact export camera.
function playHints(x, text, image, hints, X, Y, W, H, sc) {
  const placed = [];
  for (const hint of hints) {
    const anchor = image.anchors?.[hint.id];
    if (!anchor || !anchor.visible) continue;
    const px = X + anchor.x * W, py = Y + anchor.y * H;
    x.font = `500 15px ${sc}`;
    const width = 28 + x.measureText(hint.label).width;
    const lx = Math.max(X + 8, Math.min(X + W - width - 8, px - width / 2));
    let ly = Math.min(Y + H - 14, Y + anchor.bottom * H + 23);
    // Avoid collisions when two mechanisms sit close together.
    while (placed.some(p => lx < p.x + p.w + 8 && lx + width + 8 > p.x && Math.abs(ly - p.y) < 28)) ly -= 30;
    ly = Math.max(Y + 28, ly);
    placed.push({x: lx, y: ly, w: width});
    x.save();
    x.fillStyle = 'rgba(253,250,243,.9)'; x.fillRect(lx - 5, ly - 21, width + 10, 28);
    text(hint.icon, lx, ly, '400 24px Georgia, serif', RED);
    text(hint.label, lx + 28, ly - 2, `500 15px ${sc}`, BROWN);
    x.restore();
  }
}

// text in at most `max` lines of width maxW: a line never starts with a comma or full stop (punctuation stays on the
// line before), and a longer text ends the last line with an ellipsis
function wrap(x, s, font, maxW, max) {
  x.font = font; const rows = []; let line = '';
  for (const ch of s) { if (x.measureText(line + ch).width > maxW && !'，。、；：！？）》」'.includes(ch)) { rows.push(line); line = ''; } line += ch; }
  if (line) rows.push(line);
  if (rows.length > max) { let r = rows[max - 1].replace(/[，。、；：！？]+$/, ''); while (x.measureText(r + '…').width > maxW) r = r.slice(0, -1); rows.splice(max - 1, rows.length, r + '…'); }
  return rows;
}

export function pageCard({reader, book, sc}) {
  const i = reader.cur, sp = book.spreads[i]; if (i < 0) return null;
  const cv = closeView(sp, i), PW = 900, PH = 440;
  // The wide photo needs a little more room than the cover's 4:3 tiles.
  const photoView = {...cv, view: {...cv.view, r: (cv.view.r || .42) * 1.16}};
  if (i === 4) photoView.view.target = [.1, .32, -.08];
  const hints = PLAY[i] || [];
  const wide = reader.snapshot({w: 1600, h: 900, lit: cv.lit, anchors: hints.map(h => h.id)}), close = reader.snapshot({w: 1600, h: Math.round(1600 * (PH - 28) / (PW - 28)), ...photoView});
  if (!wide || !close) return null;
  const W = 1080, H = 1440, {c, x, text} = paper(W, H, 2);
  text(`MEMORY IN LONDON  ·  ${i ? `STOP ${i} / ${book.spreads.length - 1}` : 'THE ROUTE'}`, W / 2, 62, `600 20px ${SERIF}`, '#8a6d48', 'center', 6);
  // the polaroid: the page's close-up, taped on at a slant
  x.save(); x.translate(W / 2, 132 + PH / 2); x.rotate(-2.2 * Math.PI / 180);
  x.shadowColor = 'rgba(60,40,20,.22)'; x.shadowBlur = 24; x.shadowOffsetY = 10; x.fillStyle = '#fffdf8'; x.fillRect(-PW / 2, -PH / 2, PW, PH + 32); x.shadowColor = 'transparent';
  const iw = PW - 28, ih = PH - 28, s = Math.max(iw / close.width, ih / close.height);
  x.save(); x.beginPath(); x.rect(-PW / 2 + 14, -PH / 2 + 14, iw, ih); x.clip();
  x.drawImage(close, -PW / 2 + 14 + (iw - close.width * s) / 2, -PH / 2 + 14 + (ih - close.height * s) / 2, close.width * s, close.height * s); x.restore();
  text(sp.eyebrow, -PW / 2 + 18, PH / 2 + 18, `italic 600 22px ${SERIF}`, BROWN);
  x.fillStyle = 'rgba(214,190,140,.65)';
  x.save(); x.translate(-PW / 2 + 100, -PH / 2 + 8); x.rotate(-.07); x.fillRect(-60, -17, 120, 34); x.restore();
  x.save(); x.translate(PW / 2 - 100, -PH / 2 + 8); x.rotate(.06); x.fillRect(-60, -17, 120, 34); x.restore();
  x.restore();
  // the whole spread in a white frame
  const fy = 654, fw = W - 100, fh = Math.round(fw * 9 / 16);
  x.shadowColor = 'rgba(40,25,10,.3)'; x.shadowBlur = 30; x.shadowOffsetY = 14; x.fillStyle = '#fffdf8'; x.fillRect(50, fy, fw, fh); x.shadowColor = 'transparent';
  x.drawImage(wide, 60, fy + 10, fw - 20, fh - 20);
  playHints(x, text, wide, hints, 60, fy + 10, fw - 20, fh - 20, sc);
  // names: the Chinese title leads, the English name and the station small beside it, then one line about the page
  // (shareLine, else the story's first sentence), above the author credit
  const ty = fy + fh + 70;
  const title = sp.shareTitle || sp.title;
  text(title, 70, ty, `700 60px ${sc}`, INK);
  x.font = `700 60px ${sc}`; const tw = x.measureText(title).width;
  text(sp.en, 70 + tw + 22, ty - 4, `italic 500 26px ${SERIF}`, '#8a6d48');
  if (sp.station) text(`⊖ ${sp.station} 站`, 70 + tw + 22, ty - 36, `500 18px ${sc}`, '#8a6d48');
  const line = sp.shareLine || (sp.story.match(/^[^。！]*[。！]/) || [sp.story])[0];
  wrap(x, line, `500 30px ${sc}`, W - 140, 2).forEach((r, k) => text(r, 70, ty + 48 + k * 36, `500 30px ${sc}`, '#3d2e20'));
  signature(text, W, H);
  return c;
}

const loadImage = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

export async function coverCard({book, sc}) {
  const grid = await loadImage(GRID), stops = book.spreads.slice(1, 5);
  const W = 1080, H = 1440, {c, x, text} = paper(W, H, 2);
  text('MEMORY IN LONDON  ·  POP-UP BOOK', W / 2, 84, `600 20px ${SERIF}`, '#8a6d48', 'center', 6);
  // the hook, as large as the width allows: it has to read at half a screen wide
  text('把伦敦旅行', 70, 230, `800 104px ${sc}`, INK);
  text('做成了一本', 70, 354, `800 104px ${sc}`, INK);
  x.font = `800 104px ${sc}`; const w5 = x.measureText('做成了一本').width;
  text('立体书', 70 + w5, 354, `800 104px ${sc}`, RED);
  text('一天四站 · 从早到深夜', 72, 420, `500 32px ${sc}`, BROWN);
  // the four stops, each a photo in a white frame with its time and name
  const gx = 60, gy = 480, gap = 18, tw = (W - 2 * gx - gap) / 2, th = Math.round(tw * GRID_TILE.h / GRID_TILE.w);
  stops.forEach((sp, k) => {
    const X = gx + (k % 2) * (tw + gap), Y = gy + Math.floor(k / 2) * (th + gap);
    x.shadowColor = 'rgba(40,25,10,.25)'; x.shadowBlur = 18; x.shadowOffsetY = 8; x.fillStyle = '#fffdf8'; x.fillRect(X, Y, tw, th); x.shadowColor = 'transparent';
    x.drawImage(grid, (k % 2) * GRID_TILE.w, Math.floor(k / 2) * GRID_TILE.h, GRID_TILE.w, GRID_TILE.h, X + 8, Y + 8, tw - 16, th - 16);
    const label = `${(sp.eyebrow.match(/^\d+:\d+/) || [''])[0]}  ${sp.title}`;
    x.font = `700 26px ${sc}`; const lw = x.measureText(label).width + 28;
    x.fillStyle = 'rgba(253,250,243,.92)'; x.fillRect(X + 8, Y + th - 8 - 44, lw, 44);
    text(label, X + 22, Y + th - 8 - 13, `700 26px ${sc}`, INK);
  });
  const by = gy + 2 * th + gap + 92;
  text(book.title, 70, by, `italic 600 46px ${SERIF}`, INK);
  text(book.subtitle, 72, by + 46, `500 26px ${sc}`, BROWN);
  signature(text, W, H);
  return c;
}
