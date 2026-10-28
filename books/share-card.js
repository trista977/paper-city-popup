/* The share cards, for memory.html and the mini tool alike. 1080 × 1440 at 2×.
   pageCard: one page — a close-up polaroid of the page's own framing above, the whole open spread below, on paper,
   with the page's Chinese title first, its English name small, one line about it and a postmark signed by the author.
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

// the postmark, signed: POP-UP LONDON by the author, and the card's number
function postmark(x, text, X, Y, tag) {
  x.save(); x.translate(X, Y); x.rotate(8 * Math.PI / 180); x.strokeStyle = RED; x.lineWidth = 2; x.setLineDash([6, 5]);
  x.beginPath(); x.arc(0, 0, 70, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
  const top = tag ? -30 : -20;
  text('POP-UP', 0, top, `600 15px ${SERIF}`, RED, 'center', 2); text('LONDON', 0, top + 21, `600 15px ${SERIF}`, RED, 'center', 2);
  text(`by ${AUTHOR}`, 0, top + 45, `italic 600 17px ${SERIF}`, RED, 'center');
  if (tag) text(tag, 0, top + 67, `600 14px ${SERIF}`, RED, 'center', 2);
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
  const cv = closeView(sp, i);
  const wide = reader.snapshot({w: 1600, h: 900, lit: cv.lit}), close = reader.snapshot({w: 1200, h: 760, ...cv});
  if (!wide || !close) return null;
  const W = 1080, H = 1440, {c, x, text} = paper(W, H, 2);
  text(`MEMORY IN LONDON  ·  ${i ? `STOP ${i} / ${book.spreads.length - 1}` : 'THE ROUTE'}`, W / 2, 62, `600 20px ${SERIF}`, '#8a6d48', 'center', 6);
  // the polaroid: the page's close-up, taped on at a slant
  const PW = W - 230, PH = Math.round(H * .3);
  x.save(); x.translate(76 + PW / 2, 104 + PH / 2); x.rotate(-2.2 * Math.PI / 180);
  x.shadowColor = 'rgba(60,40,20,.22)'; x.shadowBlur = 24; x.shadowOffsetY = 10; x.fillStyle = '#fffdf8'; x.fillRect(-PW / 2, -PH / 2, PW, PH + 32); x.shadowColor = 'transparent';
  const iw = PW - 28, ih = PH - 28, s = Math.max(iw / close.width, ih / close.height);
  x.save(); x.beginPath(); x.rect(-PW / 2 + 14, -PH / 2 + 14, iw, ih); x.clip();
  x.drawImage(close, -PW / 2 + 14 + (iw - close.width * s) / 2, -PH / 2 + 14 + (ih - close.height * s) / 2, close.width * s, close.height * s); x.restore();
  text(sp.eyebrow, -PW / 2 + 18, PH / 2 + 18, `italic 600 22px ${SERIF}`, BROWN);
  x.fillStyle = 'rgba(214,190,140,.65)';
  x.save(); x.translate(-PW / 2 + 100, -PH / 2 - 2); x.rotate(-.1); x.fillRect(-60, -17, 120, 34); x.restore();
  x.save(); x.translate(PW / 2 - 100, -PH / 2 - 2); x.rotate(.09); x.fillRect(-60, -17, 120, 34); x.restore();
  x.restore();
  // the hand-written arrow
  const ay = PH + 128;
  text('翻开，它就立起来了', W - 92, ay, `500 22px ${sc}`, RED, 'right');
  x.strokeStyle = RED; x.lineWidth = 3; x.lineCap = 'round'; x.setLineDash([7, 6]);
  x.beginPath(); x.moveTo(W - 102, ay + 12); x.bezierCurveTo(W - 112, ay + 46, W - 152, ay + 56, W - 194, ay + 60); x.stroke(); x.setLineDash([]);
  x.beginPath(); x.moveTo(W - 182, ay + 50); x.lineTo(W - 196, ay + 61); x.lineTo(W - 180, ay + 68); x.stroke();
  // the whole spread in a white frame
  const fy = PH + 196, fw = W - 100, fh = Math.round(fw * 9 / 16);
  x.shadowColor = 'rgba(40,25,10,.3)'; x.shadowBlur = 30; x.shadowOffsetY = 14; x.fillStyle = '#fffdf8'; x.fillRect(50, fy, fw, fh); x.shadowColor = 'transparent';
  x.drawImage(wide, 60, fy + 10, fw - 20, fh - 20);
  // names: the Chinese title leads, the English name and the station small beside it, then one line about the page
  // (shareLine, else the story's first sentence), clear of the postmark
  const ty = fy + fh + 86;
  const title = sp.shareTitle || sp.title;
  text(title, 70, ty, `700 60px ${sc}`, INK);
  x.font = `700 60px ${sc}`; const tw = x.measureText(title).width;
  text(sp.en, 70 + tw + 22, ty - 4, `italic 500 26px ${SERIF}`, '#8a6d48');
  if (sp.station) text(`⊖ ${sp.station} 站`, 70 + tw + 22, ty - 36, `500 18px ${sc}`, '#8a6d48');
  const line = sp.shareLine || (sp.story.match(/^[^。！]*[。！]/) || [sp.story])[0];
  wrap(x, line, `500 30px ${sc}`, W - 310, 2).forEach((r, k) => text(r, 70, ty + 58 + k * 40, `500 30px ${sc}`, '#3d2e20'));
  postmark(x, text, W - 134, H - 126, i ? `№ 0${i}` : 'ROUTE');
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
  postmark(x, text, W - 134, H - 126, null);
  return c;
}
