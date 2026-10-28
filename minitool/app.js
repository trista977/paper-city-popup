/* Memory in London as a Xiaohongshu mini tool. The same reader as memory.html, bundled into one classic script by
   tools/build-minitool.mjs, with what the container asks for: a GPU budget with runtime step-down, pause when hidden,
   a lost-context message and a plain-text page when there is no WebGL; the share card saved through
   xhs.miniTool (writeTempFile → saveImageToPhotosAlbum) instead of a download; a follow button where the
   client has followAuthor. */
import './compat.js';
import {createReader} from '../books/book3d.js';
import {MEMORY_LONDON as BOOK} from '../books/memory-london.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const xhs = () => (window.xhs && window.xhs.miniTool) || null;
const can = name => { const m = xhs(); return !!m && typeof m[name] === 'function'; };

/* client version (§3.6 of the mini-tool doc): the last three digits of buildVersion are a build number */
const readBuild = o => Number(o && o.miniToolEnv && o.miniToolEnv.buildVersion) || 0;
async function clientVersion() {
  let b = readBuild(window.xhs && window.xhs.launchOptions);
  if (!b && can('getLaunchOptions')) { try { b = readBuild(await xhs().getLaunchOptions()); } catch (e) { b = 0; } }
  return Math.floor(b / 1000);
}

let noteFrame, noteTimer, cardOpen = false, last = null, reader = null, swipeHinted = false;
const ui = {
  // a note at a point, or (options.anchor) a short line of dialogue that follows the characters saying it
  note(text, x, y, options = {}) {
    const l = $('noteLayer'); l.innerHTML = ''; cancelAnimationFrame(noteFrame);
    const n = document.createElement('div'); n.className = 'note' + (options.anchor ? ' dialogue' : ''); n.textContent = text;
    n.setAttribute('role', 'status'); l.appendChild(n);
    const place = () => {
      if (!n.isConnected) return;
      const [ax, ay] = options.anchor ? options.anchor() : [x, y];
      const half = n.offsetWidth / 2 + 12, left = Math.max(half, Math.min(innerWidth - half, ax));
      n.style.left = left + 'px'; n.style.top = Math.max(n.offsetHeight + 24, ay) + 'px';
      n.style.setProperty('--tail-x', Math.max(18, Math.min(n.offsetWidth - 18, ax - left + n.offsetWidth / 2)) + 'px');
      if (options.anchor) noteFrame = requestAnimationFrame(place);
    };
    place(); clearTimeout(noteTimer); noteTimer = setTimeout(() => { n.remove(); cancelAnimationFrame(noteFrame); }, options.anchor ? 3000 : 3800);
  },
  loading(t) { $('loading').hidden = !t; $('loading').textContent = t || ''; },
  hint() {},
  state(s) {
    last = s;
    if (s.open && !swipeHinted && matchMedia('(max-aspect-ratio: 85/100)').matches) {
      swipeHinted = true; setTimeout(() => ui.note('左右拖动可以看两边，双击放大。', innerWidth / 2, innerHeight * .62), 1600);
    }
    $('openBook').hidden = s.open; $('prev').hidden = $('next').hidden = !s.open; $('tools').hidden = !s.open;
    $('dots').innerHTML = '';
    if (s.open) {
      for (let i = 0; i < s.total; i++) {
        const d = document.createElement('button'); d.className = 'dot'; d.type = 'button';
        d.setAttribute('aria-label', '翻到 ' + BOOK.spreads[i].title); d.setAttribute('aria-current', i === s.cur);
        d.addEventListener('click', () => reader.go(i)); $('dots').appendChild(d);
      }
      $('prev').disabled = false; $('next').disabled = s.cur >= s.total - 1;
      const sp = s.spread;
      $('nowTitle').textContent = sp.title; $('nowSub').innerHTML = esc(sp.eyebrow) + (sp.station ? `<span class="stn"> · ⊖ ${esc(sp.station)} 站</span>` : '');
      $('eyebrow').textContent = sp.eyebrow; $('title').innerHTML = `${esc(sp.title)}<small>${esc(sp.en)}</small>`;
      $('text').textContent = sp.story; $('todo').innerHTML = sp.todo.map(t => `<li>${esc(t)}</li>`).join('');
    } else {
      $('nowTitle').textContent = BOOK.title; $('nowSub').textContent = BOOK.subtitle; setCard(false);
    }
  },
  // GPU events from the reader: a lower tier, a lost / restored context, or a context that keeps getting lost
  gpu(kind, n) {
    if (kind === 'tier' && n === 2) ui.note('这台设备有点吃力，已切到省电模式：画面只在你操作时更新。', innerWidth / 2, innerHeight / 2);
    if (kind === 'lost') status('画面暂停了，正在恢复…');
    if (kind === 'restored') status(null);
    if (kind === 'dead') { status(null); plainPage('3D 画面多次中断，先换成文字版。'); }
  },
};
function status(t) { $('status').hidden = !t; $('status').textContent = t || ''; }
function setCard(on) { cardOpen = on; $('card').hidden = !on; $('story').setAttribute('aria-pressed', on); }

