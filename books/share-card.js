/* The share cards, for memory.html and the mini tool alike. 1080 × 1440 at 2×.
   pageCard: one page — a polaroid above, signed in its caption like a photo, and a framed picture of the pop-up below,
   then the page's Chinese title, its English name beside it, one line about it and a postmark with the station and
   the month. A stop with a real photo (sharePhoto) puts the photo in the polaroid and the pop-up's close-up
   from the same spot below, so the two compare directly; the title page has the close-up above and the whole spread
   below.
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

// a round postmark, a little askew in red ink: the station and the month in one line of the same letters running all the
// way round the ring, and LONDON in the middle
function postmark(x, text, X, Y, R, top, date) {
  // Cormorant's figures are old-style (a 6 sits low like a lower-case letter), so the year's figures come from a serif
  // with lining figures, sized to stand as tall as the capitals around them
  const ink = 'rgba(154,58,46,.85)', r = R - 8, s = `${top} · ${date} · `.toUpperCase();
  const font = ch => /\d/.test(ch) ? `700 9.5px "Times New Roman", Times, "Noto Serif", serif` : `700 10px ${SERIF}`;
  x.save(); x.translate(X, Y); x.rotate(-9 * Math.PI / 180); x.strokeStyle = ink;
  x.lineWidth = 2.4; x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 1.2; x.beginPath(); x.arc(0, 0, R - 16, 0, Math.PI * 2); x.stroke();
  // the letters spaced evenly to close the ring, starting from the top
  const ws = [...s].map(ch => { x.font = font(ch); return x.measureText(ch).width; }), gap = (2 * Math.PI * r - ws.reduce((a, b) => a + b, 0)) / ws.length;
  let a = -Math.PI / 2 - ws[0] / 2 / r;
  [...s].forEach((ch, n) => { const m = a + ws[n] / 2 / r;
    x.save(); x.rotate(m); x.translate(r, 0); x.rotate(Math.PI / 2); x.textBaseline = 'middle'; text(ch, 0, 0, font(ch), ink, 'center'); x.restore();
    a += (ws[n] + gap) / r; });
  x.textBaseline = 'alphabetic'; text('LONDON', 0, 4, `700 12px ${SERIF}`, ink, 'center', 1.5);
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

export async function pageCard({reader, book, sc}) {
  const i = reader.cur, sp = book.spreads[i]; if (i < 0) return null;
  const cv = closeView(sp, i), photo = sp.sharePhoto;
  const W = 1080, H = 1440, PW = W - 160, PH = 466, CAP = 44, py = 114 + PH / 2;
  const fy = py + PH / 2 + CAP + 40, fw = W - 100, fh = Math.round(fw * 9 / 16), bw = fw - 20, bh = fh - 20, sh = Math.round(1600 * bh / bw);
  // both renders before anything is awaited, while the page is as it was asked for
  const below = reader.snapshot(photo ? {w: 1600, h: sh, ...cv} : {w: 1600, h: sh, lit: cv.lit});
  const above = photo ? null : reader.snapshot({w: 1200, h: 760, ...cv});
  if (!below || !(photo || above)) return null;
  const top = photo ? await loadImage(photo.src) : above;
  const {c, x, text} = paper(W, H, 2);
  text(`MEMORY IN LONDON  ·  ${i ? `STOP ${i} / ${book.spreads.length - 1}` : 'THE ROUTE'}`, W / 2, 78, `600 20px ${SERIF}`, '#8a6d48', 'center', 6);
  // the polaroid, centred at a slight slant, taped at its two top corners
  x.save(); x.translate(W / 2, py); x.rotate(-1.6 * Math.PI / 180);
  x.shadowColor = 'rgba(60,40,20,.22)'; x.shadowBlur = 24; x.shadowOffsetY = 10; x.fillStyle = '#fffdf8'; x.fillRect(-PW / 2, -PH / 2, PW, PH + CAP); x.shadowColor = 'transparent';
  const iw = PW - 28, ih = PH - 28, s = Math.max(iw / top.width, ih / top.height);
  x.save(); x.beginPath(); x.rect(-PW / 2 + 14, -PH / 2 + 14, iw, ih); x.clip();
  x.drawImage(top, -PW / 2 + 14 + (iw - top.width * s) / 2, -PH / 2 + 14 + (ih - top.height * s) / 2, top.width * s, top.height * s); x.restore();
  // the caption: the time and place, and the signature
  text(sp.eyebrow, -PW / 2 + 18, PH / 2 + 26, `italic 600 22px ${SERIF}`, BROWN);
  signature(text, PW / 2 - 18, PH / 2 + 26);
  x.fillStyle = 'rgba(214,190,140,.72)';
  for (const side of [-1, 1]) { x.save(); x.translate(side * (PW / 2 - 16), -PH / 2 + 16); x.rotate(side * 42 * Math.PI / 180); x.fillRect(-54, -16, 108, 32); x.restore(); }
  x.restore();
  // the pop-up in a white frame
  x.shadowColor = 'rgba(40,25,10,.3)'; x.shadowBlur = 30; x.shadowOffsetY = 14; x.fillStyle = '#fffdf8'; x.fillRect(50, fy, fw, fh); x.shadowColor = 'transparent';
  x.drawImage(below, 60, fy + 10, bw, bh);
  // names, in the band between the frame and the paper's inner rule with even space above and below: the Chinese title,
  // the English name beside it at the height of its top, then one line about the page (shareLine, else the story's first
  // sentence); on the right the postmark, its foot level with the foot of that line
  const band = [fy + fh, H - 31], ty = Math.round((band[0] + band[1]) / 2 - 59 + 50), title = sp.shareTitle || sp.title;
  const R = 49, PX = W - 56 - R, PY = ty + 66 - R, room = PX - R - 26;
  text(title, 70, ty, `700 60px ${sc}`, INK);
  x.font = `700 60px ${sc}`; const ex = 70 + x.measureText(title).width + 24;
  x.font = `italic 500 52px ${SERIF}`; const fs = Math.min(52, Math.floor(52 * (room - ex) / x.measureText(sp.en).width));
  text(sp.en, ex, ty - 50 + Math.round(fs * .74), `italic 500 ${fs}px ${SERIF}`, '#8a6d48');
  const line = sp.shareLine || (sp.story.match(/^[^。！]*[。！]/) || [sp.story])[0];
  wrap(x, line, `500 30px ${sc}`, room - 70, 1).forEach(r => text(r, 70, ty + 62, `500 30px ${sc}`, '#3d2e20'));
  postmark(x, text, PX, PY, R, sp.station || book.title, 'OCT 2026');
  return c;
}

const loadImage = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });

export async function coverCard({book, sc}) {
  const grid = await loadImage(GRID), stops = book.spreads.slice(1, 5);
  // the four stops' grid, and the card cut to it: as much paper under the grid as there is over the line at the top
  const W = 1080, gx = 60, gy = 466, gap = 18, tw = (W - 2 * gx - gap) / 2, th = Math.round(tw * GRID_TILE.h / GRID_TILE.w);
  const H = gy + 2 * th + gap + (84 - 13), {c, x, text} = paper(W, H, 2);
  text('MEMORY IN LONDON  ·  POP-UP BOOK', W / 2, 84, `600 20px ${SERIF}`, '#8a6d48', 'center', 6);
  // the hook, as large as the width allows: it has to read at half a screen wide
  const L1 = '用AI把伦敦旅行', L2 = '做成可交互的', RED2 = '3D立体书';
  x.font = `800 100px ${sc}`; const fs = Math.min(100, Math.floor(100 * (W - 140) / x.measureText(L2 + RED2).width));
  text(L1, 70, 230, `800 ${fs}px ${sc}`, INK);
  text(L2, 70, 354, `800 ${fs}px ${sc}`, INK);
  x.font = `800 ${fs}px ${sc}`; text(RED2, 70 + x.measureText(L2).width, 354, `800 ${fs}px ${sc}`, RED);
  // the signature as a round ink stamp, top right
  x.save(); x.translate(W - 165, 180); x.rotate(8 * Math.PI / 180); x.scale(.8, .8);
  x.strokeStyle = 'rgba(154,58,46,.8)'; x.lineWidth = 2.2; if (x.setLineDash) x.setLineDash([7, 6]);
  x.beginPath(); x.arc(0, 0, 70, 0, Math.PI * 2); x.stroke(); if (x.setLineDash) x.setLineDash([]);
  text('POP-UP', 0, -16, `600 21px ${SERIF}`, '#9a3a2e', 'center', 3);
  text('LONDON', 0, 10, `600 21px ${SERIF}`, '#9a3a2e', 'center', 3);
  text(`by ${AUTHOR}`, 0, 36, `italic 600 20px ${SERIF}`, '#9a3a2e', 'center');
  x.restore();
  // the four stops, each a photo in a white frame with its time and name
  stops.forEach((sp, k) => {
    const X = gx + (k % 2) * (tw + gap), Y = gy + Math.floor(k / 2) * (th + gap);
    x.shadowColor = 'rgba(40,25,10,.25)'; x.shadowBlur = 18; x.shadowOffsetY = 8; x.fillStyle = '#fffdf8'; x.fillRect(X, Y, tw, th); x.shadowColor = 'transparent';
    x.drawImage(grid, (k % 2) * GRID_TILE.w, Math.floor(k / 2) * GRID_TILE.h, GRID_TILE.w, GRID_TILE.h, X + 8, Y + 8, tw - 16, th - 16);
    const label = `${(sp.eyebrow.match(/^\d+:\d+/) || [''])[0]}  ${sp.title}`;
    x.font = `700 26px ${sc}`; const lw = x.measureText(label).width + 28;
    x.fillStyle = 'rgba(253,250,243,.92)'; x.fillRect(X + 8, Y + th - 8 - 44, lw, 44);
    text(label, X + 22, Y + th - 8 - 13, `700 26px ${sc}`, INK);
  });
  return c;
}
