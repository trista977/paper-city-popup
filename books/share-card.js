/* The share cards, for memory.html and the mini tool alike. 1080 × 1440 at 2×.
   pageCard: one page — a close-up polaroid of the page's own framing above, signed in its caption like a photo, and the
   whole open spread below with small icons on the things to play with (shareHints), then the page's Chinese title
   first, its English name small and one line about it.
   coverCard: the cover of a set — one big line in Chinese over the four stops in a 2 × 2 grid (a still pre-rendered by
   tools/render-share-grid.mjs, so the cover doesn't need every page built), for a feed where it shows half a screen
   wide. Not offered in the apps; window.__coverCard() in memory.html makes one. */

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

// the signature: a quiet italic line, like a name pencilled on a photo
const signature = (text, X, Y, align = 'right') => text(`Pop-up London · by ${AUTHOR}`, X, Y, `italic 500 21px ${SERIF}`, '#9b8466', align);

// a hint on the whole-spread photo: a small round badge with the move's icon (tap, pull, drag, turn) and a label beside it
function hint(x, text, sc, X, Y, icon, label, right) {
  x.save(); x.translate(X, Y);
  x.shadowColor = 'rgba(30,18,8,.35)'; x.shadowBlur = 10; x.shadowOffsetY = 3;
  x.font = `700 21px ${sc}`; const lw = x.measureText(label).width, pw = lw + 70, px = right ? -pw + 22 : -22;
  x.fillStyle = 'rgba(255,252,245,.94)'; x.beginPath(); x.arc(px + 22, 0, 22, Math.PI / 2, Math.PI * 1.5); x.arc(px + pw - 22, 0, 22, -Math.PI / 2, Math.PI / 2); x.closePath(); x.fill(); x.shadowColor = 'transparent';
  x.fillStyle = RED; x.beginPath(); x.arc(0, 0, 17, 0, Math.PI * 2); x.fill();
  x.strokeStyle = x.fillStyle = '#fff8ec'; x.lineWidth = 2.6; x.lineCap = x.lineJoin = 'round';
  const arrow = (ax, ay, ang) => { x.beginPath(); x.moveTo(ax + 5 * Math.cos(ang + 2.5), ay + 5 * Math.sin(ang + 2.5)); x.lineTo(ax, ay); x.lineTo(ax + 5 * Math.cos(ang - 2.5), ay + 5 * Math.sin(ang - 2.5)); x.stroke(); };
  if (icon === 'tap') { x.beginPath(); x.arc(0, 3, 4.2, 0, Math.PI * 2); x.fill(); for (const a of [-90, -35, -145]) { const r = a * Math.PI / 180; x.beginPath(); x.moveTo(8 * Math.cos(r), 3 + 8 * Math.sin(r)); x.lineTo(12 * Math.cos(r), 3 + 12 * Math.sin(r)); x.stroke(); } }
  else if (icon === 'pull') { x.beginPath(); x.moveTo(-8, 6); x.lineTo(7, -6); x.stroke(); arrow(7, -6, -Math.PI / 4.6); x.beginPath(); x.moveTo(-10, 2); x.lineTo(-6, 9); x.stroke(); }
  else if (icon === 'drag') { x.beginPath(); x.moveTo(-9, 0); x.lineTo(9, 0); x.stroke(); arrow(9, 0, 0); arrow(-9, 0, Math.PI); }
  else { x.beginPath(); x.arc(0, 0, 8, -Math.PI * .1, Math.PI * 1.45); x.stroke(); arrow(8 * Math.cos(-Math.PI * .1), 8 * Math.sin(-Math.PI * .1), -Math.PI * .6); }
  text(label, right ? -30 : 30, 8, `700 21px ${sc}`, INK, right ? 'right' : 'left');
  x.restore();
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
  const cv = closeView(sp, i), hints = sp.shareHints || [];
  const wide = reader.snapshot({w: 1600, h: 900, lit: cv.lit, marks: hints}), close = reader.snapshot({w: 1200, h: 760, ...cv});
  if (!wide || !close) return null;
  const W = 1080, H = 1440, {c, x, text} = paper(W, H, 2);
  text(`MEMORY IN LONDON  ·  ${i ? `STOP ${i} / ${book.spreads.length - 1}` : 'THE ROUTE'}`, W / 2, 92, `600 20px ${SERIF}`, '#8a6d48', 'center', 6);
  // the polaroid: the page's close-up, centred and taped on at a slant; the tape sits square across its top edge
  const PW = W - 160, PH = 440, CAP = 44, py = 136 + PH / 2;
  x.save(); x.translate(W / 2, py); x.rotate(-1.6 * Math.PI / 180);
  x.shadowColor = 'rgba(60,40,20,.22)'; x.shadowBlur = 24; x.shadowOffsetY = 10; x.fillStyle = '#fffdf8'; x.fillRect(-PW / 2, -PH / 2, PW, PH + CAP); x.shadowColor = 'transparent';
  const iw = PW - 28, ih = PH - 28, s = Math.max(iw / close.width, ih / close.height);
  x.save(); x.beginPath(); x.rect(-PW / 2 + 14, -PH / 2 + 14, iw, ih); x.clip();
  x.drawImage(close, -PW / 2 + 14 + (iw - close.width * s) / 2, -PH / 2 + 14 + (ih - close.height * s) / 2, close.width * s, close.height * s); x.restore();
  text(sp.eyebrow, -PW / 2 + 18, PH / 2 + 26, `italic 600 22px ${SERIF}`, BROWN);
  signature(text, PW / 2 - 18, PH / 2 + 26);
  x.fillStyle = 'rgba(214,190,140,.7)';
  for (const side of [-1, 1]) { x.save(); x.translate(side * (PW / 2 - 110), -PH / 2); x.rotate(side * 3 * Math.PI / 180); x.fillRect(-62, -16, 124, 32); x.restore(); }
  x.restore();
  // the whole spread in a white frame, with the hints pinned on the things to play with
  const fy = py + PH / 2 + CAP + 46, fw = W - 100, fh = Math.round(fw * 9 / 16), k = (fw - 20) / wide.width;
  x.shadowColor = 'rgba(40,25,10,.3)'; x.shadowBlur = 30; x.shadowOffsetY = 14; x.fillStyle = '#fffdf8'; x.fillRect(50, fy, fw, fh); x.shadowColor = 'transparent';
  x.drawImage(wide, 60, fy + 10, fw - 20, fh - 20);
  hints.forEach((h, n) => { const m = wide.marks[n]; if (!m) return;
    const X = 60 + m[0] * k + (h.dx || 0), Y = fy + 10 + m[1] * k + (h.dy || 0);
    hint(x, text, sc, Math.max(84, Math.min(W - 84, X)), Math.max(fy + 36, Math.min(fy + fh - 36, Y)), h.icon, h.text, X > W - 300); });
  // names: the Chinese title leads, the English name and the station small beside it, then one line about the page
  // (shareLine, else the story's first sentence)
  const ty = fy + fh + 86, title = sp.shareTitle || sp.title;
  text(title, 70, ty, `700 60px ${sc}`, INK);
  x.font = `700 60px ${sc}`; const tw = x.measureText(title).width;
  text(sp.en, 70 + tw + 22, ty - 4, `italic 500 26px ${SERIF}`, '#8a6d48');
  if (sp.station) text(`⊖ ${sp.station} 站`, 70 + tw + 22, ty - 36, `500 18px ${sc}`, '#8a6d48');
  const line = sp.shareLine || (sp.story.match(/^[^。！]*[。！]/) || [sp.story])[0];
  wrap(x, line, `500 30px ${sc}`, W - 140, 1).forEach(r => text(r, 70, ty + 58, `500 30px ${sc}`, '#3d2e20'));
  return c;
}