/* no WebGL (or it keeps failing): the book's stops as a plain page */
function plainPage(why) {
  const p = $('plain');
  p.innerHTML = `<h1>${esc(BOOK.title)}</h1><p class="lead">${esc(BOOK.subtitle)}<br>${esc(why)}</p>` +
    BOOK.spreads.map(sp => `<article><h2>${esc(sp.title)}<small>${esc(sp.eyebrow)}</small></h2><p>${esc(sp.story)}</p></article>`).join('');
  p.hidden = false;
  for (const id of ['top', 'bottom', 'card', 'scene']) $(id).hidden = true;
}

/* the container's top buttons and safe area (getWindowInfo, client 9.49+): the header sits below them */
async function avoidTopButtons() {
  if (!can('getWindowInfo') || await clientVersion() < 9490) return;
  try {
    const info = await xhs().getWindowInfo(), b = info.menuButtons || {};
    let top = info.safeArea ? info.safeArea.top || 0 : 0;
    for (const k of ['back', 'me', 'share']) if (b[k]) top = Math.max(top, b[k].bottom - 6);
    document.documentElement.style.setProperty('--chrome-top', Math.round(top) + 'px');
  } catch (e) { /* keep the CSS safe-area offsets */ }
}

/* follow the author (followAuthor / getFollowStatus, client 9.51+) */
let followPending = false, followStatus = -1;
function showFollow(status) {
  followStatus = status; const b = $('follow');
  b.hidden = status === 2 || status === -1;   // the author, or the status can't be read: no button
  b.textContent = status === 1 ? '已关注' : '关注作者'; b.disabled = followPending || status === 1;
}
async function setupFollow() {
  if (!can('followAuthor') || !can('getFollowStatus') || await clientVersion() < 9510) return;
  try { showFollow((await xhs().getFollowStatus()).follow_status); } catch (e) { return; }
  $('follow').addEventListener('click', async () => {
    if (followPending) return; followPending = true; showFollow(followStatus);
    try { const s = (await xhs().followAuthor()).follow_status; if (s !== -1) followStatus = s; }
    catch (e) { if (e && e.errCode === 15404) ui.note('今天的关注提醒次数用完了，明天再来吧。', innerWidth / 2, 120); }
    followPending = false; showFollow(followStatus);
  });
}

async function boot() {
  avoidTopButtons(); setupFollow();
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');
    ui.loading('正在装订…');
    if (document.fonts && document.fonts.load) await Promise.race([
      Promise.all(['600 40px "Cormorant Garamond"', 'italic 400 34px "Cormorant Garamond"', 'italic 600 34px "Cormorant Garamond"'].map(f => document.fonts.load(f, 'Aa'))),
      new Promise(r => setTimeout(r, 1500)),
    ]).catch(() => {});
    // ?tier=1 / ?adapt=0 pin the GPU tier, for checking each tier's budget
    reader = await createReader({canvas: $('scene'), book: BOOK, ui, budget: {tier: +(location.search.match(/[?&]tier=(\d)/) || [0, 0])[1], adapt: !/[?&]adapt=0/.test(location.search)}});
    ui.loading(null);
  } catch (e) {
    console.error(e); ui.loading(null); plainPage('这台设备打不开 3D 立体书（需要 WebGL），先看文字版。');
    return;
  }
  $('openBook').addEventListener('click', () => reader.open());
  $('closeBook').addEventListener('click', () => reader.close());
  $('prev').addEventListener('click', () => reader.prev());
  $('next').addEventListener('click', () => reader.next());
  // a new touch on the book dismisses the speech bubble, so it never sits on top of the next thing you want to tap
  $('scene').addEventListener('pointerdown', () => { clearTimeout(noteTimer); cancelAnimationFrame(noteFrame); $('noteLayer').innerHTML = ''; });
  $('story').addEventListener('click', () => last && last.open && setCard(!cardOpen));
    $('cardX').addEventListener('click', () => setCard(false));
  $('savePage').addEventListener('click', saveCard);
  $('previewX').addEventListener('click', () => { $('preview').hidden = true; $('previewImg').removeAttribute('src'); });
  window.__reader = reader;
}

