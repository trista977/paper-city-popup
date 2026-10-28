/* Memory in London as a Xiaohongshu mini tool. The same reader as memory.html, bundled into one classic script by
   tools/build-minitool.mjs, with what the container asks for: a GPU budget with runtime step-down, pause when hidden,
   a lost-context message and a plain-text page when there is no WebGL; the share card saved through
   xhs.miniTool (writeTempFile → saveImageToPhotosAlbum) instead of a download, the page's card or the cover; a follow button where the
   client has followAuthor. */
import './compat.js';
import {createReader} from '../books/book3d.js';
import {MEMORY_LONDON as BOOK} from '../books/memory-london.js';
import {pageCard, coverCard} from '../books/share-card.js';

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
  $('savePage').addEventListener('click', () => saveCard(false));
  $('saveCover').addEventListener('click', () => saveCard(true));
  $('previewX').addEventListener('click', () => { $('preview').hidden = true; $('previewImg').removeAttribute('src'); });
  window.__reader = reader;
}

/* the share cards (books/share-card.js): this page's card, or the cover for a set */
const SC = '"Songti SC", "Noto Serif CJK SC", serif';

/* save a card (this page's, or the cover) to the photo album; the card goes through a temp file so the image data doesn't travel as one long
   base64 string */
async function saveCard(cover) {
  const btn = $(cover ? 'saveCover' : 'savePage'); if (btn.disabled) return;
  btn.disabled = true; const label = btn.textContent; btn.textContent = '正在生成…';
  let done = '';
  try {
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
    const c = cover ? await coverCard({book: BOOK, sc: SC}) : pageCard({reader, book: BOOK, sc: SC}); if (!c) throw new Error('not ready');
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