const loadImage = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

export async function coverCard({book, sc}) {
  const grid = await loadImage(GRID), stops = book.spreads.slice(1, 5);
  const W = 1080, H = 1440, {c, x, text} = paper(W, H, 2);
  text('MEMORY IN LONDON  ·  POP-UP BOOK', W / 2, 84, `600 20px ${SERIF}`, '#8a6d48', 'center', 6);
  // the hook, as large as the width allows: it has to read at half a screen wide
  text('把伦敦旅行', 70, 210, `800 104px ${sc}`, INK);
  text('做成了一本', 70, 334, `800 104px ${sc}`, INK);
  x.font = `800 104px ${sc}`; const w5 = x.measureText('做成了一本').width;
  text('立体书', 70 + w5, 334, `800 104px ${sc}`, RED);
  text('一天四站 · 翻开，它就立起来了', 72, 398, `500 32px ${sc}`, BROWN);
  // the four stops, each a photo in a white frame with its time and name
  const gx = 60, gy = 446, gap = 18, tw = (W - 2 * gx - gap) / 2, th = Math.round(tw * GRID_TILE.h / GRID_TILE.w);
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
  text(`${book.subtitle} · 从早到深夜`, 72, by + 46, `500 26px ${sc}`, BROWN);
  signature(text, W - 70, by + 46);
  return c;
}