/* the share card: a close-up polaroid of the page's signature piece above, the whole open spread below, on paper,
   with the page's names and a postmark. 1080 × 1440 at 2×. */
function shareCard() {
  const i = reader.cur, sp = BOOK.spreads[i]; if (i < 0) return null;
  // the close-up: the page's own camera for the card (shareView: az, pol, r, and a target point or a piece to focus on)
  // if it has one, else its signature piece close in
  const sv = sp.shareView, focus = sv ? sv.focus || null : sp.signature || (i === 0 ? 'file' : null);
  // pages whose shareView asks for it (lit) are pictured with their lights on, both photos
  const lit = !!(sv && sv.lit);
  const wide = reader.snapshot({w: 1600, h: 900, lit}), close = reader.snapshot({w: 1200, h: 760, focus, lit, view: sv || (focus ? {} : {az: 24, pol: 40, r: .62})});
  if (!wide || !close) return null;
  const W = 1080, H = 1440, k = 2, c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
  const x = c.getContext('2d'); x.scale(k, k);
  const SERIF = '"Cormorant Garamond", Georgia, serif', SC = '"Songti SC", "Noto Serif CJK SC", serif';
  x.fillStyle = '#f3ead8'; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W * .2, H * .1, 0, W * .2, H * .1, W); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#b9a37a'; x.lineWidth = 2; x.strokeRect(22, 22, W - 44, H - 44); x.strokeStyle = '#d6c4a0'; x.lineWidth = 1; x.strokeRect(31, 31, W - 62, H - 62);
  const text = (t, X, Y, font, color, align = 'left', ls = 0) => { x.font = font; x.fillStyle = color; x.textAlign = align; if ('letterSpacing' in x) x.letterSpacing = ls + 'px'; x.fillText(t, X, Y); if ('letterSpacing' in x) x.letterSpacing = '0px'; };
  text(`MEMORY IN LONDON  ·  ${i ? `STOP ${i} / ${BOOK.spreads.length - 1}` : 'THE ROUTE'}`, W / 2, 62, `600 20px ${SERIF}`, '#8a6d48', 'center', 6);
  const PW = W - 230, PH = Math.round(H * .3);
  x.save(); x.translate(76 + PW / 2, 104 + PH / 2); x.rotate(-2.2 * Math.PI / 180);
  x.shadowColor = 'rgba(60,40,20,.22)'; x.shadowBlur = 24; x.shadowOffsetY = 10; x.fillStyle = '#fffdf8'; x.fillRect(-PW / 2, -PH / 2, PW, PH + 32); x.shadowColor = 'transparent';
  const iw = PW - 28, ih = PH - 28, sc = Math.max(iw / close.width, ih / close.height);
  x.save(); x.beginPath(); x.rect(-PW / 2 + 14, -PH / 2 + 14, iw, ih); x.clip();
  x.drawImage(close, -PW / 2 + 14 + (iw - close.width * sc) / 2, -PH / 2 + 14 + (ih - close.height * sc) / 2, close.width * sc, close.height * sc); x.restore();
  text(sp.eyebrow, -PW / 2 + 18, PH / 2 + 18, `italic 600 22px ${SERIF}`, '#6d5a44');
  x.fillStyle = 'rgba(214,190,140,.65)';
  x.save(); x.translate(-PW / 2 + 100, -PH / 2 - 2); x.rotate(-.1); x.fillRect(-60, -17, 120, 34); x.restore();
  x.save(); x.translate(PW / 2 - 100, -PH / 2 - 2); x.rotate(.09); x.fillRect(-60, -17, 120, 34); x.restore();
  x.restore();
  const ay = PH + 140;
  text('翻开，它就立起来了', W - 92, ay, `500 22px ${SC}`, '#9a3a2e', 'right');
  x.strokeStyle = '#9a3a2e'; x.lineWidth = 3; x.lineCap = 'round'; x.setLineDash([7, 6]);
  x.beginPath(); x.moveTo(W - 102, ay + 12); x.bezierCurveTo(W - 112, ay + 48, W - 152, ay + 60, W - 194, ay + 64); x.stroke(); x.setLineDash([]);
  x.beginPath(); x.moveTo(W - 182, ay + 54); x.lineTo(W - 196, ay + 65); x.lineTo(W - 180, ay + 72); x.stroke();
  const fy = PH + 218, fw = W - 100, fh = Math.round(fw * 9 / 16);
  x.shadowColor = 'rgba(40,25,10,.3)'; x.shadowBlur = 30; x.shadowOffsetY = 14; x.fillStyle = '#fffdf8'; x.fillRect(50, fy, fw, fh); x.shadowColor = 'transparent';
  x.drawImage(wide, 60, fy + 10, fw - 20, fh - 20);
  const ty = fy + fh + 70;
  text(sp.en, 70, ty, `italic 600 54px ${SERIF}`, '#2e2218');
  text(`${sp.title}${sp.station ? `  ·  ${sp.station} 站` : ''}`, 70, ty + 44, `600 26px ${SC}`, '#4a3826');
  // the story's first sentence in at most two lines, kept inside the frame: a line never starts with a comma or full
  // stop (punctuation stays on the line before), and a longer sentence ends the second line with an ellipsis
  const first = (sp.story.match(/^[^。！]*[。！]/) || [sp.story])[0], maxW = W - 330, rows = [];
  x.font = `400 20px ${SC}`;
  let line = '';
  for (const ch of first) { if (x.measureText(line + ch).width > maxW && !'，。、；：！？）》」'.includes(ch)) { rows.push(line); line = ''; } line += ch; }
  if (line) rows.push(line);
  if (rows.length > 2) { let r = rows[1].replace(/[，。、；：！？]+$/, ''); while (x.measureText(r + '…').width > maxW) r = r.slice(0, -1); rows.splice(1, rows.length - 1, r + '…'); }
  rows.forEach((r, k) => text(r, 70, ty + 84 + k * 30, `400 20px ${SC}`, '#6d5a44'));
  x.save(); x.translate(W - 126, H - 120); x.rotate(8 * Math.PI / 180); x.strokeStyle = '#9a3a2e'; x.lineWidth = 2; x.setLineDash([6, 5]);
  x.beginPath(); x.arc(0, 0, 56, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
  text('POP-UP', 0, -16, `600 15px ${SERIF}`, '#9a3a2e', 'center', 2); text('LONDON', 0, 6, `600 15px ${SERIF}`, '#9a3a2e', 'center', 2);
  text(i ? `№ 0${i}` : 'ROUTE', 0, 28, `600 15px ${SERIF}`, '#9a3a2e', 'center', 2); x.restore();
  return c;
}

/* save the card to the photo album; the card goes through a temp file so the image data doesn't travel as one long
   base64 string */
async function saveCard() {
  const btn = $('savePage'); if (btn.disabled) return;
  btn.disabled = true; const label = btn.textContent; btn.textContent = '正在生成…';
  let done = '';
  try {
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
    const c = shareCard(); if (!c) throw new Error('not ready');
    const data = c.toDataURL('image/jpeg', .9), m = xhs();
    if (m && can('writeTempFile') && can('saveImageToPhotosAlbum')) {
      const {filePath} = await m.writeTempFile({data});
      await m.saveImageToPhotosAlbum({filePath}); done = '已存到相册 ✓';
    } else {
      // outside the container (a plain browser preview): show the card to keep by long-press or screenshot
      $('previewImg').src = data; $('preview').hidden = false; done = label;
    }
  } catch (e) {
    console.error(e);
    done = String(e && e.errMsg || '').indexOf('cancel') >= 0 ? label : reader.busy ? '翻页时不能保存，稍后再试' : '没能保存，再试一次';
  }
  btn.textContent = done || label;
  setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 1800);
}

boot();
