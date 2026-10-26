/* Memory in London — the reference book for the city-travel template, as a horizontally opening 3D pop-up.
   One day from morning to midnight: the museum hall at ten, Westminster at golden hour, the West End at the start
   of a show, and Tower Bridge lighting up at night. A station sign marks every stop and the traveller walks
   through each spread. */
import {P, INK, RED, GOLD, NAVY, rng, rand, wc, art, grain, lg, cloud, lamp, roundel, traveller, ticket, FRIEND} from './paper-art.js';

const smoothstep = t => t * t * (3 - 2 * t);
const mirror = a => ({...a, svg: a.svg.replace('<defs>', `<g transform="translate(${a.w * 10} 0) scale(-1 1)"><defs>`).replace(/<\/svg>$/, '</g></svg>')});
const toDataURL = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
const photo = name => fetch(new URL(`./assets/${name}`, import.meta.url)).then(r => r.blob()).then(toDataURL);
const [BIGBEN_PHOTO, EYE_PHOTO] = await Promise.all([photo('bigben-photo.jpg'), photo('londoneye-photo.jpg')]);

const fx = X => (X + 100) * 10, fz = Z => (Z + 65) * 10;           // flat-world → floor SVG pixels
const floor = inner => ({svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1300" width="2000" height="1300">${art(1, 1, '').svg.match(/<defs>[\s\S]*<\/defs>/)[0]}${inner}</svg>`});
const SERIF = '"Cormorant Garamond", Georgia, serif', SC = '"Noto Serif SC", "Songti SC", serif';
const pageBg = (c = '#f4ecdc') => `<rect width="2000" height="1300" fill="${c}"/>`;
const frameLines = `<rect x="40" y="40" width="920" height="1220" fill="none" stroke="#b9a37a" stroke-width="2"/><rect x="1040" y="40" width="920" height="1220" fill="none" stroke="#b9a37a" stroke-width="2"/>`;
const clamp01 = v => Math.max(0, Math.min(1, v));
// the place card in the lower-left corner of every spread: place, a subtitle and the local time, all inside its frame
const PLATE = {x: fx(-94), y: fz(41), w: 560, h: 178};
const plateBox = `<rect x="${PLATE.x}" y="${PLATE.y}" width="${PLATE.w}" height="${PLATE.h}" fill="#fbf6ea" stroke="#7a6650" stroke-width="2"/>
  <rect x="${PLATE.x + 9}" y="${PLATE.y + 9}" width="${PLATE.w - 18}" height="${PLATE.h - 18}" fill="none" stroke="#b9a37a" stroke-width="1.2"/>
`;
const plateTexts = (en, sub, zh) => [
  {x: PLATE.x + 30, y: PLATE.y + 60, text: en, font: `700 40px ${SERIF}`, ls: 4, maxWidth: PLATE.w - 60},
  {x: PLATE.x + 30, y: PLATE.y + 104, text: sub, font: `italic 500 31px ${SERIF}`, color: '#4a3b2e', maxWidth: PLATE.w - 60},
  {x: PLATE.x + 30, y: PLATE.y + 146, text: zh, font: `600 27px ${SC}`, color: '#5b4a3a', maxWidth: PLATE.w - 60},
];
// text printed under a lift-up card, sized to fit the card's box (w units wide), centred on Z
const underTexts = (X, Z, w, lines) => {
  const size = Math.min(25, Math.floor((w * 10 - 30) / Math.max(...lines.map(l => l.length)))), lh = Math.round(size * 1.38);
  return lines.map((t, i) => ({x: fx(X), y: fz(Z) - (lines.length - 1) * lh / 2 + size * .36 + i * lh, text: t, font: `400 ${size}px ${SC}`, color: '#4a3b2e', align: 'center', maxWidth: w * 10 - 24}));
};
const underBox = (X, Z, w, h) => `<rect x="${fx(X - w / 2)}" y="${fz(Z - h / 2)}" width="${w * 10}" height="${h * 10}" fill="#fbf6ea" stroke="#b9a37a" stroke-width="2" stroke-dasharray="6 5"/>`;

/* ---------- small mechanisms for the lower-right corner of each spread ----------
   Flat pieces lie on the page (ex along the page, ey toward its far edge) and move in their own ways. */
const FLAT_X = [1, 0, 0], FLAT_Y = [0, 0, -1];
const toggleNext = (c, ids, i) => {           // flip the next leaf, or put back the last one flipped
  const st = ids.map(id => !!c.get(id).opened), k = st[i] ? st.lastIndexOf(true) : st.indexOf(false);
  if (k >= 0) c.set(ids[k], {opened: !st[k]});
  return k;
};
// a little booklet: tap and the next leaf turns over on its left-hand spine
function booklet({id, X, Z, w, h, leaves, note}) {
  const ids = leaves.map((_, k) => `${id}${k}`), n = leaves.length;
  return leaves.map(([front, back], k) => ({id: ids[k], type: 'custom', anchor: 'left', w, h, art: front, artBack: mirror(back), speed: 4,
    tap: (c, e) => { const j = toggleNext(c, ids, k); if (j === n - 1 && c.get(ids[j]).opened && note) c.note(note, e); },
    pose: (s, rise, p) => { const a = Math.PI * smoothstep(p.open), y = .25 + (n - k) * .06 * (1 - p.open) + k * .06 * p.open;
      return {o: [X - w / 2, y, Z + h / 2], x: [Math.cos(a), Math.sin(a), 0], y: FLAT_Y}; }}));
}
// a postcard that turns over like a coin
const postcard = ({id, X, Z, w, h, front, back, note}) => ({id, type: 'custom', anchor: 'center', w, h, art: front, artBack: mirror(back), speed: 3.2,
  tap: (c, e) => { c.toggle(id); if (c.once(id) && note) c.note(note, e); },
  pose: (s, rise, p) => { const a = Math.PI * smoothstep(p.open); return {o: [X, .25 + w / 2 * Math.sin(a) * .9, Z], x: [Math.cos(a), Math.sin(a), 0], y: FLAT_Y}; }});
// a disc under a window: turn it (or tap) to bring the next fact round
const volvelle = ({id, X, Z, r, disc, cover}) => [
  {id, type: 'custom', anchor: 'center', w: r * 2, h: r * 2, art: disc, solidHit: true, ang: 0, target: 0,
    tick: (s, dt) => { if (!s.dragging) s.ang += (s.target - s.ang) * Math.min(1, dt * 6); s.dragging = false; },
    dial: (deg, c) => { const s = c.get(id); s.ang += deg; s.target = Math.round(s.ang / 90) * 90; s.dragging = true; },
    tap: c => { const s = c.get(id); s.target = Math.round(s.ang / 90) * 90 + 90; },
    pose: s => { const a = s.ang * Math.PI / 180; return {o: [X, .25, Z], x: [Math.cos(a), 0, Math.sin(a)], y: [Math.sin(a), 0, -Math.cos(a)]}; }},
  {id: `${id}Cover`, type: 'custom', anchor: 'center', w: cover.w, h: cover.h, art: cover, tap: c => { const s = c.get(id); s.target = Math.round(s.ang / 90) * 90 + 90; },
    pose: () => ({o: [X, .45, Z + (cover.h / 2 - r - 1.2)], x: FLAT_X, y: FLAT_Y})},
];

// the traveller says where she is, so place names live in her lines rather than on signs
const me = (X, Z, pose, line) => ({id: 'me', type: 'stand', X, Z, w: 10, h: 17.5, art: traveller(pose), tap: (c, e) => { c.hop('me'); c.note(line, e); }});
// a standing Underground sign for the real station nearest each stop
const station = (X, Z, name, time) => ({id: 'station', type: 'stand', X, Z, w: 20, h: 13.8, art: roundel(name, time)});

/* ======================= cover ======================= */
const cover = art(103, 135, `
  <rect width="1030" height="1350" fill="#6b1e2a"/>
  ${rng(520, i => `<rect x="${(i * 37) % 1030}" y="${(i * 91) % 1350}" width="2" height="2" fill="#000" opacity=".12"/>`)}
  <rect x="60" y="60" width="910" height="1230" fill="none" stroke="${GOLD}" stroke-width="5"/>
  <rect x="80" y="80" width="870" height="1190" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <g transform="translate(515 470)" fill="none" stroke="${GOLD}"><circle r="130" stroke-width="34"/></g>
  <rect x="300" y="438" width="430" height="64" fill="${GOLD}"/>
  <text x="515" y="482" text-anchor="middle" font-size="34" letter-spacing="6" fill="#6b1e2a" font-family="Helvetica, Arial, sans-serif" font-weight="700">LONDON</text>
  <text x="515" y="790" text-anchor="middle" font-size="92" font-style="italic" fill="${GOLD}" font-family="Georgia, serif">Memory</text>
  <text x="515" y="880" text-anchor="middle" font-size="60" font-style="italic" fill="${GOLD}" font-family="Georgia, serif">in London</text>
  <path d="M380,930 H650" stroke="${GOLD}" stroke-width="2"/>
  <text x="515" y="990" text-anchor="middle" font-size="30" letter-spacing="10" fill="${GOLD}" font-family="Georgia, serif">FROM MORNING TO MIDNIGHT</text>
  <text x="515" y="1180" text-anchor="middle" font-size="24" letter-spacing="8" fill="${GOLD}" opacity=".8" font-family="Georgia, serif">A POP-UP JOURNEY</text>`);

/* ======================= 0 · title & route ======================= */
/* The title page holds a standing pull-out card file (a handmade-album mechanism): pull the tab and a little black box
   stands up with a tall kraft panel behind it; a row of cards stands in slots on its lid, one per stop, and each tap
   flips the front card forward to show the next stop. Tapping a flipped card puts it back. */
const KRAFT = '#c9a26b', KRAFT_D = '#a67f4c', BOXC = '#2b2a2e';
const dashBox = (x, y, w, h, c = '#f4ead6', r = 10) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${c}" stroke-width="2.6" stroke-dasharray="9 6"/>`;
const flipY = a => ({...a, svg: a.svg.replace('<defs>', `<g transform="translate(0 ${a.h * 10}) scale(1 -1)"><defs>`).replace(/<\/svg>$/, '</g></svg>')});
const FILE = {X: 50, Z: -18, w: 34, d: 12, h: 9}, K = 1.3;    // drawn at w × d × h, shown K times larger
const fileFront = art(FILE.w, FILE.h, `${wc(`<rect x="1" y="1" width="338" height="88" fill="${BOXC}"/>`, 1.4)}
  ${/* Big Ben window: a near-portrait frame cropped to the belfry and clock face (photo 400×420, rows 170–320,
       tower centred at x≈165); the bus gets the wider frame beside it */''}
  <rect x="14" y="12" width="92" height="66" rx="8" fill="#f2ede3"/>
  <clipPath id="fwBen"><rect x="20" y="18" width="80" height="54" rx="5"/></clipPath>
  <image href="${BIGBEN_PHOTO}" x="${60 - 165 * .36}" y="${18 - 170 * .36}" width="${400 * .36}" height="${420 * .36}" clip-path="url(#fwBen)" preserveAspectRatio="none"/>
  ${dashBox(16, 14, 88, 62, '#3a3a40', 7)}
  <rect x="118" y="12" width="208" height="66" rx="8" fill="#f2ede3"/>${dashBox(120, 14, 204, 62, '#3a3a40', 7)}
  <g transform="translate(-30 0)">${wc(`<rect x="190" y="26" width="124" height="38" rx="8" fill="${RED}"/>${rng(5, i => `<rect x="${198 + i * 23}" y="32" width="17" height="12" rx="2" fill="#cfe1ea" stroke-width="1"/>`)}<rect x="190" y="50" width="124" height="3" fill="#f3e6c9" stroke="none"/>
    <circle cx="214" cy="66" r="6" fill="#222"/><circle cx="290" cy="66" r="6" fill="#222"/>`, 1.2)}</g>`);
const fileSide = art(FILE.d, FILE.h, wc(`<rect x="1" y="1" width="118" height="88" fill="${BOXC}"/>`, 1.4));
const fileTop = art(FILE.w, FILE.d, `${wc(`<rect x="1" y="1" width="338" height="118" fill="${BOXC}"/>`, 1.4)}
  ${rng(4, i => `<rect x="44" y="${20 + i * 22}" width="252" height="4" rx="2" fill="#0d0d10"/>`)}`);
const filePanel = art(FILE.w, 27, `${wc(`<path d="M1,269 V22 Q1,1 22,1 H318 Q339,1 339,22 V269 Z" fill="${KRAFT}"/>`, 1.4)}
  <rect x="150" y="22" width="170" height="130" rx="10" fill="#f4efe6"/>
  <clipPath id="pnl"><rect x="158" y="30" width="154" height="114" rx="6"/></clipPath>
  <image href="${EYE_PHOTO}" x="158" y="20" width="154" height="134" clip-path="url(#pnl)" preserveAspectRatio="xMidYMid slice"/>
  ${dashBox(20, 14, 306, 250, '#f4ead6', 16)}
  <text x="30" y="70" font-size="30" font-style="italic" fill="${INK}" font-family="Georgia, serif">Memory</text>
  <text x="30" y="104" font-size="22" font-style="italic" fill="${INK}" font-family="Georgia, serif">in London</text>
  <text x="30" y="136" font-size="12" letter-spacing="2" fill="#5b4326" font-family="Georgia, serif">4 STOPS · 1 DAY</text>`);
// back of the photo board: folded flat it lies face down over the flattened box, so it is printed as the closed
// black box (the slotted lid, then the front with its two windows) — nothing of the cards shows until it stands
const panelBack = flipY(art(FILE.w, 27, `${wc(`<path d="M1,269 V22 Q1,1 22,1 H318 Q339,1 339,22 V269 Z" fill="${BOXC}"/>`, 1.4)}
  ${rng(4, i => `<rect x="44" y="${44 + i * 24}" width="252" height="4" rx="2" fill="#0d0d10"/>`)}
  <path d="M8,160 H332" stroke="#4a4a52" stroke-width="2" stroke-dasharray="8 6"/>
  ${fileFront.svg.replace('<svg ', '<svg x="0" y="172" ')}`));
const STOPS = [
  {time: '10:00', en: 'NATURAL HISTORY MUSEUM', zh: '自然史博物馆', note: '大厅里挂着一整头蓝鲸，名字叫 Hope。', icon: `<path d="M118,92 q18,-26 50,-16 q20,6 28,-4 l-4,18 q-16,14 -40,10 q-20,-2 -34,-8 Z" fill="#e9e3d6" stroke="${INK}" stroke-width="2"/>`},
  {time: '15:00', en: 'WESTMINSTER', zh: '大本钟', note: '下午三点，听到大本钟敲响啦。', icon: `<rect x="150" y="58" width="24" height="48" fill="#e0b062" stroke="${INK}" stroke-width="2"/><polygon points="148,58 162,30 176,58" fill="#8e8a74" stroke="${INK}" stroke-width="2"/><circle cx="162" cy="72" r="7" fill="#faf4e4" stroke="${INK}" stroke-width="1.6"/>`},
  {time: '19:30', en: 'WEST END', zh: '西区剧院街', note: '和朋友在剧院门口碰头，看 SIX。', icon: `<rect x="126" y="62" width="72" height="34" rx="4" fill="#1d1c22" stroke="${GOLD}" stroke-width="2"/><text x="162" y="86" text-anchor="middle" font-size="20" fill="${GOLD}" font-family="Georgia, serif">SIX</text>`},
  {time: '22:00', en: 'TOWER BRIDGE', zh: '塔桥', note: '最后一站，看全桥亮灯，晚安伦敦。', icon: `<rect x="132" y="50" width="14" height="50" fill="#7f8ba0" stroke="${INK}" stroke-width="2"/><rect x="178" y="50" width="14" height="50" fill="#7f8ba0" stroke="${INK}" stroke-width="2"/><path d="M146,62 H178 M120,96 H204" stroke="#e9c56b" stroke-width="4"/>`},
];
const stopCard = (st, i) => art(26, 13, `${wc(`<path d="M2,128 V40 Q2,26 16,26 H96 L108,8 H152 L164,26 H244 Q258,26 258,40 V128 Z" fill="${i % 2 ? KRAFT_D : KRAFT}"/>`, 1.4)}
  ${dashBox(12, 34, 236, 88, '#f6ecd8', 8)}
  <text x="130" y="22" text-anchor="middle" font-size="12" fill="#3a2a18" font-family="Georgia, serif">${i + 1} / ${STOPS.length}</text>
  <text x="24" y="66" font-size="26" fill="${INK}" font-family="Georgia, serif">${st.time}</text>
  <text x="24" y="88" font-size="10" letter-spacing="1" fill="#4a3620" font-family="Georgia, serif">${st.en}</text>
  <text x="24" y="110" font-size="15" fill="${INK}" font-family="Noto Serif SC, serif">${st.zh}</text>
  <g transform="translate(46 4)">${st.icon}</g>`);
// what you see on the back of a card once it has flipped forward: a little memo for that stop
const stopBack = (st, i) => flipY(art(26, 13, `<rect width="260" height="130" fill="#efe2c8"/>${rng(5, k => `<path d="M16,${46 + k * 18} H244" stroke="#d8c6a2" stroke-width="1.4"/>`)}
  <text x="18" y="32" font-size="13" fill="#7a5a32" font-family="Georgia, serif">MEMO · ${st.time}</text>
  <text x="18" y="70" font-size="15" fill="${INK}" font-family="Noto Serif SC, serif">${st.note.slice(0, 13)}</text>
  <text x="18" y="94" font-size="15" fill="${INK}" font-family="Noto Serif SC, serif">${st.note.slice(13)}</text>`));
// the lid: a plain card at the front of the file that hides the four stop cards until it is flipped forward
const lidCard = art(26, 13, `${wc(`<rect x="2" y="2" width="256" height="126" rx="10" fill="${RED}"/>`, 1.4)}
  ${dashBox(12, 12, 236, 106, '#f3e6c9', 8)}
  <text x="130" y="54" text-anchor="middle" font-size="24" font-style="italic" fill="#f8efdc" font-family="Georgia, serif">Memory in London</text>
  <text x="130" y="78" text-anchor="middle" font-size="11" letter-spacing="3" fill="#f3e0bd" font-family="Georgia, serif">ROUTE CARDS · 4 STOPS</text>
  <text x="130" y="104" text-anchor="middle" font-size="13" fill="#f8efdc" font-family="Noto Serif SC, serif">点我翻开盒盖</text>`);
// inside of the lid, seen once it leans flipped forward: today's route at a glance
const lidBack = flipY(art(26, 13, `<rect width="260" height="130" fill="#efe2c8"/>
  <text x="18" y="28" font-size="13" letter-spacing="2" fill="#7a5a32" font-family="Georgia, serif">TODAY'S ROUTE</text>
  ${STOPS.map((st, k) => `<circle cx="24" cy="${48 + k * 22}" r="4" fill="${RED}"/><text x="36" y="${53 + k * 22}" font-size="13" fill="${INK}" font-family="Georgia, serif">${st.time}</text>
  <text x="84" y="${53 + k * 22}" font-size="14" fill="${INK}" font-family="Noto Serif SC, serif">${st.zh}</text>`).join('')}`));
// the leaves in the file, front to back: the lid, then one card per stop
const LEAVES = [{id: 'lid', art: lidCard, back: lidBack}, ...STOPS.map((st, i) => ({id: `card${i}`, art: stopCard(st, i), back: stopBack(st, i)}))];
// lay the file out for pull-tab value v (0 flat … 1 standing) and which leaves have been flipped
function fileLayout(c) {
  const v = c.get('file').v ?? 0;
  c.set('file', {raise: v}); c.set('panel', {raise: v});
  // the leaves share one hinge along the front of the box, like a desk flip calendar: a flipped leaf falls forward
  // past level and leans down on the page (45° below level reaches it), each later one resting a touch flatter on the one before
  // while the box is folding up the leaves wait inside it, and only slide up through the slots in its lid once it
  // stands; folded flat, all you see is the printed box
  const top = FILE.h * K * Math.sin(v * Math.PI / 2), w = clamp01((v - .7) / .3);
  LEAVES.forEach((l, i) => { const s = c.get(l.id);
    if (v < .9) s.opened = false;
    c.set(l.id, {raise: s.opened ? -.5 + .018 * i : 1, Y: top + .25 + i * .2 - 13 * K * (1 - w), hidden: w < .02}); });
}
function flipCard(c, e, i) {
  const flipped = LEAVES.map(l => !!c.get(l.id).opened);
  if ((c.get('file').v ?? 0) < .8) { c.note('先把下面的拉片往外拉，让卡片盒站起来。', e); return; }
  // a flipped leaf goes back; otherwise the front-most standing leaf flips forward
  const k = flipped[i] ? flipped.lastIndexOf(true) : flipped.indexOf(false);
  if (k < 0) return;
  c.set(LEAVES[k].id, {opened: !flipped[k]}); fileLayout(c);
  if (flipped[k]) return;
  if (k === 0) c.note('盒盖翻开啦，盖子里面写着今天的路线。点卡片，一站一张往下翻。', e);
  else if (k === LEAVES.length - 1) c.note('四站都看完啦。点翻下来的卡片，可以一张张放回去，最后盖上盒盖。', e);
}
// little facades for the four stops, standing on the route map
const BUFF0 = '#dcc39a', BAND0 = '#aab4bd';
const miniNHM = art(14, 11, wc(`
  <rect x="26" y="46" width="88" height="62" fill="${BUFF0}"/>${rng(5, i => `<rect x="26" y="${54 + i * 11}" width="88" height="4" fill="${BAND0}" stroke="none"/>`)}
  <polygon points="40,46 70,20 100,46" fill="${BUFF0}"/><path d="M58,108 V86 a12,12 0 0 1 24,0 V108 Z" fill="#4f4438"/>
  ${[4, 112].map(x => `<rect x="${x}" y="24" width="24" height="84" fill="${BUFF0}"/>${rng(6, i => `<rect x="${x}" y="${32 + i * 12}" width="24" height="4" fill="${BAND0}" stroke="none"/>`)}<polygon points="${x - 2},26 ${x + 12},4 ${x + 26},26" fill="#7f8c96"/>`).join('')}`, 1.3));
const miniBen = art(13, 13, wc(`
  <rect x="2" y="70" width="92" height="58" fill="#d9b166"/>${rng(10, i => `<polygon points="${4 + i * 9},70 ${8 + i * 9},58 ${12 + i * 9},70" fill="#b68e48" stroke-width="1"/>`)}
  ${rng(2, r => rng(8, k => `<rect x="${8 + k * 11}" y="${80 + r * 22}" width="4" height="14" rx="2" fill="#7a6138" stroke="none"/>`))}
  <rect x="98" y="40" width="22" height="88" fill="#e1b462"/><rect x="94" y="22" width="30" height="22" fill="#d9a752"/>
  <circle cx="109" cy="33" r="7" fill="#faf4e4" stroke-width="1.4"/><polygon points="96,22 109,0 122,22" fill="#8e8a74"/>`, 1.3));
const miniTheatre = art(12, 11, `${wc(`
  <rect x="4" y="16" width="112" height="92" fill="#e9dcc0"/><polygon points="0,18 60,0 120,18" fill="#c9b78f"/>
  ${rng(3, i => `<rect x="${16 + i * 34}" y="28" width="20" height="24" fill="#3e4656" stroke-width="1"/>`)}
  <rect x="14" y="58" width="92" height="22" fill="#1d1c22" stroke="${GOLD}" stroke-width="2"/>
  <rect x="10" y="84" width="100" height="6" fill="${RED}"/><rect x="36" y="90" width="48" height="18" fill="#4a3b30"/>`, 1.3)}
  ${rng(8, i => `<circle cx="${20 + i * 11.5}" cy="58" r="2.4" fill="#f3d27a"/>`)}
  <text x="60" y="75" text-anchor="middle" font-size="14" letter-spacing="2" fill="${GOLD}" font-family="Georgia, serif">SIX</text>`);
const miniTB = art(15, 12, wc(`
  <path d="M0,96 Q20,92 34,70 M150,96 Q130,92 116,70" fill="none" stroke="#7f8ba0" stroke-width="5"/>
  <rect x="40" y="30" width="70" height="8" fill="#7f8ba0"/><rect x="40" y="94" width="70" height="7" fill="#5d6a82"/>
  ${[30, 104].map(x => `<rect x="${x}" y="24" width="18" height="96" fill="#cfc4ab"/><polygon points="${x - 2},26 ${x + 9},4 ${x + 20},26" fill="#55617a"/>`).join('')}
  <rect x="0" y="94" width="150" height="7" fill="#5d6a82"/>`, 1.3));
const STOPS_MAP = [[-82, -36, 1, 'Natural History Museum', miniNHM], [-58, -11, 2, 'Westminster', miniBen], [-36, -36, 3, 'West End', miniTheatre], [-17, -23, 4, 'Tower Bridge', miniTB]];
// the rest of London is printed flat on the map
const mapIcon = {
  palace: `<rect x="-16" y="-8" width="32" height="12" fill="#efe6d0"/><rect x="-5" y="-13" width="10" height="5" fill="#efe6d0"/><path d="M0,-13 v-7" stroke-width="1.2"/><rect x="0" y="-20" width="6" height="4" fill="${RED}" stroke="none"/>`,
  column: `<rect x="-2" y="-22" width="4" height="22" fill="#e6dccb"/><circle cx="0" cy="-24" r="3" fill="#cfc1a3"/><circle cx="-12" cy="0" r="5" fill="#bcd3e0"/><circle cx="12" cy="0" r="5" fill="#bcd3e0"/>`,
  museum: `<polygon points="-16,-10 0,-20 16,-10" fill="#efe6d0"/>${rng(5, i => `<rect x="${-14 + i * 6.5}" y="-10" width="3" height="12" fill="#efe6d0" stroke-width=".8"/>`)}<rect x="-17" y="2" width="34" height="3" fill="#efe6d0"/>`,
  dome: `<rect x="-14" y="-6" width="28" height="10" fill="#efe6d0"/><path d="M-8,-6 A8,9 0 0 1 8,-6 Z" fill="#c4cbcd"/><path d="M0,-15 v-5" stroke-width="1.4"/>`,
  castle: `<rect x="-14" y="-10" width="28" height="14" fill="#d8d0bf"/>${[-14, -4, 6].map(x => `<rect x="${x}" y="-14" width="8" height="5" fill="#d8d0bf"/>`).join('')}<path d="M-14,-14 h4 M10,-14 h4" stroke-width="1"/>`,
  shard: `<polygon points="0,-24 9,4 -9,4" fill="#cfdde6"/>`,
  eye: `<circle cx="0" cy="-12" r="11" fill="none" stroke-width="1.6"/>${rng(6, i => `<path d="M0,-12 L${11 * Math.cos(i * Math.PI / 3)},${-12 + 11 * Math.sin(i * Math.PI / 3)}" stroke-width=".8"/>`)}<path d="M-6,4 L0,-12 L6,4" fill="none" stroke-width="1.4"/>`,
};
// the map's ground: city blocks between streets, a few main roads and the royal parks
const MAPBOX = {x: fx(-92), y: fz(-58), w: 840, h: 760};
const baseMap = (() => {
  const r = rand(211), cell = 34, out = [];
  for (let gy = 0; gy * cell < MAPBOX.h; gy++) for (let gx = 0; gx * cell < MAPBOX.w; gx++) {
    if (r() < .12) continue;
    const x = MAPBOX.x + gx * cell + 4, y = MAPBOX.y + gy * cell + 4, w = cell - 8 - r() * 6, h = cell - 8 - r() * 6;
    out.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="2" fill="${r() < .5 ? '#e6d4ae' : '#e9dab9'}"/>`);
    if (r() < .35) out.push(`<rect x="${(x + 4).toFixed(0)}" y="${(y + 4).toFixed(0)}" width="${(w / 2).toFixed(0)}" height="${(h / 2).toFixed(0)}" fill="#dcc7a0"/>`);
  }
  const roads = [`M${fx(-92)},${fz(-28)} C${fx(-70)},${fz(-32)} ${fx(-48)},${fz(-30)} ${fx(-8)},${fz(-40)}`,
    `M${fx(-80)},${fz(-58)} C${fx(-76)},${fz(-30)} ${fx(-80)},${fz(-6)} ${fx(-74)},${fz(18)}`,
    `M${fx(-50)},${fz(-58)} L${fx(-52)},${fz(-12)}`, `M${fx(-30)},${fz(-58)} C${fx(-28)},${fz(-40)} ${fx(-24)},${fz(-30)} ${fx(-22)},${fz(18)}`,
    `M${fx(-92)},${fz(6)} C${fx(-60)},${fz(10)} ${fx(-40)},${fz(4)} ${fx(-8)},${fz(8)}`];
  const parks = [[-72, -50, 80, 34, 'Hyde Park'], [-64, -26, 26, 13, 'Green Park'], [-56, -19, 22, 8, "St James's Park"], [-38, 12, 34, 10, '']];
  return {svg: `<clipPath id="mapclip"><rect x="${MAPBOX.x}" y="${MAPBOX.y}" width="${MAPBOX.w}" height="${MAPBOX.h}"/></clipPath>
    <g clip-path="url(#mapclip)">${out.join('')}
      ${roads.map(d => `<path d="${d}" fill="none" stroke="#c9b48c" stroke-width="16"/><path d="${d}" fill="none" stroke="#f8efda" stroke-width="11"/>`).join('')}
      ${parks.map(([X, Z, rx, ry]) => `<ellipse cx="${fx(X)}" cy="${fz(Z)}" rx="${rx}" ry="${ry}" fill="#bcd39a" stroke="#9fbd7e" stroke-width="2"/>
        ${(() => { const q = rand(X * 7 + 991); return rng(Math.round(rx * ry / 120), () => `<circle cx="${(fx(X) + (q() - .5) * rx * 1.5).toFixed(0)}" cy="${(fz(Z) + (q() - .5) * ry * 1.4).toFixed(0)}" r="${(3 + q() * 3).toFixed(1)}" fill="#a2c07f"/>`); })()}`).join('')}</g>`,
    labels: parks.filter(p => p[4] && p[4] !== 'Hyde Park').map(([X, Z, rx, ry, name]) => ({x: fx(X), y: fz(Z) + 5, text: name, font: `italic 15px ${SERIF}`, align: 'center', color: '#5b7a3e'}))};
})();
const SIGHTS = [[-71, -23, 'palace', 'Buckingham Palace'], [-48, -26, 'column', 'Trafalgar Sq'], [-44, -50, 'museum', 'British Museum'], [-24, -42, 'dome', "St Paul's"],
  [-15, -36, 'castle', 'Tower of London'], [-25, -11, 'shard', 'The Shard'], [-50, 3, 'eye', 'London Eye']];
const spread0 = {
  eyebrow: '扉页 · The route', title: 'Memory in London', en: 'One day, from morning to midnight', light: 'morning',
  story: '这本书记下在伦敦的一天：上午在自然史博物馆的大厅，下午三点在大本钟下听钟声，晚上走进西区的剧院街，深夜停在灯火通明的塔桥。左页的地图上，四站各立着一座小建筑，其他景点印在地图上；右页的卡片盒掀开盒盖，里面一站一张卡片。',
  todo: ['把卡片盒右边的红色拉片往外拉，卡片盒和后面的照片板一起站起来。', '卡片盒前面先是一张红色盒盖：点它向前翻开，盖子里面写着今天的路线。', '再点卡片，一站一张向前翻下，露出下一站；翻下来的背面写着这一站的小记。', '点翻下来的卡片，可以一张张放回去，最后盖上盒盖。', '点一点小人，听听她说什么。'],
  floor: floor(`${pageBg()}${frameLines}
    <rect x="${fx(-92)}" y="${fz(-58)}" width="840" height="760" fill="#efe2c4" stroke="#b9a37a" stroke-width="2"/>
    ${baseMap.svg}
    <path d="M${fx(-92)},${fz(-10)} C${fx(-75)},${fz(-28)} ${fx(-60)},${fz(4)} ${fx(-45)},${fz(-6)} S${fx(-22)},${fz(-30)} ${fx(-8)},${fz(-18)}" fill="none" stroke="#7fa7c0" stroke-width="52"/><path d="M${fx(-92)},${fz(-10)} C${fx(-75)},${fz(-28)} ${fx(-60)},${fz(4)} ${fx(-45)},${fz(-6)} S${fx(-22)},${fz(-30)} ${fx(-8)},${fz(-18)}" fill="none" stroke="#a9cbe0" stroke-width="44"/>
    ${SIGHTS.map(([X, Z, k]) => `<g transform="translate(${fx(X)} ${fz(Z)})" stroke="#7a6650" stroke-width="1.6" stroke-linejoin="round">${mapIcon[k]}</g>`).join('')}
    <path d="M${fx(-82)},${fz(-36)} Q${fx(-74)},${fz(-14)} ${fx(-58)},${fz(-11)} Q${fx(-46)},${fz(-38)} ${fx(-36)},${fz(-36)} Q${fx(-22)},${fz(-36)} ${fx(-17)},${fz(-23)}" fill="none" stroke="${RED}" stroke-width="4" stroke-dasharray="4 10"/>
    ${STOPS_MAP.map(([X, Z, n]) => `<circle cx="${fx(X)}" cy="${fz(Z)}" r="18" fill="${RED}"/><text x="${fx(X)}" y="${fz(Z) + 7}" text-anchor="middle" font-size="20" fill="${P}" font-family="Georgia, serif">${n}</text>`).join('')}
    <g transform="translate(${fx(-14)} ${fz(12)})" fill="none" stroke="#7a6650" stroke-width="2"><circle r="28"/><path d="M0,-40 L6,0 L0,40 L-6,0 Z" fill="#7a6650"/></g>
    <path d="M${fx(20)},${fz(38)} H${fx(80)}" stroke="#b9a37a" stroke-width="2"/>
    <rect x="${fx(FILE.X - FILE.w * K / 2 - 2)}" y="${fz(FILE.Z - FILE.d * K / 2 - 37)}" width="${(FILE.w * K + 4) * 10}" height="${(FILE.d * K + 39) * 10}" rx="14" fill="none" stroke="#b9a37a" stroke-width="2" stroke-dasharray="8 6"/>
    ${grain(2000, 1300, .35)}`),
  texts: [
    ...STOPS_MAP.map(([X, Z, n, name]) => ({x: fx(X), y: fz(Z) + 46, text: name, font: `italic 600 24px ${SERIF}`, align: 'center', color: '#4a3b2e'})),
    ...SIGHTS.map(([X, Z, k, name]) => ({x: fx(X), y: fz(Z) + 24, text: name, font: `italic 18px ${SERIF}`, align: 'center', color: '#7a6650'})),
    {x: fx(-75), y: fz(-50) + 6, text: 'Hyde Park', font: `italic 18px ${SERIF}`, align: 'center', color: '#5b7a3e'},
    ...baseMap.labels,
    // the river's name runs along the water
    {x: fx(-80), y: fz(-14.8) + 6, rot: -.04, text: 'RIVER THAMES', font: `600 17px ${SERIF}`, ls: 4, align: 'center', color: '#3f6782'},
    {x: fx(50), y: fz(30), text: 'Memory in London', font: `italic 600 84px ${SERIF}`, align: 'center'},
    {x: fx(50), y: fz(46) + 4, text: '伦敦的一天 · From Morning to Midnight', font: `400 30px ${SC}`, align: 'center', color: '#5b4a3a'},
    {x: fx(50), y: fz(54), text: 'A POP-UP JOURNEY IN FOUR STOPS', font: `500 22px ${SERIF}`, ls: 8, align: 'center', color: '#7a6650'},
  ],
  pieces: [
    ...STOPS_MAP.map(([X, Z, n, name, a]) => ({id: `stop${n}`, type: 'stand', X, Z: Z - 1.6, art: a})),
    {id: 'panel', type: 'stand', X: FILE.X, Z: FILE.Z - FILE.d * K / 2 - .3, Y: .05, w: FILE.w * K, h: 27 * K, raise: 0, ease: 6, art: filePanel, artBack: panelBack},
    {id: 'file', type: 'box', X: FILE.X, Z: FILE.Z, w: FILE.w * K, d: FILE.d * K, h: FILE.h * K, raise: 0, ease: 6, inside: '#1a1a1d',
      faces: {front: fileFront, back: fileSide, left: fileSide, right: fileSide, top: fileTop}, tap: (c, e) => flipCard(c, e, -1)},
    ...LEAVES.map((l, i) => ({id: l.id, type: 'stand', X: FILE.X, Z: FILE.Z + (4.9 - i * .15) * K, w: 26 * K, h: 13 * K, Y: -13 * K, raise: 1, hidden: true, ease: 6, art: l.art, artBack: l.back,
      tap: (c, e) => flipCard(c, e, i)})),
    me(88, 14, 'wave', '出发啦！背上书包，今天从南肯辛顿出发，一路往东走到塔桥。'),
  ],
  controls: [{id: 'file', tab: {icon: 'card', color: '#c8423a'}, X: FILE.X + 27, Z: FILE.Z + 10, len: 8, init: 0, apply: (v, c) => { c.set('file', {v}); fileLayout(c); }}],
};

/* ======================= 1 · Natural History Museum, Hintze Hall ======================= */
const BUFF = '#dcc39a', BAND = '#aab4bd', STONE_D = '#b99f73';
const stripes = (x, y, w, h, step = 26) => rng(Math.floor(h / step), i => `<rect x="${x}" y="${y + 10 + i * step}" width="${w}" height="7" fill="${BAND}" stroke="none"/>`);
const glass = (x, y, w, h, seed) => { const r = rand(seed); const cols = ['#3f6fb5', '#b63b3b', '#e0b13e', '#4f8f5f', '#7a4f9a', '#e9e2c8'];
  return `<clipPath id="g${seed}"><path d="M${x},${y + h} V${y + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w},${y + w / 2} V${y + h} Z"/></clipPath>
    <g clip-path="url(#g${seed})">${rng(Math.ceil(h / 12), j => rng(Math.ceil(w / 12), k => `<rect x="${x + k * 12}" y="${y + j * 12}" width="12" height="12" fill="${cols[Math.floor(r() * cols.length)]}" stroke="#3a3129" stroke-width="1"/>`))}</g>
    <path d="M${x},${y + h} V${y + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w},${y + w / 2} V${y + h} Z" fill="none" stroke="#5a4a36" stroke-width="5"/>`; };
const arches = (x0, y, n, w, h, fill, gap = 10) => rng(n, i => { const x = x0 + i * (w + gap);
  return `<path d="M${x},${y + h} V${y + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w},${y + w / 2} V${y + h} Z" fill="${fill}"/>`; });
// the back wall of Hintze Hall: banded terracotta, three groups of stained-glass lancets, an arcade, and the grand
// staircase that climbs to a landing and splits left and right
const lancet = (x, y, w, h, seed) => `${glass(x, y, w, h, seed)}<path d="M${x - 6},${y + h + 6} V${y + w / 2} A${w / 2 + 6},${w / 2 + 6} 0 0 1 ${x + w + 6},${y + w / 2} V${y + h + 6}" fill="none" stroke="#b99f73" stroke-width="5"/>`;
const hallWall = art(100, 60, `${wc(`
  <path d="M0,600 V150 Q500,40 1000,150 V600 Z" fill="${BUFF}"/>
  ${stripes(0, 110, 1000, 490, 30)}
  <path d="M120,370 V240 A110,110 0 0 1 340,240 V370 Z M350,370 V220 A150,150 0 0 1 650,220 V370 Z M660,370 V240 A110,110 0 0 1 880,240 V370 Z" fill="#e7d6b0"/>
  <rect x="0" y="372" width="1000" height="12" fill="${STONE_D}"/>
  ${arches(40, 392, 15, 46, 62, '#5c5043', 18)}
  <rect x="0" y="462" width="1000" height="10" fill="${STONE_D}"/>
  <path d="M420,600 L440,478 H560 L580,600 Z" fill="#e8dcc2"/>${rng(10, i => `<path d="M${422 + i * 2},${600 - i * 12} H${578 - i * 2}" stroke="#b5a585" stroke-width="2"/>`)}
  <rect x="300" y="470" width="400" height="14" fill="#d9cba9"/>
  <path d="M300,476 L170,410 H230 L340,470 Z M700,476 L830,410 H770 L660,470 Z" fill="#e2d4b6"/>
  ${rng(7, i => `<path d="M${300 - i * 18},${476 - i * 9} l40,0" stroke="#b5a585" stroke-width="2"/><path d="M${700 + i * 18},${476 - i * 9} l-40,0" stroke="#b5a585" stroke-width="2"/>`)}
  <path d="M150,600 V530 A40,40 0 0 1 230,530 V600 Z M770,600 V530 A40,40 0 0 1 850,530 V600 Z" fill="#4a4036"/>
  <rect x="196" y="418" width="34" height="40" fill="#8f877a"/><circle cx="213" cy="424" r="9" fill="#c8c0b0"/>
  <rect x="770" y="420" width="36" height="44" fill="#6b4a35"/><rect x="776" y="426" width="24" height="32" fill="#a08870"/>`, 1.8)}
  ${lancet(395, 250, 52, 110, 3)}${lancet(474, 222, 52, 138, 5)}${lancet(553, 250, 52, 110, 7)}
  ${lancet(170, 270, 44, 90, 11)}${lancet(246, 270, 44, 90, 13)}${lancet(710, 270, 44, 90, 17)}${lancet(786, 270, 44, 90, 19)}
  ${[230, 770].map(x => `<circle cx="${x}" cy="246" r="13" fill="#e9e2c8" stroke="#5a4a36" stroke-width="4"/><circle cx="${x}" cy="246" r="5" fill="#3f6fb5"/>`).join('')}
  <circle cx="500" cy="172" r="22" fill="#e9e2c8" stroke="#5a4a36" stroke-width="5"/>${glass(486, 158, 28, 28, 23)}`);
const galleryArt = art(64, 36, `${wc(`
  <path d="M0,360 V40 L30,10 L60,40 V60 H640 V360 Z" fill="${BUFF}"/>${stripes(0, 60, 640, 300, 24)}
  <rect x="0" y="150" width="640" height="16" fill="${STONE_D}"/>
  ${rng(5, i => `<rect x="${86 + i * 112}" y="170" width="18" height="190" fill="#c9b084"/>`)}
  <rect x="0" y="330" width="640" height="10" fill="${STONE_D}"/>
  ${rng(15, i => `<rect x="${70 + i * 38}" y="134" width="8" height="18" fill="#c9b084"/>`)}`, 1.8)}
  <path fill-rule="evenodd" fill="#4f4438" d="${rng(5, i => { const x = 104 + i * 112; return `M${x},330 V230 A47,47 0 0 1 ${x + 94},230 V330 Z`; })}"/>
  ${rng(10, i => { const x = 76 + i * 56; return `<path d="M${x},128 V92 A16,16 0 0 1 ${x + 32},92 V128 Z" fill="#6b5d4d"/>`; })}`);
const trussArch = (w, h, seed) => { const W = w * 10, H = h * 10, pts = [[40, H], [40, H * .5], [W * .15, H * .22], [W * .32, H * .07], [W / 2, 14], [W * .68, H * .07], [W * .85, H * .22], [W - 40, H * .5], [W - 40, H]];
  const d = 'M' + pts.map(p => p.join(',')).join(' L');
  return art(w, h, `${wc(`<path d="${d}" fill="none" stroke="#454b52" stroke-width="50" stroke-linejoin="miter"/>
    <path d="${d}" fill="none" stroke="#7c8590" stroke-width="36" stroke-linejoin="miter"/>
    <path d="${d}" fill="none" stroke="#454b52" stroke-width="2"/>
    ${pts.slice(0, -1).map((p, i) => { const q = pts[i + 1], n = Math.max(2, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 34));
      return rng(n, k => { const t = (k + .5) / n; return `<circle cx="${p[0] + (q[0] - p[0]) * t}" cy="${p[1] + (q[1] - p[1]) * t}" r="9" fill="#9aa3ad" stroke="#454b52" stroke-width="3"/>`; }); }).join('')}
    <rect x="10" y="${H - 60}" width="60" height="60" fill="${BUFF}"/><rect x="${W - 70}" y="${H - 60}" width="60" height="60" fill="${BUFF}"/>`, 2)}`); };
// Hope as she hangs in the hall: diving toward you, jaws first, flippers spread, the spine running back up to the tail
const BONE = '#e3ddd0', BONE_D = '#bdb5a6';
const whaleArt = art(48, 48, `${wc(`
  <path d="M40,0 L200,250 M440,0 L280,250 M120,0 L228,140 M360,0 L252,140" stroke="#5a5048" stroke-width="1.6" fill="none" opacity=".7"/>
  ${rng(22, i => { const t = i / 21, y = 18 + t * 250, w = 6 + t * 24; return `<rect x="${240 - w / 2}" y="${y}" width="${w}" height="${8 + t * 5}" rx="3" fill="${BONE}"/><path d="M${240 - w / 2 - 4 - t * 10},${y + 5} H${240 + w / 2 + 4 + t * 10}" stroke="${BONE_D}" stroke-width="${2 + t * 2}"/>`; })}
  ${rng(13, i => { const y = 120 + i * 12, sp = 30 + Math.sin(i / 12 * Math.PI) * 70; return `<path d="M232,${y} C${232 - sp * .6},${y - 6} ${232 - sp},${y + 8} ${232 - sp * .9},${y + 40}" fill="none" stroke="${BONE}" stroke-width="6"/><path d="M248,${y} C${248 + sp * .6},${y - 6} ${248 + sp},${y + 8} ${248 + sp * .9},${y + 40}" fill="none" stroke="${BONE}" stroke-width="6"/>`; })}
  <path d="M206,276 L176,232 L224,262 Z M274,276 L304,232 L256,262 Z" fill="${BONE}"/>
  <path d="M196,290 Q240,272 284,290 L300,330 Q240,350 180,330 Z" fill="${BONE}"/>
  <path d="M192,318 C160,360 168,420 214,470 L226,462 C190,420 186,368 210,330 Z" fill="${BONE}"/>
  <path d="M288,318 C320,360 312,420 266,470 L254,462 C290,420 294,368 270,330 Z" fill="${BONE}"/>
  <path d="M226,334 L254,334 L246,456 L234,456 Z" fill="#d6cfc0"/>
  <circle cx="216" cy="312" r="6" fill="#8a8172"/><circle cx="264" cy="312" r="6" fill="#8a8172"/>`, 1.4)}`);
// a flipper, riveted at the shoulder (right-hand end of the art)
const flipperArt = art(18, 5, `${wc(`<path d="M176,22 C140,18 80,10 40,16 L6,12 M40,16 L14,30 M40,16 L22,42" fill="none" stroke="${BONE}" stroke-width="9" stroke-linecap="round"/>
  <circle cx="176" cy="22" r="7" fill="${BONE_D}"/>`, 1.3)}`);
const flipper = (id, k) => ({id, type: 'custom', anchor: k ? 'left' : 'right', parent: 'whale', parentPart: k, art: k ? mirror(flipperArt) : flipperArt,
  tick: (s, dt, c) => { const w = c.get('whale'); w.flapT = Math.max(0, (w.flapT || 0) - dt / 2); s.ang = Math.sin((1 - w.flapT) * Math.PI * 6) * 22 * w.flapT * (k ? -1 : 1); },
  tap: (c, e) => flapHope(c, e),
  pose: s => { const a = (s.ang || 0) * Math.PI / 180, x0 = k ? 3.4 : -3.4; return {o: [x0, 19.8, .12], x: [Math.cos(a), Math.sin(a), 0], y: [-Math.sin(a), Math.cos(a), 0]}; }});
const flapHope = (c, e) => { const w = c.get('whale'); w.flapT = 1; if (c.once('hope')) c.note('Hope 摆了摆胸鳍！它是一头真正的蓝鲸骨架，1891 年在爱尔兰搁浅。', e); };
const dinoSkeleton = art(24, 15, `${wc(`
  <path d="M10,96 Q60,70 110,74 Q140,62 160,40 Q172,26 196,30 L214,34 Q222,44 212,50 L192,52 Q176,56 170,70 Q166,88 150,96" fill="none" stroke="#efe9dc" stroke-width="7"/>
  ${rng(13, i => `<path d="M${30 + i * 9},${88 - i * 1.4} v-9" stroke="#efe9dc" stroke-width="4"/>`)}
  ${rng(8, i => `<path d="M${88 + i * 8},${80 - i} q4,22 -4,34" fill="none" stroke="#efe9dc" stroke-width="3.5"/>`)}
  <path d="M190,30 Q206,20 222,30 L232,38 Q236,50 222,54 L196,56 Z" fill="#efe9dc"/>${rng(5, i => `<path d="M${200 + i * 6},54 v6" stroke="${INK}" stroke-width="1.6"/>`)}
  <circle cx="210" cy="36" r="4" fill="#5b5048"/>
  <path d="M100,90 L92,128 L82,146 M92,128 L106,146 M132,92 L140,126 L130,146 M140,126 L156,146" fill="none" stroke="#efe9dc" stroke-width="6"/>
  <path d="M160,72 l10,16 l-6,6 M168,66 l12,14" fill="none" stroke="#efe9dc" stroke-width="4"/>
  <rect x="60" y="144" width="130" height="6" fill="#8a7a66"/>`, 1.3)}`);
const dinoArt = art(12, 8, wc(`
  <path d="M8,62 Q34,36 62,40 Q84,20 100,12 Q110,8 112,16 Q104,22 96,28 Q94,46 84,56 L86,74 H76 L72,60 H46 L42,74 H32 L32,60 Q18,68 8,62 Z" fill="#8aa36a"/>
  <circle cx="106" cy="14" r="2" fill="${INK}"/>${rng(5, i => `<path d="M${46 + i * 9},39 l3,-7 l3,7" fill="#6f8a52" stroke-width="1"/>`)}`));
const mosaic = (() => { const x0 = fx(-72), y0 = fz(-52), w = 1440, h = 860;
  return `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#4d5258"/>
    <rect x="${x0 + 22}" y="${y0 + 22}" width="${w - 44}" height="${h - 44}" fill="#e9e1cf"/>
    <rect x="${x0 + 40}" y="${y0 + 40}" width="${w - 80}" height="${h - 80}" fill="#cfc6b2"/>
    <clipPath id="mos"><rect x="${x0 + 52}" y="${y0 + 52}" width="${w - 104}" height="${h - 104}"/></clipPath>
    <g clip-path="url(#mos)">${rng(30, j => rng(52, k => { const cx = x0 + 52 + k * 28 + (j % 2) * 14, cy = y0 + 52 + j * 28;
      return `<path d="M${cx},${cy - 13} L${cx + 13},${cy} L${cx},${cy + 13} L${cx - 13},${cy} Z" fill="${(j + k) % 3 ? '#e7dfcc' : '#8d949b'}"/>`; }))}</g>
    <rect x="${x0 + 52}" y="${y0 + 52}" width="${w - 104}" height="${h - 104}" fill="none" stroke="#4d5258" stroke-width="6"/>`; })();
const leafArt = (inner, bg = '#f6efdf') => art(16, 12, `${wc(`<rect x="2" y="2" width="156" height="116" rx="4" fill="${bg}"/>`, 1.3)}
  <rect x="10" y="10" width="140" height="100" fill="none" stroke="#b9a37a" stroke-width="1.2" stroke-dasharray="4 3"/>${inner}`);
const leafText = (title, lines) => `<text x="80" y="38" text-anchor="middle" font-size="13" letter-spacing="1.5" fill="#7a5a32" font-family="Georgia, serif">${title}</text>
  ${lines.map((l, i) => `<text x="80" y="${64 + i * 20}" text-anchor="middle" font-size="14" fill="${INK}" font-family="Noto Serif SC, serif">${l}</text>`).join('')}`;
const leafIcon = icon => `<g transform="translate(80 62)">${icon}</g>`;
const MUSEUM_LEAVES = [
  [leafArt(`<text x="80" y="44" text-anchor="middle" font-size="15" letter-spacing="2" fill="#f6efdf" font-family="Georgia, serif">MUSEUM</text>
    <text x="80" y="62" text-anchor="middle" font-size="15" letter-spacing="2" fill="#f6efdf" font-family="Georgia, serif">NOTES</text>
    <text x="80" y="88" text-anchor="middle" font-size="12" fill="#e9d8b8" font-family="Noto Serif SC, serif">博物馆小册子 · 点我翻页</text>`, '#5d6b78'),
   leafArt(leafIcon(`<path d="M-44,10 q20,-30 58,-18 q22,6 32,-6 l-4,20 q-18,16 -46,12 q-24,-2 -40,-8 Z" fill="#e9e3d6" stroke="${INK}" stroke-width="2"/><text y="38" text-anchor="middle" font-size="13" fill="#7a5a32" font-family="Georgia, serif">HOPE</text>`))],
  [leafArt(leafText('THE BLUE WHALE', ['大厅里的蓝鲸骨架', '名字叫 Hope，', '长约 25 米。'])),
   leafArt(leafIcon(`<path d="M-40,14 Q-20,-10 6,-6 Q16,-28 32,-30 Q38,-24 30,-18 Q30,0 18,6 L20,20 H12 L10,10 H-12 L-14,20 H-22 L-20,10 Z" fill="#8aa36a" stroke="${INK}" stroke-width="2"/>`))],
  [leafArt(leafText('80 MILLION', ['馆里约有 8000 万件', '标本，从恐龙化石', '到太空陨石。'])),
   leafArt(leafIcon(`<rect x="-36" y="-26" width="72" height="52" fill="#dcc39a" stroke="${INK}" stroke-width="2"/>${rng(4, i => `<rect x="-36" y="${-20 + i * 13}" width="72" height="4" fill="#aab4bd"/>`)}<path d="M-12,-6 q12,-14 24,0 q-12,14 -24,0 Z" fill="#7d9a5c" stroke="${INK}" stroke-width="1.4"/>`))],
];
const BOOKLET = {X: 64, Z: 50, w: 16, h: 12};
const spread1 = {
  eyebrow: '10:00 · Natural History Museum', station: 'South Kensington', title: '自然史博物馆', en: 'Under the great roof', light: 'morning',
  story: '上午十点，走进自然史博物馆的大厅。两道铁拱横跨头顶，后墙是彩色玻璃窗和大楼梯，一副蓝鲸骨架从屋顶垂下来，好像正往下潜。拱和后墙都是跨过书脊的 V 折，两侧的拱廊立在各自的页面上。',
  todo: ['拉恐龙旁边的红色拉片（或者直接点恐龙），骨架会从地板上站起来。', '点蓝鲸 Hope，铆在肩上的两片胸鳍会前后摆动。', '点右下角的小册子，一页页翻开看博物馆的小知识。', '点一点小人。'],
  floor: floor(`${pageBg()}${frameLines}${mosaic}${plateBox}
    ${underBox(BOOKLET.X, BOOKLET.Z, BOOKLET.w, BOOKLET.h)}${grain(2000, 1300, .3)}`),
  texts: [...plateTexts('NATURAL HISTORY MUSEUM', 'Hintze Hall · Under the great roof', '自然史博物馆 · 上午 10:00', 'South Kensington'),
    ...underTexts(BOOKLET.X, BOOKLET.Z, BOOKLET.w, ['外墙的陶砖上', '刻满了动物和植物。'])],
  pieces: [
    {id: 'wall', type: 'v', Z: -50, sigma: -5, wl: 50, wr: 50, art: hallWall},
    {id: 'galL', type: 'stand', X: -57, Z: -12, yaw: 78, art: galleryArt},
    {id: 'galR', type: 'stand', X: 57, Z: -12, yaw: -78, art: {...galleryArt, svg: galleryArt.svg.replace('<defs>', '<g transform="translate(640 0) scale(-1 1)"><defs>').replace(/<\/svg>$/, '</g></svg>')}},
    {id: 'arch1', type: 'v', Z: -32, sigma: -6, wl: 66, wr: 66, art: trussArch(132, 66)},
    {id: 'arch2', type: 'v', Z: -10, sigma: -6, wl: 62, wr: 62, art: trussArch(124, 60)},
    {id: 'whale', type: 'v', Z: 4, sigma: -14, wl: 24, wr: 24, solidHit: true, art: whaleArt,
      tap: (c, e) => flapHope(c, e)},
    flipper('finL', 0), flipper('finR', 1),
    station(-14, 42, 'SOUTH KENSINGTON', '10:00'),
    {id: 'dino', type: 'stand', X: -38, Z: 20, raise: 0, solidHit: true, ease: 5, art: dinoSkeleton,
      tap: (c, e) => { const up = c.tabV('dino') < .5; c.tab('dino', up ? 1 : 0); c.note(up ? '嗷！恐龙骨架站起来了。博物馆的恐龙厅总是排着长队。' : '恐龙骨架又躺回地板上。', e); }},
    me(40, 26, 'point', '第一站：南肯辛顿的自然史博物馆！抬头看，蓝鲸好像正在往下潜。'),
    ...booklet({id: 'leaf', ...BOOKLET, leaves: MUSEUM_LEAVES, note: '小册子看完啦。再点翻过来的页，可以一页页翻回去。'}),
  ],
  controls: [{id: 'dino', tab: {icon: 'dino', color: '#6f8f4a'}, X: -22, Z: 15, len: 9, init: 0, apply: (v, c) => c.set('dino', {raise: v})}],
};

/* ======================= 2 · Westminster, golden hour ======================= */
const GOLDST = '#d9b166', GOLDD = '#b68e48';
const skylineDay = art(192, 24, (() => { const r = rand(23); let x = 0, s = '';
  while (x < 1920) { const w = 40 + r() * 90, h = 50 + r() * 110, c = r() < .5 ? '#c9d0cc' : '#d6d6cb'; s += `<rect x="${x}" y="${240 - h}" width="${w}" height="${h}" fill="${c}"/>`; x += w; }
  return wc(`${s}<path d="M300,240 V120 L320,70 L340,120 V240 Z" fill="#c4cbc6"/><path d="M1380,240 V130 A50,50 0 0 1 1480,130 V240 Z" fill="#cfd3cb"/>
    ${rng(26, i => `<circle cx="${i * 76 + 20}" cy="${200 - (i % 3) * 14}" r="${40 + (i % 4) * 8}" fill="${i % 2 ? '#93ab84' : '#a5b993'}"/>`)}
    <rect x="0" y="228" width="1920" height="12" fill="#8fa47e"/>`, 1.4); })());
const parliamentArt = art(144, 42, wc(`
  <rect x="0" y="210" width="1440" height="210" fill="${GOLDST}"/>
  <rect x="0" y="178" width="1440" height="34" fill="#7d8794"/>
  ${rng(40, i => `<polygon points="${8 + i * 36},180 ${18 + i * 36},130 ${28 + i * 36},180" fill="${GOLDD}" stroke-width="1.2"/>`)}
  ${rng(20, i => `<rect x="${i * 72}" y="200" width="14" height="220" fill="#e6c27c" stroke-width="1"/>`)}
  ${rng(3, r => rng(58, k => `<rect x="${20 + k * 24.4}" y="${232 + r * 64}" width="9" height="40" rx="4" fill="#7a6138" stroke="none"/>`))}
  <rect x="660" y="120" width="120" height="90" fill="${GOLDST}"/><polygon points="660,122 720,40 780,122" fill="#7d8794"/><path d="M720,40 V14" stroke-width="3"/>
  ${[340, 1060].map(x => `<rect x="${x}" y="150" width="60" height="60" fill="${GOLDST}"/><polygon points="${x - 4},152 ${x + 30},100 ${x + 64},152" fill="#7d8794"/>`).join('')}
  <rect x="1250" y="40" width="150" height="380" fill="${GOLDST}"/>
  ${[1250, 1376].map(x => `<rect x="${x}" y="12" width="24" height="40" fill="${GOLDD}"/><polygon points="${x},12 ${x + 12},-6 ${x + 24},12" fill="#7d8794"/>`).join('')}
  ${rng(5, r => rng(4, k => `<rect x="${1270 + k * 30}" y="${70 + r * 64}" width="12" height="44" rx="6" fill="#7a6138" stroke="none"/>`))}
  <path d="M1325,12 V-20" stroke-width="2"/><rect x="1326" y="-20" width="24" height="14" fill="${RED}" stroke-width="1"/>`, 1.6));
const bigBenArt = art(11, 62, `${wc(`
  <rect x="15" y="250" width="80" height="370" fill="#e1b462"/>
  ${[27, 41, 55, 69, 83].map(x => `<path d="M${x},262 V612" stroke="#b98a3e" stroke-width="1.6"/>`).join('')}
  ${rng(8, i => `<path d="M15,${290 + i * 42} H95" stroke="#c99a4e" stroke-width="1.4"/>`)}
  <rect x="8" y="150" width="94" height="104" fill="#d9a752"/><rect x="18" y="160" width="74" height="82" fill="#ecc777"/>
  <rect x="12" y="112" width="86" height="40" fill="#d9a752"/>${rng(5, i => `<path d="M${22 + i * 15},150 V126 a5,5 0 0 1 10,0 V150 Z" fill="#7a5a2a" stroke="none"/>`)}
  <polygon points="14,114 55,22 96,114" fill="#8e8a74"/><polygon points="34,114 55,52 76,114" fill="#a49c7c" stroke-width="1"/>
  <path d="M55,22 V2 M48,9 H62" stroke="${GOLD}" stroke-width="3"/>`, 1.6)}
  <circle cx="55" cy="201" r="30" fill="#faf4e4" stroke="${INK}" stroke-width="2.4"/>`);
// the clock face and its hands are separate pieces, so the hands can be turned
const BEN = {X: 56, Z: -22, cy: 62 * (1 - 201 / 620)};
const ringBen = (c, e) => { c.bong(); c.hop('ben'); if (e) c.note('当——！大本钟敲响啦。按住钟面绕圈拖，还可以拨动指针。', e); };
const clockFace = art(6.6, 6.6, `<circle cx="33" cy="33" r="31" fill="#faf4e4" stroke="${INK}" stroke-width="2.6"/>
  ${rng(12, i => { const a = i * Math.PI / 6; return `<line x1="${33 + 25 * Math.cos(a)}" y1="${33 + 25 * Math.sin(a)}" x2="${33 + 29 * Math.cos(a)}" y2="${33 + 29 * Math.sin(a)}" stroke="${INK}" stroke-width="${i % 3 ? 1.4 : 2.6}"/>`; })}`);
const hand = (len, wpx) => art(1.2, 6.6, `<path d="M6,33 L6,${33 - len}" stroke="${INK}" stroke-width="${wpx}" stroke-linecap="round"/><circle cx="6" cy="33" r="3.4" fill="${INK}"/>`);
// the hands are riveted at the centre of the clock face, which is glued to the tower (poses in the tower's frame)
const handPose = (dz, key) => (s) => { const a = (s[key] || 0) * Math.PI / 180;
  return {o: [0, BEN.cy, dz], x: [Math.cos(a), -Math.sin(a), 0], y: [Math.sin(a), Math.cos(a), 0]}; };
// Westminster Abbey's west front: twin towers with pinnacles and belfry louvres, the clock on the north tower, a great
// pointed window and gable in between, lit gold by the evening sun
const ABBEY = '#ecc98a', ABBEY_D = '#cfa96c';
const abbeyArt = art(16, 22, `${wc(`
  ${[6, 106].map((x, k) => `<rect x="${x}" y="40" width="48" height="180" fill="${k ? ABBEY_D : ABBEY}"/>
    <rect x="${x - 2}" y="34" width="52" height="8" fill="${ABBEY_D}"/>
    ${[0, 15, 30, 44].map(dx => `<polygon points="${x + dx - 1},34 ${x + dx + 2.5},12 ${x + dx + 6},34" fill="${ABBEY}"/>`).join('')}
    <path d="M${x + 14},92 V66 a10,12 0 0 1 20,0 V92 Z" fill="#7a6040"/>${rng(4, i => `<path d="M${x + 15},${70 + i * 5} H${x + 33}" stroke="${ABBEY}" stroke-width="1.6"/>`)}
    <path d="M${x + 12},170 V140 a12,14 0 0 1 24,0 V170 Z" fill="#9a8058"/>
    ${rng(5, i => `<path d="M${x},${100 + i * 24} H${x + 48}" stroke="${ABBEY_D}" stroke-width="1.4"/>`)}`).join('')}
  <rect x="54" y="72" width="52" height="148" fill="${ABBEY}"/><polygon points="54,74 80,46 106,74" fill="${ABBEY}"/>
  <path d="M80,40 V30 M75,34 H85" stroke-width="2"/>
  <path d="M62,160 V102 a18,26 0 0 1 36,0 V160 Z" fill="#6f6a7a"/>
  <path d="M80,82 V160 M71,95 V160 M89,95 V160 M62,120 H98 M62,140 H98" stroke="${ABBEY_D}" stroke-width="1.6"/>
  <path d="M68,220 V194 a12,14 0 0 1 24,0 V220 Z" fill="#5a4630"/>`, 1.3)}
  <circle cx="30" cy="112" r="9" fill="#1f2328" stroke="${GOLD}" stroke-width="1.6"/><path d="M30,112 L30,106 M30,112 L34,114" stroke="${GOLD}" stroke-width="1.4"/>`);
const EYE = {X: 77, Z: 17, cy: 17};
const eyeLegs = art(32, 34, wc(`<path d="M160,170 L104,336 M160,170 L216,336" stroke="#5d7387" stroke-width="8" stroke-linecap="round" fill="none"/><rect x="92" y="330" width="136" height="10" fill="#5d7387"/>
  <path d="M160,170 L130,250 M160,170 L190,250" stroke="#7b8ea0" stroke-width="3" fill="none"/>`));
const eyeWheel = art(33, 33, `<circle cx="165" cy="165" r="146" fill="none" stroke="#5d7387" stroke-width="5"/><circle cx="165" cy="165" r="134" fill="none" stroke="#8fb0c4" stroke-width="2"/>
  ${rng(16, i => { const a = i * Math.PI / 8; return `<line x1="165" y1="165" x2="${165 + 134 * Math.cos(a)}" y2="${165 + 134 * Math.sin(a)}" stroke="#8fb0c4" stroke-width="1.3"/>`; })}
  ${rng(32, i => { const a = i * Math.PI / 16; return `<ellipse cx="${165 + 154 * Math.cos(a)}" cy="${165 + 154 * Math.sin(a)}" rx="7.5" ry="5.5" fill="${i % 5 ? '#d2e6ef' : RED}" stroke="#5d7387" stroke-width="1.3"/>`; })}
  <circle cx="165" cy="165" r="11" fill="#5d7387"/>`);
const eyeWheelLit = art(33, 33, `<circle cx="165" cy="165" r="146" fill="none" stroke="#bfe3ff" stroke-width="4"/>
  ${rng(32, i => { const a = i * Math.PI / 16, x = 165 + 154 * Math.cos(a), y = 165 + 154 * Math.sin(a); return `<circle cx="${x}" cy="${y}" r="11" fill="${i % 2 ? '#ffd27a' : '#ff8fb8'}" opacity=".55" filter="url(#glow)"/><ellipse cx="${x}" cy="${y}" rx="6.5" ry="4.5" fill="#fff3c4"/>`; })}`);
// a K6 kiosk: domed roof with the crown, lit TELEPHONE panels, eight rows of small panes in the door
const phoneBox = art(8, 16, `${wc(`
  <rect x="0" y="148" width="80" height="12" fill="#8f2620"/>
  <rect x="6" y="34" width="68" height="116" fill="${RED}"/>
  <rect x="6" y="34" width="8" height="116" fill="#b5302a"/><rect x="66" y="34" width="8" height="116" fill="#b5302a"/>
  <path d="M2,30 Q40,2 78,30 Z" fill="${RED}"/><rect x="2" y="28" width="76" height="8" fill="#b5302a"/>
  <path d="M33,14 l2,-6 l3,4 l2,-5 l2,5 l3,-4 l2,6 Z" fill="#e0a83a" stroke-width="1"/>
  <rect x="12" y="38" width="56" height="10" fill="#1f2226"/>
  <rect x="17" y="54" width="46" height="88" fill="#a72a24"/>
  ${rng(8, r => rng(3, k => `<rect x="${19 + k * 15}" y="${56 + r * 10.8}" width="12" height="8.4" fill="#dce9ee" stroke-width=".8"/>`))}
  <rect x="58" y="96" width="4" height="12" rx="2" fill="${GOLD}" stroke="none"/>`, 1.3)}
  <text x="40" y="46" text-anchor="middle" font-size="7.5" letter-spacing="1" fill="#fbf6e8" font-family="Helvetica, Arial, sans-serif" font-weight="700">TELEPHONE</text>`);
const boatArt = art(26, 9, wc(`
  <path d="M6,56 H254 L236,84 H24 Z" fill="#f4f1ea"/><rect x="6" y="60" width="248" height="7" fill="${RED}" stroke="none"/>
  <rect x="40" y="26" width="170" height="32" rx="6" fill="#eef0f2"/>${rng(9, i => `<rect x="${50 + i * 17.5}" y="34" width="12" height="14" rx="2" fill="#6f8ea6" stroke-width="1"/>`)}
  <rect x="70" y="14" width="110" height="14" fill="#d9dde2"/>${rng(7, i => `<circle cx="${80 + i * 15}" cy="10" r="4" fill="${['#c94a3c', '#3f6fb5', '#e0b13e'][i % 3]}" stroke="none"/>`)}`, 1.4));
const railArt = (lampAt) => art(96, 12, `${wc(`
  <rect x="0" y="104" width="960" height="16" fill="#cfc6b4"/>
  <path d="M0,74 H960 M0,96 H960" stroke="#24272b" stroke-width="3"/>
  ${rng(64, i => `<path d="M${8 + i * 15},72 V104" stroke="#24272b" stroke-width="2"/><circle cx="${8 + i * 15}" cy="70" r="2.5" fill="#24272b" stroke="none"/>`)}
  ${rng(5, i => `<rect x="${i * 236}" y="62" width="20" height="44" fill="#d8d0bf"/>`)}
  ${lampAt.map(x => `<rect x="${x - 3}" y="16" width="6" height="90" fill="#24272b"/><polygon points="${x - 10},16 ${x + 10},16 ${x + 12},34 ${x - 12},34" fill="#e8c86a"/><polygon points="${x - 12},16 ${x},4 ${x + 12},16" fill="#24272b"/>`).join('')}`, 1.4)}`);
const instax = art(13, 12, `${wc(`
  <rect x="4" y="10" width="122" height="106" rx="18" fill="#e7d6f0"/><rect x="18" y="4" width="94" height="14" rx="4" fill="#cdb6dc"/>
  <rect x="24" y="8" width="82" height="4" fill="#3a3129" stroke="none"/>
  <circle cx="72" cy="70" r="32" fill="#cdb6dc"/><circle cx="72" cy="70" r="22" fill="#2b2f36"/><circle cx="72" cy="70" r="11" fill="#8fb0c4"/>
  <rect x="16" y="26" width="22" height="16" rx="3" fill="#2b2f36"/><circle cx="106" cy="32" r="6" fill="#f4efe2"/>`, 1.4)}
  <text x="104" y="108" text-anchor="middle" font-size="10" fill="#7a5f8a" font-family="Georgia, serif">instax</text>`);
const polaroid = art(10, 11.5, `<rect x="2" y="2" width="96" height="111" fill="#fbf8f1" stroke="#d8cfbd" stroke-width="2"/>
  <image href="${BIGBEN_PHOTO}" x="8" y="8" width="84" height="84" preserveAspectRatio="xMidYMid slice"/>
  <text x="50" y="106" text-anchor="middle" font-size="9" fill="#5b4a3a" font-family="Georgia, serif" font-style="italic">15:00 · Big Ben</text>`);
const POSTCARD = {X: 70, Z: 53, w: 20, h: 13};
const pcFront = art(20, 13, `${wc(`<rect x="2" y="2" width="196" height="126" rx="4" fill="#f3e4c2"/>
  <rect x="10" y="10" width="180" height="110" fill="#f6d79a"/><circle cx="150" cy="40" r="16" fill="#f3b45a"/>
  <path d="M10,96 Q60,84 100,92 T190,88 V120 H10 Z" fill="#7f9fb3"/>
  <rect x="96" y="40" width="18" height="60" fill="#e1b462"/><rect x="92" y="28" width="26" height="16" fill="#d9a752"/><polygon points="92,28 105,8 118,28" fill="#8e8a74"/><circle cx="105" cy="36" r="5" fill="#faf4e4"/>
  <rect x="20" y="70" width="70" height="26" fill="#d9b166"/>${rng(8, i => `<polygon points="${22 + i * 9},70 ${26 + i * 9},62 ${30 + i * 9},70" fill="#b68e48" stroke-width="1"/>`)}`, 1.3)}
  <text x="100" y="118" text-anchor="middle" font-size="11" letter-spacing="2" fill="#f6efdf" font-family="Georgia, serif" font-style="italic">Greetings from Westminster</text>`);
const pcBack = art(20, 13, `<rect x="2" y="2" width="196" height="126" rx="4" fill="#fbf6ea" stroke="#d8cfbd" stroke-width="2"/>
  <path d="M110,16 V114" stroke="#c9bb9b" stroke-width="1.4"/>${rng(3, i => `<path d="M118,${70 + i * 14} H186" stroke="#c9bb9b" stroke-width="1.2"/>`)}
  <rect x="160" y="12" width="28" height="32" fill="#c8423a"/><rect x="164" y="16" width="20" height="24" fill="#e7b9a8"/>
  <circle cx="146" cy="36" r="14" fill="none" stroke="#5f86a3" stroke-width="1.6" opacity=".8"/><text x="146" y="40" text-anchor="middle" font-size="7" fill="#5f86a3" font-family="Georgia, serif">LONDON</text>
  <text x="14" y="34" font-size="12" fill="#3f4f6b" font-family="Noto Serif SC, serif">Hi! 今天的发现：</text>
  <text x="14" y="58" font-size="12" fill="#3f4f6b" font-family="Noto Serif SC, serif">大本钟的分针长约</text>
  <text x="14" y="78" font-size="12" fill="#3f4f6b" font-family="Noto Serif SC, serif">4.2 米，和一辆双层</text>
  <text x="14" y="98" font-size="12" fill="#3f4f6b" font-family="Noto Serif SC, serif">巴士差不多高！</text>`);
// tap the London Eye: it starts turning and its capsules light up; tap again to stop
const eyeTap = (c, e) => { const w = c.get('wheel'); w.on = !w.on;
  c.note(w.on ? '伦敦眼亮灯啦，慢慢转起来。它高 135 米，转一圈大约半小时。' : '伦敦眼停下来，灯也熄了。', e); };
const spread2 = {
  eyebrow: '15:00 · Westminster', station: 'Westminster', title: '威斯敏斯特', en: 'Along the Thames', light: 'afternoon',
  story: '下午三点，站在南岸看对面的威斯敏斯特宫：议会大厦是一道跨过书脊的 V 折长立面，北端是大本钟，南端是维多利亚塔，西敏寺的双塔从后面探出头来；这一侧的河岸上是伦敦眼和红色电话亭。点一点钟楼，大本钟就会敲响；拨动它的指针让时间往后走，夕阳会把整片河岸慢慢染成金色。',
  todo: ['点钟楼，大本钟会敲响。', '点伦敦眼，它会亮灯并慢慢转起来；再点一下停下。', '按住大本钟的钟面绕圈拖动，拨动指针：顺时针时间往后走，天色从午后变成金色的傍晚；每到整点会敲钟。', '点小人身边的拍立得，咔嚓一声，照片会慢慢出来；再点一下照片收回去。', '游船下面有一条轨道：拉船旁边的拉片，或者直接拖动船，让它沿河左右开。', '点右下角的明信片，它会翻个面，背面写着今天的小发现。'],
  floor: floor(`${pageBg()}
    <rect x="0" y="0" width="2000" height="${fz(-20)}" fill="#a9bf86"/>
    ${rng(40, i => `<circle cx="${i * 52 + 10}" cy="${60 + (i % 3) * 30}" r="${36 + (i % 4) * 8}" fill="${i % 2 ? '#8fa874' : '#9db384'}"/>`)}
    <rect x="0" y="${fz(-20)}" width="2000" height="${fz(19) - fz(-20)}" fill="#7f9fb3"/>
    ${(() => { const r = rand(31); return rng(110, () => { const x = r() * 1960, y = fz(-18) + r() * 360; return `<path d="M${x},${y} q10,-7 20,0 q10,-7 20,0" fill="none" stroke="#e4ecef" stroke-width="2.4" opacity=".75"/>`; }); })()}
    ${(() => { const r = rand(37); return rng(70, () => { const x = 300 + r() * 1400, y = fz(-16) + r() * 340; return `<path d="M${x},${y} h${14 + r() * 40}" stroke="#f3cf7d" stroke-width="4" opacity=".7"/>`; }); })()}
    <rect x="0" y="${fz(19)}" width="2000" height="14" fill="#d1c8b4"/>
    <rect x="0" y="${fz(19) + 14}" width="2000" height="${1300 - fz(19)}" fill="#e3dccd"/>
    ${rng(12, i => `<path d="M0,${fz(24) + i * 40} H2000" stroke="#cbc2b0" stroke-width="1.6"/>`)}${rng(26, i => `<path d="M${i * 80 + (i % 2) * 40},${fz(24)} V1300" stroke="#cbc2b0" stroke-width="1.2"/>`)}
    ${plateBox}
    <rect x="${fx(POSTCARD.X - POSTCARD.w / 2)}" y="${fz(POSTCARD.Z - POSTCARD.h / 2)}" width="${POSTCARD.w * 10}" height="${POSTCARD.h * 10}" fill="#000" opacity=".06"/>
    ${grain(2000, 1300, .3)}`),
  texts: [...plateTexts('WESTMINSTER', 'Along the Thames', '威斯敏斯特 · 下午 15:00', 'Westminster')],
  pieces: [
    {id: 'sky', type: 'v', Z: -59, sigma: -3, wl: 96, wr: 96, art: skylineDay},
    // seen from the South Bank: the Victoria Tower at the south (left) end, Big Ben at the north (right) end, the Abbey behind
    {id: 'abbey', type: 'stand', X: -84, Z: -44, art: abbeyArt, tap: (c, e) => c.note('西敏寺就在议会大厦后面，英国国王的加冕礼都在这里举行。', e)},
    {id: 'parl', type: 'v', Z: -36, sigma: -9, wl: 72, wr: 72, art: mirror(parliamentArt), tap: (c, e) => c.note('议会大厦（威斯敏斯特宫）里大约有 1100 个房间。', e)},
    {id: 'ben', type: 'stand', X: BEN.X, Z: BEN.Z, art: bigBenArt, tap: (c, e) => ringBen(c, e)},
    {id: 'clockFace', type: 'custom', anchor: 'center', parent: 'ben', art: clockFace, pose: () => ({o: [0, BEN.cy, .12], x: [1, 0, 0], y: [0, 1, 0]}),
      dial: (deg, c) => c.tab('time', c.tabV('time') + deg / 360 * 60 / 240), tap: (c, e) => c.note('按住钟面，顺时针绕圈拖动，时间就往后走。', e)},
    {id: 'hourH', type: 'custom', anchor: 'center', parent: 'ben', art: hand(17, 4.5), pose: handPose(.24, 'ang')},
    {id: 'minH', type: 'custom', anchor: 'center', parent: 'ben', art: hand(27, 2.6), pose: handPose(.34, 'ang')},
    {id: 'boat', type: 'stand', X: -78, Z: 2, art: boatArt, ease: 4, drag: 'boat', tap: (c, e) => { c.hop('boat'); c.note('坐游船沿河往东，就能一路看到塔桥。', e); }},
    {id: 'eye', type: 'stand', X: EYE.X, Z: EYE.Z, art: eyeLegs, tap: (c, e) => eyeTap(c, e)},
    {id: 'wheel', type: 'custom', anchor: 'center', solidHit: true, art: eyeWheel, artLit: eyeWheelLit, ownLight: true, ang: 0, tap: (c, e) => eyeTap(c, e),
      tick: (s, dt) => { s.spin = (s.spin || 0) + ((s.on ? 1 : 0) - (s.spin || 0)) * Math.min(1, dt * 1.5); s.ang = ((s.ang || 0) + dt * 14 * s.spin) % 360; },
      parent: 'eye', pose: s => { const a = (s.ang || 0) * Math.PI / 180; return {o: [0, EYE.cy, .15], x: [Math.cos(a), -Math.sin(a), 0], y: [Math.sin(a), Math.cos(a), 0]}; }},
    {id: 'phone', type: 'stand', X: 22, Z: 30, w: 13.1, h: 26.2, art: phoneBox, tap: (c, e) => c.note('红色电话亭：伦敦街头最上镜的背景。', e)},
    {id: 'railL', type: 'stand', X: -50, Z: 21, art: railArt([70])},
    {id: 'railR', type: 'stand', X: 50, Z: 21, art: mirror(railArt([70]))},
    station(-24, 31, 'WESTMINSTER', '15:00'),
    me(38, 38, 'camera', '这里是南岸，对面就是威斯敏斯特宫。在电话亭旁边拍一张！'),
    {id: 'cam', type: 'stand', X: 54, Z: 44, w: 17, h: 15.6, art: instax,
      tap: (c, e) => { const out = c.get('photo').opened; c.toggle('photo'); if (!out) c.shutter(); if (c.once('photo')) c.note('咔嚓！照片慢慢从相机里出来了。', e); }},
    {id: 'photo', type: 'custom', X: 54, Z: 43.6, w: 13, h: 15, art: polaroid, speed: 2.5, tap: c => c.toggle('photo'),
      parent: 'cam', pose: (s, rise, p) => ({o: [0, .8 + 13.5 * smoothstep(p.open), -.4], x: [1, 0, 0], y: [0, 1, 0]})},
    postcard({id: 'postcard', ...POSTCARD, front: pcFront, back: pcBack, note: '明信片翻过来，背面写着今天的小发现。再点一下翻回去。'}),
  ],
  controls: [
    // time runs from 15:00 (v = 0) to 19:00 (v = 1), turned by the clock hands
    {id: 'time', hidden: true, X: BEN.X, Z: BEN.Z, len: 10, init: 0, apply: (v, c) => {
      const t = 900 + v * 240, h = t / 60, hr = Math.floor(h + 1e-6), clk = c.get('clockFace');
      c.set('hourH', {ang: (h % 12) * 30}); c.set('minH', {ang: (t % 60) * 6});
      if (h <= 17.5) c.light('afternoon', 'golden', clamp01((h - 16) / 1.5)); else c.light('golden', 'evening', clamp01((h - 17.5) / 1.5));
      if (clk.hr !== undefined && hr !== clk.hr) c.bong(); clk.hr = hr;
    }},
    // the boat runs on a track along the river; its tab rides beside it
    {id: 'boat', tab: {icon: 'boat', color: '#2f5f8a'}, slotW: .7, X: -78, Z: 9, dir: [1, 0, 0], len: 156, init: 0, apply: (v, c) => c.set('boat', {X: -78 + v * 156})},
  ],
};

/* ======================= 3 · West End, a night at the theatre ======================= */
const BRICK = '#b5523f', CREAM = '#e9dcc0';
// the SIX sign hangs out from the theatre front on an iron bracket, so it faces down the street (toward you)
const sixSign = lit => art(16, 14, lit
  ? `<rect x="10" y="40" width="140" height="92" fill="#1e2552" opacity=".25"/>${rng(18, i => `<circle cx="${12 + i * 8}" cy="40" r="3.2" fill="#fff2b0"/><circle cx="${12 + i * 8}" cy="132" r="3.2" fill="#fff2b0"/>`)}
     ${rng(11, i => `<circle cx="10" cy="${44 + i * 8}" r="3.2" fill="#fff2b0"/><circle cx="150" cy="${44 + i * 8}" r="3.2" fill="#fff2b0"/>`)}
     <text x="80" y="112" text-anchor="middle" font-size="54" font-family="Georgia, serif" fill="#f7ffe6">SIX</text><circle cx="80" cy="86" r="40" fill="#f0f8d0" opacity=".25" filter="url(#glow)"/>`
  : `${wc(`<path d="M150,4 V20 M150,12 H60 Q30,12 30,28 Q30,38 40,36" fill="none" stroke="#1d1d1d" stroke-width="3.5"/>
      <path d="M60,12 q-10,-10 -20,0 q10,10 20,0 M100,12 q-10,-10 -20,0" fill="none" stroke="#1d1d1d" stroke-width="2"/>
      <path d="M40,36 V40 M120,12 V40" stroke="#1d1d1d" stroke-width="2.5"/>
      <rect x="6" y="40" width="148" height="96" fill="#1e2552"/>`, 1.4)}
    ${rng(18, i => `<circle cx="${12 + i * 8}" cy="44" r="3" fill="#c9b37a"/><circle cx="${12 + i * 8}" cy="132" r="3" fill="#c9b37a"/>`)}
    <text x="80" y="112" text-anchor="middle" font-size="54" font-family="Georgia, serif" fill="#dfe8c8">SIX</text>
    <path d="M72,74 l3,-8 l4,5 l4,-6 l4,6 l4,-5 l3,8 Z" fill="#e8b83a"/>`);
const win = (x, y, w = 22, h = 34, lit = false) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${lit ? '#f6cf7a' : '#3e4656'}" stroke="#f1e6cf" stroke-width="3"/>`;
const facadeRow = (blocks, H, lit) => blocks.map(([x, w, top, color, kind]) => {
  let s = lit ? '' : `<rect x="${x}" y="${top}" width="${w}" height="${H - top}" fill="${color}"/>`;
  const floors = Math.floor((H - top - 110) / 62);
  for (let f = 0; f < floors; f++) for (let k = 0; k < Math.floor((w - 20) / 40); k++) {
    const on = ((f * 7 + k * 3 + x) % 5) < 2;
    if (!lit || on) s += win(x + 18 + k * 40, top + 28 + f * 62, 22, 34, lit && on);
  }
  if (!lit) s += `<rect x="${x}" y="${top}" width="${w}" height="10" fill="#d8ccb2"/>${kind === 'chim' ? `<rect x="${x + 20}" y="${top - 30}" width="22" height="30" fill="#8a4a3a"/><rect x="${x + w - 50}" y="${top - 26}" width="22" height="26" fill="#8a4a3a"/>` : ''}${kind === 'dome' ? `<path d="M${x + w / 2 - 40},${top} A40,46 0 0 1 ${x + w / 2 + 40},${top} Z" fill="#59606b"/><path d="M${x + w / 2},${top - 46} v-20" stroke-width="3"/>` : ''}`;
  s += `<rect x="${x + 6}" y="${H - 96}" width="${w - 12}" height="86" fill="${lit ? '#ffcf7e' : '#4a3b30'}" ${lit ? 'opacity=".95"' : ''}/>`;
  if (!lit) s += rng(Math.floor((w - 20) / 30), k => `<rect x="${x + 16 + k * 30}" y="${H - 70}" width="10" height="56" fill="#2b2420" stroke="none"/>`);
  return s;
}).join('');
const bulbs = (x, y, w, h, lit) => rng(Math.floor(w / 14), i => `<circle cx="${x + 7 + i * 14}" cy="${y}" r="3.5" fill="${lit ? '#fff2b0' : '#c9b37a'}"/><circle cx="${x + 7 + i * 14}" cy="${y + h}" r="3.5" fill="${lit ? '#fff2b0' : '#c9b37a'}"/>`);
// the Strand at dusk: pale stone buildings with cornices and shopfronts; on the right side the SIX sign hangs from its
// iron bracket over the stained-glass VAUDEVILLE canopy, with the Adelphi further down
const STONE1 = '#e6dccb', STONE2 = '#d8cdbb', STONE3 = '#cdbfa8';
const stoneRow = (blocks, H, lit) => blocks.map(([x, w, top, color]) => {
  let out = '';
  const floors = Math.floor((H - top - 120) / 60), cols = Math.floor((w - 20) / 38);
  if (!lit) out += `<rect x="${x}" y="${top}" width="${w}" height="${H - top}" fill="${color}"/><rect x="${x - 4}" y="${top}" width="${w + 8}" height="9" fill="#bfb29b"/>
    ${rng(floors, f => `<rect x="${x}" y="${top + 66 + f * 60}" width="${w}" height="4" fill="#c8bba3"/>`)}`;
  for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) {
    const on = ((f * 5 + k * 3 + x) % 4) < 2, wx = x + 16 + k * 38, wy = top + 22 + f * 60;
    if (!lit) out += `<path d="M${wx},${wy + 38} V${wy + 8} a10,8 0 0 1 20,0 V${wy + 38} Z" fill="#4a5262" stroke="#f1e9d8" stroke-width="2.4"/>`;
    else if (on) out += `<path d="M${wx},${wy + 38} V${wy + 8} a10,8 0 0 1 20,0 V${wy + 38} Z" fill="#f6cf7a"/>`;
  }
  out += `<rect x="${x + 4}" y="${H - 100}" width="${w - 8}" height="92" fill="${lit ? '#ffcf7e' : '#3d332b'}"/>`;
  if (!lit) out += `<rect x="${x}" y="${H - 108}" width="${w}" height="10" fill="#2a2420"/>`;
  return out;
}).join('');
// Cosette, as on every Les Mis poster: an engraved girl with a broom, in front of a torn red flag on blue
// watercolour edges for the shapes only: lettering and fine drawings (marked <!--C-->…<!--/C-->) stay crisp on top
const wcCrisp = (str, k) => { const crisp = [];
  str = str.replace(/<!--C-->[\s\S]*?<!--\/C-->/g, m => (crisp.push(m), '')).replace(/<text[^>]*>[^<]*<\/text>/g, m => (crisp.push(m), ''));
  return wc(str, k) + crisp.join(''); };
// Cosette, drawn like the book's own little people: inked outlines, a round face with big shiny eyes and pink
// cheeks, a mop of messy hair, a patched shirt and her broom, with the torn red flag flying behind her on blue.
// Drawn in a 100-wide box; the watercolour filter sits outside the scaling so the line wobble is the same at any size
let cosetteN = 0;
const cosette = (x, y, w, h, o = 1) => { const id = `cos${cosetteN++}`, k = w / 100, hh = h / k, g = Math.min(1, hh / 88), SK = '#f6dcc4', HR = '#4a3426';
  const star = (sx, sy, r) => `<path d="M${sx},${sy - r} Q${sx},${sy} ${sx + r},${sy} Q${sx},${sy} ${sx},${sy + r} Q${sx},${sy} ${sx - r},${sy} Q${sx},${sy} ${sx},${sy - r} Z" fill="#fff4c8" stroke="none"/>`;
  return `<!--C--><g opacity="${o}">${wc(`<g transform="translate(${x} ${y}) scale(${k})">
    <clipPath id="${id}"><rect width="100" height="${hh}"/></clipPath><g clip-path="url(#${id})">
    <rect width="100" height="${hh}" fill="#3b63b8" stroke="none"/>
    ${star(12, hh * .12, 2.6)}${star(88, hh * .08, 2)}${star(8, hh * .45, 1.6)}${star(93, hh * .5, 2.2)}
    <path d="M-2,${hh * .2} Q22,${hh * .04} 48,${hh * .16} Q74,${hh * .26} 102,${hh * .1} V${hh * .6} Q78,${hh * .72} 52,${hh * .6} Q26,${hh * .48} -2,${hh * .64} Z" fill="#d23a30"/>
    <path d="M10,${hh * .3} Q30,${hh * .22} 46,${hh * .32} M58,${hh * .44} Q78,${hh * .5} 96,${hh * .38}" fill="none" stroke="#f06a58" stroke-width="1.4"/>
    <ellipse cx="86" cy="${hh * .3}" rx="3" ry="2" fill="#3b63b8"/><ellipse cx="18" cy="${hh * .52}" rx="2.4" ry="1.6" fill="#3b63b8"/>
    <g transform="translate(${50 - 50 * g} ${hh - 88 * g}) scale(${g})">
      <path d="M68,92 L88,18" stroke="#8a5a32" stroke-width="3.4"/>
      <path d="M83,22 L80,4 Q88,0 96,6 L91,24 Z" fill="#e2b45a"/><path d="M84,8 l2,12 M88,6 l1,14 M92,8 l-1,12" stroke="#b8862e" stroke-width=".8"/>
      <path d="M17,90 Q19,62 50,59 Q81,62 83,90 Z" fill="#f4efe4"/>
      <path d="M42,61 L50,72 L58,61" fill="none" stroke-width="1.2"/>
      <rect x="27" y="74" width="11" height="9" rx="1" fill="#c9b48a" transform="rotate(-8 32 78)"/>
      <path d="M28,76 h9 M28,81 h9" stroke="#8a6a3a" stroke-width=".7" stroke-dasharray="1.6 1.4" transform="rotate(-8 32 78)"/>
      <circle cx="75" cy="66" r="5" fill="${SK}"/>
      <path d="M26,60 L22,48 Q15,25 32,13 Q50,1 68,13 Q85,25 78,48 L74,60 L70,52 L66,60 L61,51 H39 L34,60 L30,52 Z" fill="${HR}"/>
      <path d="M45,9 q1,-7 6,-8 M55,10 q4,-5 9,-3 M38,13 q-4,-4 -9,-3" fill="none" stroke="${HR}" stroke-width="2.6"/>
      <ellipse cx="50" cy="38" rx="18" ry="19" fill="${SK}"/>
      <path d="M31,35 Q31,16 50,15 Q69,16 69,35 L64,26 L60,34 L55,24 L50,33 L45,24 L40,34 L36,26 Z" fill="${HR}"/>
      <path d="M32,33 Q28,46 33,57 L35,46 Z M68,33 Q72,46 67,57 L65,46 Z" fill="${HR}"/>
      <path d="M39,34.5 L46,32.6 M54,32.6 L61,34.5" stroke-width="1.3"/>
      <ellipse cx="43" cy="40.5" rx="3.7" ry="4.5" fill="${INK}" stroke="none"/><ellipse cx="57" cy="40.5" rx="3.7" ry="4.5" fill="${INK}" stroke="none"/>
      <circle cx="44.4" cy="39" r="1.4" fill="#fff" stroke="none"/><circle cx="58.4" cy="39" r="1.4" fill="#fff" stroke="none"/>
      <circle cx="42" cy="42.6" r=".7" fill="#fff" stroke="none"/><circle cx="56" cy="42.6" r=".7" fill="#fff" stroke="none"/>
      <ellipse cx="37" cy="47" rx="3.6" ry="2.1" fill="#ef9f92" opacity=".7" stroke="none"/><ellipse cx="63" cy="47" rx="3.6" ry="2.1" fill="#ef9f92" opacity=".7" stroke="none"/>
      <ellipse cx="63.5" cy="43" rx="1.8" ry="1" fill="#b8a898" opacity=".6" stroke="none"/>
      <path d="M47.5,50 Q50,51.6 52.5,50" fill="none" stroke-width="1.2"/>
    </g></g></g>`, 1.5 / k)}</g><!--/C-->`; };
// the barricade mural over the Sondheim's side wall: students climbing the barricade, one waving the red flag
const barricade = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1b1c22"/>
  <path d="M${x},${y + h} V${y + h * .62} l${w * .1},-${h * .08} l${w * .08},${h * .1} l${w * .12},-${h * .18} l${w * .14},${h * .06} l${w * .1},-${h * .14} l${w * .12},${h * .12} l${w * .14},-${h * .1} l${w * .1},${h * .14} l${w * .1},-${h * .04} V${y + h} Z" fill="#3b3631"/>
  ${rng(7, k => `<path d="M${x + w * (.06 + k * .13)},${y + h * (.95 - (k % 3) * .06)} l${w * .1},-${h * .2}" stroke="#57504a" stroke-width="5"/>`)}
  <circle cx="${x + w * .2}" cy="${y + h * .9}" r="${h * .1}" fill="none" stroke="#6a5a48" stroke-width="4"/>
  ${[[.16, .66, '#c99a4a'], [.36, .74, '#b9783a'], [.64, .7, '#d6a65a'], [.84, .62, '#a8703a'], [.5, .86, '#caa060']].map(([px, py, col], k) => { const fx0 = x + w * px, fy = y + h * py;
    return `<path d="M${fx0 - 16},${fy + 40} q16,-50 32,0 Z" fill="${col}"/><path d="M${fx0 - 10},${fy + 12} h20" stroke="#6a4a2a" stroke-width="3"/>
    <circle cx="${fx0}" cy="${fy - 4}" r="10" fill="#d9b48c"/><path d="M${fx0 - 10},${fy - 7} q10,-12 20,0" fill="#3a2a20"/>
    <path d="M${fx0 + (k % 2 ? 10 : -10)},${fy + 10} l${k % 2 ? 12 : -12},-30" stroke="${col}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="${fx0 + (k % 2 ? 22 : -22)}" cy="${fy - 22}" r="4.5" fill="#d9b48c"/>`; }).join('')}
  <path d="M${x + w * .5 - 15},${y + h * .54} q15,-44 30,0 Z" fill="#b8402e"/><path d="M${x + w * .5 - 8},${y + h * .54} v26 M${x + w * .5 + 8},${y + h * .54} v26" stroke="#2a3050" stroke-width="8"/>
  <path d="M${x + w * .5 - 13},${y + h * .44} q13,-8 26,0" stroke="#e8c050" stroke-width="5" fill="none"/><circle cx="${x + w * .5}" cy="${y + h * .36}" r="9" fill="#3a2a20"/>
  <path d="M${x + w * .5 + 6},${y + h * .46} L${x + w * .66},${y + h * .12}" stroke="#d8d0c0" stroke-width="2.5"/>
  <path d="M${x + w * .66},${y + h * .12} Q${x + w * .5},${y - h * .02} ${x + w * .3},${y + h * .08} Q${x + w * .36},${y + h * .2} ${x + w * .3},${y + h * .32} Q${x + w * .5},${y + h * .2} ${x + w * .68},${y + h * .3} Z" fill="#d23a2c"/>`;
// the LED ribbon under the Sondheim's mural
const marquee = (x, y, w, text, lit) => `<rect x="${x}" y="${y}" width="${w}" height="26" fill="${lit ? '#a8341a' : '#7a1d16'}"/>
  <rect x="${x}" y="${y}" width="${w}" height="26" fill="none" stroke="#e8a040" stroke-width="2" opacity="${lit ? 1 : .5}"/>
  <text x="${x + w / 2}" y="${y + 18}" text-anchor="middle" font-size="12" font-weight="700" textLength="${w - 20}" lengthAdjust="spacingAndGlyphs" fill="${lit ? '#fff0b0' : '#f2c27a'}" font-family="Impact, Helvetica, Arial, sans-serif">${text}</text>`;
// a lightbox poster ringed with bulbs, hung out over the pavement
const lightbox = (x, y, w, h, inner, lit) => `<rect x="${x - 8}" y="${y - 8}" width="${w + 16}" height="${h + 16}" fill="${lit ? '#fff6d8' : '#e9e2cf'}"/>
  ${rng(Math.floor(w / 9) + 2, k => `<circle cx="${x - 4 + k * 9}" cy="${y - 4}" r="2.4" fill="${lit ? '#ffffff' : '#c9b37a'}"/><circle cx="${x - 4 + k * 9}" cy="${y + h + 4}" r="2.4" fill="${lit ? '#ffffff' : '#c9b37a'}"/>`)}
  ${rng(Math.floor(h / 9) + 1, k => `<circle cx="${x - 4}" cy="${y + 5 + k * 9}" r="2.4" fill="${lit ? '#ffffff' : '#c9b37a'}"/><circle cx="${x + w + 4}" cy="${y + 5 + k * 9}" r="2.4" fill="${lit ? '#ffffff' : '#c9b37a'}"/>`)}${inner}`;
const vSign = (x, y, h, name, lit, bg = '#1d3f8a') => `<rect x="${x}" y="${y}" width="22" height="${h}" rx="3" fill="${bg}" stroke="#0e1a3a" stroke-width="2"/>
  ${[...name].map((ch, k) => `<text x="${x + 11}" y="${y + 20 + k * ((h - 14) / name.length)}" text-anchor="middle" font-size="15" fill="${lit ? '#f4f8ff' : '#dfe6f4'}" font-family="Georgia, serif">${ch}</text>`).join('')}`;
// Shaftesbury Avenue, from the corner inward: the Sondheim's black side wall with the barricade mural and its blue
// title banner, then its stone front (stained-glass canopy, "the world's longest running musical", Cosette in a
// bulb-ringed lightbox), the Gielgud's tall sign, and the red-and-white banded Apollo with Oliver! hung outside
const leftStreet = lit => {
  const H = 520, bandedWins = (x, w, top) => rng(3, f => rng(Math.floor((w - 20) / 44), k => `<rect x="${x + 18 + k * 44}" y="${top + 40 + f * 70}" width="24" height="40" fill="${lit ? ((f + k) % 2 ? '#f6cf7a' : 'none') : '#3e4656'}" ${lit ? '' : 'stroke="#f4ece0" stroke-width="5"'}/>`));
  const sondheim = lit
    ? `<rect x="10" y="66" width="300" height="62" fill="#1a3a9a" opacity=".55"/>
       <text x="160" y="112" text-anchor="middle" font-size="40" textLength="270" lengthAdjust="spacingAndGlyphs" fill="#e8f0ff" font-family="Georgia, serif">Les Misérables</text>
       ${rng(12, k => `<circle cx="${22 + k * 25}" cy="${76 + (k % 3) * 18}" r="1.6" fill="#ffffff"/>`)}
       ${barricade(16, 146, 288, 246)}<rect x="16" y="146" width="288" height="246" fill="#000" opacity=".25"/>
       ${marquee(0, 400, 320, 'STILL THE WORLD’S MOST POPULAR MUSICAL', true)}${rng(7, k => `<rect x="${30 + k * 42}" y="444" width="34" height="70" fill="#ffcf7e"/>`)}`
    : `<rect x="0" y="40" width="320" height="${H - 40}" fill="#24252b"/>${rng(5, k => `<rect x="${10 + k * 62}" y="46" width="52" height="16" fill="#3a3e4a"/>`)}
       <rect x="10" y="66" width="300" height="62" fill="#1d2f72"/>
       <text x="160" y="112" text-anchor="middle" font-size="40" textLength="270" lengthAdjust="spacingAndGlyphs" fill="#dfe7f6" font-family="Georgia, serif">Les Misérables</text>
       ${rng(12, k => `<circle cx="${22 + k * 25}" cy="${76 + (k % 3) * 18}" r="1.6" fill="#c9d4f0"/>`)}
       ${barricade(16, 146, 288, 246)}${marquee(0, 400, 320, 'STILL THE WORLD’S MOST POPULAR MUSICAL', false)}
       <rect x="10" y="434" width="300" height="80" fill="#3d332b"/>${rng(7, k => `<rect x="${22 + k * 42}" y="444" width="6" height="70" fill="#1d1a18"/>`)}`;
  const front = lit
    ? `${rng(2, f => rng(4, k => (f + k) % 2 ? `<path d="M${346 + k * 52},${150 + f * 70} V${122 + f * 70} a12,9 0 0 1 24,0 V${150 + f * 70} Z" fill="#f6cf7a"/>` : ''))}
       ${lightbox(372, 236, 70, 90, cosette(372, 236, 70, 90, .7), true)}
       <rect x="330" y="378" width="230" height="22" fill="#e8823a" opacity=".6"/>${rng(5, k => `<circle cx="${352 + k * 46}" cy="389" r="7" fill="${['#f04030', '#40c070', '#f0b030', '#40a0f0', '#f04030'][k]}"/>`)}
       <rect x="350" y="404" width="190" height="32" fill="#2a60e0" opacity=".8"/>
       <text x="445" y="425" text-anchor="middle" font-size="12" textLength="176" lengthAdjust="spacingAndGlyphs" fill="#ffffff" font-family="Georgia, serif">THE WORLD’S LONGEST RUNNING MUSICAL</text>
       ${rng(5, k => `<rect x="${344 + k * 42}" y="462" width="34" height="52" fill="#ffcf7e"/>`)}${vSign(536, 130, 170, 'GIELGUD', true, '#1d3a2a')}`
    : `<rect x="320" y="70" width="240" height="${H - 70}" fill="${STONE1}"/><rect x="316" y="70" width="248" height="10" fill="#bfb29b"/>
       ${rng(2, f => `<rect x="320" y="${160 + f * 70}" width="240" height="4" fill="#c8bba3"/>${rng(4, k => `<path d="M${346 + k * 52},${150 + f * 70} V${122 + f * 70} a12,9 0 0 1 24,0 V${150 + f * 70} Z" fill="#4a5262" stroke="#f1e9d8" stroke-width="2.4"/>`)}`)}
       <path d="M446,232 H360 M372,226 v10 M436,226 v10" stroke="#1d1d1d" stroke-width="3"/>
       ${lightbox(372, 236, 70, 90, cosette(372, 236, 70, 90), false)}
       <rect x="330" y="376" width="230" height="26" fill="#2a2420"/>${rng(5, k => `<rect x="${340 + k * 46}" y="380" width="24" height="18" fill="${['#c8302c', '#3a8a4a', '#d89a2a', '#2a6ab0', '#c8302c'][k]}"/><circle cx="${352 + k * 46}" cy="389" r="5" fill="#c8302c" stroke="#3a8a4a" stroke-width="2"/>`)}
       <rect x="350" y="404" width="190" height="32" fill="#1d3f9a" stroke="#c9a04a" stroke-width="2"/>
       <text x="445" y="425" text-anchor="middle" font-size="12" textLength="176" lengthAdjust="spacingAndGlyphs" fill="#eef2fa" font-family="Georgia, serif">THE WORLD’S LONGEST RUNNING MUSICAL</text>
       <rect x="336" y="440" width="218" height="74" fill="#3d332b"/>${rng(6, k => `<rect x="${338 + k * 42}" y="462" width="6" height="52" fill="#1d1a18"/>`)}<text x="445" y="456" text-anchor="middle" font-size="9" letter-spacing="2" fill="#e8dcc0" font-family="Georgia, serif">SONDHEIM THEATRE</text>
       ${vSign(536, 130, 170, 'GIELGUD', false, '#1d3a2a')}`;
  const apollo = lit
    ? `${bandedWins(560, 200, 60)}${lightbox(612, 250, 60, 76, `<rect x="612" y="250" width="60" height="76" fill="#5ab0e0" opacity=".6"/><text x="642" y="318" text-anchor="middle" font-size="15" font-weight="700" fill="#ff6a50" font-family="Georgia, serif">OLIVER!</text>`, true)}
       ${vSign(724, 90, 150, 'APOLLO', true)}${rng(4, k => `<rect x="${574 + k * 45}" y="446" width="37" height="68" fill="#ffcf7e"/>`)}`
    : `<rect x="560" y="60" width="200" height="${H - 60}" fill="${BRICK}"/>${rng(6, k => `<rect x="560" y="${96 + k * 52}" width="200" height="12" fill="#efe6d6"/>`)}
       <path d="M560,60 L600,24 L640,60 Z M680,60 L720,30 L760,60 Z" fill="#efe6d6"/>${bandedWins(560, 200, 60)}
       ${lightbox(612, 250, 60, 76, `<rect x="612" y="250" width="60" height="76" fill="#8fd0ee"/><circle cx="642" cy="282" r="16" fill="#e8c090"/><path d="M626,276 q16,-22 32,0 q-6,-10 -16,-8 q-10,-2 -16,8 Z" fill="#c8823a"/>
         <text x="642" y="318" text-anchor="middle" font-size="15" font-weight="700" fill="#d8302c" font-family="Georgia, serif">OLIVER!</text>`, false)}
       ${vSign(724, 90, 150, 'APOLLO', false)}<rect x="566" y="440" width="188" height="74" fill="#3d332b"/>${rng(5, k => `<rect x="${566 + k * 45}" y="446" width="8" height="68" fill="#1d1a18"/>`)}<rect x="560" y="430" width="200" height="10" fill="#2a2420"/>`;
  return art(76, 52, lit ? `${sondheim}${front}${apollo}` : wcCrisp(sondheim + front + apollo, 1.5));
};
// the show's posters beside the theatre doors: one queen each, in the colours the six wear on stage
const QUEENS = [['#e0b13e', '#f4d27a'], ['#3f9a5a', '#7fd09a'], ['#e9e6dc', '#ffffff'], ['#c8423a', '#ff8a7a'], ['#e06aa8', '#ffb0d8'], ['#3d6fd0', '#8fb4ff']];
const queenPosters = (x0, y0, lit) => QUEENS.map(([dress, glow], i) => { const x = x0 + i * 47, w = 42, h = 92;
  // the lit layer repeats the poster (so the glowing shopfront doesn't cover it) and adds a light-box frame
  return `${lit ? `<rect x="${x - 2}" y="${y0 - 2}" width="${w + 4}" height="${h + 4}" fill="none" stroke="${glow}" stroke-width="3"/>` : ''}
      <rect x="${x}" y="${y0}" width="${w}" height="${h}" fill="#241c3e" stroke="#0e0c14" stroke-width="2"/>
      <text x="${x + w / 2}" y="${y0 + 12}" text-anchor="middle" font-size="8" fill="#e8b83a" font-family="Georgia, serif">★★★★★</text>
      <path d="M${x + 5},${y0 + h - 4} Q${x + w / 2},${y0 + 34} ${x + w - 5},${y0 + h - 4} Z" fill="${dress}"/>
      <path d="M${x + w / 2 - 9},${y0 + h - 4} L${x + w / 2},${y0 + 52} L${x + w / 2 + 9},${y0 + h - 4}" fill="none" stroke="#1d1d1d" stroke-width="1.4" opacity=".5"/>
      <path d="M${x + w / 2 - 10},${y0 + 44} q10,-14 20,0 l-2,12 h-16 Z" fill="#2a1d18"/>
      <circle cx="${x + w / 2}" cy="${y0 + 36}" r="7.5" fill="#f0c9a5"/>
      <path d="M${x + w / 2 - 7},${y0 + 27} l2,-7 l3,4 l2,-5 l2,5 l3,-4 l2,7 Z" fill="#e8b83a"/>
      <path d="M${x + w / 2 + 9},${y0 + 52} l7,-9" stroke="#cfcfcf" stroke-width="2"/><circle cx="${x + w / 2 + 16}" cy="${y0 + 42}" r="2.4" fill="#cfcfcf"/>
      <text x="${x + w / 2}" y="${y0 + h - 8}" text-anchor="middle" font-size="9" letter-spacing="1" fill="#fff4d8" font-family="Georgia, serif">SIX</text>`; }).join('');
const rightStreet = lit => {
  const blocks = [[0, 210, 110, STONE1], [210, 180, 80, STONE2], [390, 190, 120, STONE1], [580, 180, 70, STONE3]];
  // the SIX sign: navy box ringed with bulbs, a little crown on the I, hung from a scrolled iron bracket
  const six = `<path d="M210,170 h-16 m16,0 q-30,-20 -60,0 q-14,10 -4,18" fill="none" stroke="#1d1d1d" stroke-width="3"/>
    <rect x="66" y="180" width="160" height="100" fill="#1e2552"/>${bulbs(66, 180, 160, 100, lit)}
    ${rng(7, i => `<circle cx="66" cy="${190 + i * 13}" r="3.5" fill="${lit ? '#fff2b0' : '#c9b37a'}"/><circle cx="226" cy="${190 + i * 13}" r="3.5" fill="${lit ? '#fff2b0' : '#c9b37a'}"/>`)}
    <text x="146" y="252" text-anchor="middle" font-size="56" font-family="Georgia, serif" fill="${lit ? '#f4ffe0' : '#dfe8c8'}">SIX</text>
    <path d="M139,208 l3,-8 l4,5 l4,-6 l4,6 l4,-5 l3,8 Z" fill="#e8b83a"/>`;
  const vaudeville = `<rect x="378" y="${520 - 128}" width="300" height="34" fill="#2f4f9a" stroke="#24282e" stroke-width="4"/>
    ${rng(9, i => `<path d="M${384 + i * 33},${520 - 126} l14,30" stroke="#6f8fd0" stroke-width="2"/>`)}
    <text x="528" y="${520 - 103}" text-anchor="middle" font-size="22" letter-spacing="3" fill="${lit ? '#ffffff' : '#eef2f8'}" font-family="Georgia, serif">VAUDEVILLE</text>`;
  const adelphi = `<rect x="60" y="${520 - 120}" width="120" height="24" fill="#1d1c22"/>${bulbs(60, 520 - 120, 120, 24, lit)}
    <text x="120" y="${520 - 102}" text-anchor="middle" font-size="15" letter-spacing="3" fill="${lit ? '#fff4c8' : GOLD}" font-family="Georgia, serif">ADELPHI</text>`;
  const posters = `<rect x="378" y="${520 - 100}" width="290" height="100" fill="#14111c"/>${queenPosters(384, 520 - 96, lit)}`;
  return art(76, 52, lit ? `${stoneRow(blocks, 520, true)}${vaudeville}${posters}${adelphi}` : `${wc(stoneRow(blocks, 520, false), 1.5)}${vaudeville}${posters}${adelphi}`);
};
// the Sondheim's curved corner: purple-blue neon along the top, the tall "Still revolutionary" Cosette banner,
// the title in white, and the LED ribbon running round from the side wall
const lesMisCorner = lit => art(34, 48, lit
  ? `<path d="M10,44 Q170,8 330,44" fill="none" stroke="#7a6aff" stroke-width="12" opacity=".8" filter="url(#glow)"/>
     <text x="170" y="84" text-anchor="middle" font-size="22" letter-spacing="2" fill="#ffffff" font-family="Georgia, serif">STILL REVOLUTIONARY</text>
     ${cosette(40, 96, 260, 220, .55)}<text x="170" y="368" text-anchor="middle" font-size="42" fill="#eef4ff" font-family="Georgia, serif">Les Misérables</text>
     ${marquee(0, 388, 340, 'STILL THE WORLD’S MOST POPULAR MUSICAL', true)}${rng(4, k => `<rect x="${28 + k * 76}" y="428" width="56" height="52" fill="#ffcf7e"/>`)}`
  : `${wc(`<path d="M0,480 V50 Q170,12 340,50 V480 Z" fill="#1d2440"/><path d="M10,44 Q170,8 330,44" fill="none" stroke="#5a4ad0" stroke-width="10"/>`, 1.6)}
     <text x="170" y="84" text-anchor="middle" font-size="22" letter-spacing="2" fill="#e6e2d4" font-family="Georgia, serif">STILL REVOLUTIONARY</text>
     ${cosette(40, 96, 260, 220)}<rect x="40" y="316" width="260" height="62" fill="#1d3f8a"/>
     <text x="170" y="368" text-anchor="middle" font-size="42" fill="#e6ecf8" font-family="Georgia, serif">Les Misérables</text>
     ${marquee(0, 388, 340, 'STILL THE WORLD’S MOST POPULAR MUSICAL', false)}
     <rect x="0" y="416" width="340" height="64" fill="#2a2420"/>${rng(4, k => `<rect x="${24 + k * 76}" y="424" width="64" height="56" fill="#3d332b"/>`)}`);
const corner = (color, lit, arch = true) => art(34, 48, lit
  ? `${rng(4, f => rng(3, k => ((f + k) % 2 ? win(46 + k * 90, 70 + f * 70, 40, 44, true) : '')))}<path d="M110,480 V400 A60,60 0 0 1 230,400 V480 Z" fill="#ffcf7e"/>`
  : `${wc(`<path d="M0,480 V60 L40,30 H300 L340,60 V480 Z" fill="${color}"/><rect x="0" y="54" width="340" height="12" fill="#d8ccb2"/>
    ${rng(4, f => rng(3, k => win(46 + k * 90, 70 + f * 70, 40, 44)))}
    ${arch ? `<path d="M100,480 V390 A70,70 0 0 1 240,390 V480 Z" fill="#3a3029"/>` : `<rect x="40" y="380" width="260" height="100" fill="#3a3029"/>`}
    <rect x="0" y="360" width="340" height="12" fill="#d8ccb2"/>`, 1.6)}`);
// the navy portrait banners strung across the street ("Pride in the Quarter")
const wireBanners = lit => art(80, 62, lit ? `<rect width="1" height="1" fill="none"/>` : `${wc(`<path d="M0,60 Q400,140 800,60" fill="none" stroke="#2a2a2a" stroke-width="3"/>
    ${[110, 250, 400, 550, 690].map((x, i) => { const y = 64 + 80 * (1 - Math.pow((x - 400) / 400, 2)) * .9;
      const face = ['#e9c9ad', '#c99a7a', '#f0d2b8', '#8a5a40', '#e9c9ad'][i], coat = ['#2b2f3a', '#3a4a8a', '#6b2b29', '#c8423a', '#3a3f47'][i];
      return `<rect x="${x - 38}" y="${y}" width="76" height="150" fill="#1d2244"/>
        ${i === 2 ? `<text x="${x}" y="${y + 70}" text-anchor="middle" font-size="18" font-weight="700" fill="#eef0f8" stroke="none" font-family="Helvetica, Arial, sans-serif">PRIDE</text>
          <text x="${x}" y="${y + 86}" text-anchor="middle" font-size="7" fill="#c9cde0" stroke="none" font-family="Helvetica, Arial, sans-serif">IN THE QUARTER</text>
          <path d="M${x - 20},${y + 140} V${y + 112} l8,-10 l8,10 V${y + 140} M${x},${y + 140} V${y + 104} l10,-12 l10,12 V${y + 140}" fill="none" stroke="#8a90b8" stroke-width="1.4"/>`
        : `<rect x="${x - 32}" y="${y + 40}" width="64" height="104" fill="#3a3f5c"/><path d="M${x - 24},${y + 144} Q${x},${y + 86} ${x + 24},${y + 144} Z" fill="${coat}"/><circle cx="${x}" cy="${y + 80}" r="13" fill="${face}"/>`}
        <text x="${x}" y="${y + 28}" text-anchor="middle" font-size="16" fill="#e6e8f2" stroke="none" font-family="Georgia, serif">LHQ</text>`; }).join('')}`, 1.3)}`);
const streetBack = lit => art(92, 48, (() => {
  if (lit) { const r = rand(71); return rng(70, () => { const side = r() < .5, x = side ? 40 + r() * 340 : 540 + r() * 340, y = 180 + r() * 200; return `<rect x="${x}" y="${y}" width="6" height="8" fill="#ffd27a"/>`; }) + rng(9, i => `<circle cx="${130 + i * 80}" cy="${350 - Math.abs(i - 4) * 10}" r="8" fill="#ffd27a" filter="url(#glow)"/>`); }
  return `<defs>${lg('wsky', [[0, '#3c4f86'], [.55, '#8a87b0'], [.8, '#f0a76a'], [1, '#f6c98a']])}</defs>
    <path d="M0,480 V120 Q40,60 100,90 Q160,30 240,70 Q320,20 400,60 Q470,10 540,60 Q620,20 700,70 Q780,30 840,80 Q900,60 920,110 V480 Z" fill="url(#wsky)"/>
    ${cloud(140, 140, 1.6, '#c9b9cf')}${cloud(600, 120, 1.4, '#d6c2cc')}
    <path d="M400,380 V320 A60,60 0 0 1 520,320 V380 Z" fill="#6b6f8a"/><path d="M460,260 v-30" stroke="#6b6f8a" stroke-width="5"/>
    ${wc(`<path d="M0,480 V150 L80,170 L80,130 L200,180 L200,160 L330,230 L380,240 L420,330 L430,480 Z" fill="#7b6f7c"/>
      <path d="M920,480 V140 L840,170 L840,140 L720,185 L720,170 L590,235 L540,245 L500,330 L490,480 Z" fill="#7e7486"/>
      <path d="M430,480 L450,360 H470 L490,480 Z" fill="#9a8f8a"/>`, 1.4)}
    ${rng(9, i => `<path d="M${130 + i * 80},${350 - Math.abs(i - 4) * 10} v40" stroke="#3a3a40" stroke-width="2"/>`)}`;
})());
const bus87 = art(24, 13, `${wc(`
  <path d="M8,120 V26 Q8,8 30,8 H210 Q232,8 236,30 V120 Z" fill="#c8302c"/>
  <path d="M188,14 H226 Q232,16 234,30 V108 H188 Z" fill="#2e333b"/>
  ${rng(5, i => `<rect x="${20 + i * 33}" y="22" width="26" height="30" rx="3" fill="#2e333b"/>`)}
  ${rng(4, i => `<rect x="${56 + i * 33}" y="66" width="26" height="30" rx="3" fill="#2e333b"/>`)}
  <path d="M14,40 L44,60 V100 H14 Z" fill="#2e333b"/><rect x="8" y="56" width="180" height="5" fill="#9e2420" stroke="none"/>
  <circle cx="54" cy="122" r="13" fill="#222"/><circle cx="196" cy="122" r="13" fill="#222"/>`, 1.4)}
  <rect x="192" y="18" width="38" height="14" fill="#151515"/><text x="211" y="29" text-anchor="middle" font-size="10" fill="#f5c542" font-family="Helvetica, Arial, sans-serif" font-weight="700">87</text>
  <text x="80" y="18" text-anchor="middle" font-size="9" fill="#f6e6c6" font-family="Helvetica, Arial, sans-serif">Aldwych</text>`);
const busFront = art(9, 13, `${wc(`<path d="M2,128 V20 Q2,4 18,4 H72 Q88,4 88,20 V128 Z" fill="#c8302c"/>
  <rect x="10" y="10" width="70" height="16" fill="#151515"/><rect x="8" y="32" width="74" height="30" rx="4" fill="#2e333b"/>
  <rect x="8" y="70" width="74" height="34" rx="4" fill="#2e333b"/><rect x="2" y="64" width="86" height="4" fill="#9e2420" stroke="none"/>
  <circle cx="16" cy="114" r="6" fill="#fff3c4"/><circle cx="74" cy="114" r="6" fill="#fff3c4"/><rect x="30" y="110" width="30" height="10" fill="#f4efe2"/>`, 1.3)}
  <text x="45" y="22" text-anchor="middle" font-size="9" fill="#f5c542" font-family="Helvetica, Arial, sans-serif" font-weight="700">87 Aldwych</text>`);
const busBack = art(9, 13, wc(`<path d="M2,128 V20 Q2,4 18,4 H72 Q88,4 88,20 V128 Z" fill="#b52a26"/>
  <rect x="12" y="14" width="66" height="26" rx="4" fill="#2e333b"/><rect x="12" y="52" width="66" height="30" fill="#f2e3c2"/>
  <rect x="10" y="108" width="12" height="8" fill="#e05040"/><rect x="68" y="108" width="12" height="8" fill="#e05040"/>`, 1.3));
const busRoof = art(9, 24, wc(`<rect x="2" y="2" width="86" height="236" rx="10" fill="#b52a26"/><rect x="30" y="40" width="30" height="40" fill="#9e2420"/><rect x="30" y="150" width="30" height="40" fill="#9e2420"/>`, 1.3));
const ENV = {X: 70, Z: 56, w: 22, h: 12};
const envBack = `<rect x="${fx(ENV.X - ENV.w / 2)}" y="${fz(ENV.Z - ENV.h / 2)}" width="${ENV.w * 10}" height="${ENV.h * 10}" fill="#b8344a"/>
  <path d="M${fx(ENV.X - ENV.w / 2)},${fz(ENV.Z - ENV.h / 2)} L${fx(ENV.X)},${fz(ENV.Z - ENV.h / 2) - 50} L${fx(ENV.X + ENV.w / 2)},${fz(ENV.Z - ENV.h / 2)} Z" fill="#9e2a3e"/>`;
const envFront = art(22, 12, `${wc(`<path d="M2,2 L110,58 L218,2 V118 H2 Z" fill="#c8405a"/><path d="M2,118 L110,60 L218,118" fill="none" stroke="#9e2a3e" stroke-width="2"/>`, 1.4)}
  <circle cx="110" cy="62" r="11" fill="#d8a93b" stroke="#8a6a2a" stroke-width="2"/><text x="110" y="66" text-anchor="middle" font-size="10" fill="#6a4a1a" font-family="Georgia, serif">VI</text>`);
const tixArt = art(18, 10, `${wc(`<path d="M4,4 H176 V40 a10,10 0 0 0 0,20 V96 H4 V60 a10,10 0 0 0 0,-20 Z" fill="#f6e6d2"/>`, 1.3)}
  <path d="M130,8 V92" stroke="#c9a0a0" stroke-width="1.4" stroke-dasharray="4 4"/>
  <text x="66" y="30" text-anchor="middle" font-size="22" letter-spacing="4" fill="#7a2a3a" font-family="Georgia, serif">SIX</text>
  <text x="66" y="46" text-anchor="middle" font-size="9" letter-spacing="1.5" fill="#7a2a3a" font-family="Georgia, serif">VAUDEVILLE THEATRE</text>
  <text x="66" y="66" text-anchor="middle" font-size="11" fill="${INK}" font-family="Noto Serif SC, serif">亨利八世的六位王后</text>
  <text x="66" y="82" text-anchor="middle" font-size="11" fill="${INK}" font-family="Noto Serif SC, serif">今晚开唱演唱会！</text>
  <text x="153" y="40" text-anchor="middle" font-size="10" fill="#7a2a3a" font-family="Georgia, serif">19:30</text>
  <text x="153" y="58" text-anchor="middle" font-size="9" fill="#7a2a3a" font-family="Georgia, serif">ROW F</text>
  <text x="153" y="72" text-anchor="middle" font-size="9" fill="#7a2a3a" font-family="Georgia, serif">SEAT 12</text>`);
const tixTap = (c, e) => { const out = c.tabV('tix') < .5; c.tab('tix', out ? 1 : 0); if (out && c.once('tix')) c.note('戏票抽出来啦！今晚 19:30，F 排 12 座。', e); };
const spread3 = {
  eyebrow: '19:30 · West End', station: 'Charing Cross', title: '西区剧院街', en: 'A night at the theatre', light: 'evening', lit: 1,
  story: '晚上七点半，西区的路灯刚亮，剧院门口排起了队。左边是沙夫茨伯里大道：转角的桑德海姆剧院挂着《悲惨世界》的巨幅广告，柯赛特的画像下面一圈红色灯带，侧墙上画着街垒上挥舞红旗的学生，往里是 Gielgud 和 Apollo 剧院；右边是 Vaudeville 剧院门口的 SIX。两排房子立在街道两侧，远处的街景是一张跨过书脊的 V 折，头顶挂着一串彩旗。拉一拉小人脚边的拉片，和朋友在路中间碰头；87 路巴士是一只纸盒，直接按住它就能沿着轨道前后开。',
  todo: ['拉小人脚边的拉片（或者直接拖小人），她和朋友从两边走过来碰面。', '按住 87 路巴士前后拖（或者拉它旁边的拉片），巴士沿着轨道开。', '点两边的房子或《悲惨世界》的转角，开灯、关灯：灯带、灯箱和招牌都会亮起来。', '点右下角的红信封（或者把戏票往上拖），戏票会从信封里抽出来。'],
  floor: floor(`${pageBg('#cfc6b6')}
    ${rng(18, i => `<path d="M0,${i * 72} H2000" stroke="#b9ae9b" stroke-width="2"/>`)}${rng(30, i => `<path d="M${i * 70},0 V1300" stroke="#b9ae9b" stroke-width="1.4"/>`)}
    <path d="M${fx(-24)},1300 L${fx(-8)},${fz(-55)} H${fx(8)} L${fx(24)},1300 Z" fill="#7a8193"/>
    <clipPath id="road"><path d="M${fx(-24)},1300 L${fx(-8)},${fz(-55)} H${fx(8)} L${fx(24)},1300 Z"/></clipPath>
    <g clip-path="url(#road)">${(() => { const r = rand(53); return rng(900, () => { const x = fx(-25) + r() * 500, y = fz(-56) + r() * 1250; return `<ellipse cx="${x}" cy="${y}" rx="${7 + r() * 5}" ry="${5 + r() * 3}" fill="${r() < .5 ? '#8d94a6' : '#6c7385'}"/>`; }); })()}</g>
    <path d="M${fx(-24)},1300 L${fx(-8)},${fz(-55)} M${fx(24)},1300 L${fx(8)},${fz(-55)}" stroke="#e6c64a" stroke-width="5"/>
    <path d="M${fx(-26)},1300 L${fx(-9)},${fz(-55)} M${fx(26)},1300 L${fx(9)},${fz(-55)}" stroke="#e6c64a" stroke-width="3"/>
    <rect x="${fx(9) - 6}" y="${fz(-40)}" width="12" height="${fz(28) - fz(-40)}" rx="6" fill="#26282c"/>
    <rect x="${fx(9) - 2}" y="${fz(-40) + 6}" width="4" height="${fz(28) - fz(-40) - 12}" fill="#4a4d52"/>
    ${rng(6, i => `<rect x="${fx(-20) + i * 64}" y="${fz(44)}" width="40" height="70" fill="#ece6d8" opacity=".9"/>`)}
    ${plateBox}
    ${envBack}${grain(2000, 1300, .3)}`),
  floorLit: floor(`<rect width="2000" height="1300" fill="#000"/>
    ${[[-22, 14], [22, 0], [-50, 30], [56, 26], [-40, -6], [40, -10]].map(([X, Z]) => `<ellipse cx="${fx(X)}" cy="${fz(Z) + 30}" rx="130" ry="60" fill="#4a2c0c" filter="url(#glow)"/>`).join('')}`),
  texts: [...plateTexts('WEST END', 'A night at the theatre', '西区 · 晚上 19:30', 'Charing Cross'),
    {x: fx(0), y: fz(54), text: 'LOOK RIGHT →', font: `700 26px sans-serif`, color: '#f4efe2', align: 'center', ls: 3},
  ],
  pieces: [
    {id: 'back', type: 'v', Z: -54, sigma: -4, wl: 46, wr: 46, art: streetBack(false), artLit: streetBack(true)},
    {id: 'flags', type: 'v', Z: -22, sigma: -5, wl: 40, wr: 40, art: wireBanners(false), artLit: wireBanners(true)},
    {id: 'left', type: 'stand', X: -36, Z: -8, yaw: 78, art: leftStreet(false), artLit: leftStreet(true), tap: (c, e) => { c.lights('toggle'); c.note('左边是沙夫茨伯里大道：桑德海姆剧院的侧墙画着街垒上挥舞红旗的学生，往里是 Gielgud 剧院和红白条纹的 Apollo 剧院，门口挂着《雾都孤儿》的灯箱。', e); }},
    {id: 'right', type: 'stand', X: 36, Z: -8, yaw: -78, art: rightStreet(false), artLit: rightStreet(true), tap: (c, e) => { c.lights('toggle'); c.note('Vaudeville 剧院门口贴着六位王后的海报：阿拉贡的凯瑟琳、安妮·博林、简·西摩、克里维斯的安妮、凯瑟琳·霍华德、凯瑟琳·帕尔。', e); }},
    {id: 'cornerL', type: 'custom', anchor: 'right', parent: 'left', art: lesMisCorner(false), artLit: lesMisCorner(true),
      tap: (c, e) => { c.lights('toggle'); c.note('转角是桑德海姆剧院，《悲惨世界》在这里演了快四十年。柯赛特的画像下面，红色灯带写着：仍是世界上最受欢迎的音乐剧。', e); },
      pose: (s, rise) => { const t = rise * Math.PI / 2; return {o: [-38, 0, -.1], x: [-Math.cos(t), 0, Math.sin(t)], y: [0, 1, 0]}; }},
    {id: 'cornerR', type: 'custom', anchor: 'left', parent: 'right', art: corner(CREAM, false, false), artLit: corner(CREAM, true, false),
      pose: (s, rise) => { const t = rise * Math.PI / 2; return {o: [38, 0, -.1], x: [-Math.cos(t), 0, -Math.sin(t)], y: [0, 1, 0]}; }},
    {id: 'lampL', type: 'stand', X: -22, Z: 14, art: lamp(26), artLit: lamp(26, true)},
    {id: 'six', type: 'custom', anchor: 'right', parent: 'right', art: sixSign(false), artLit: sixSign(true),
      pose: (s, rise) => { const a = Math.PI / 2 * (1 - rise); return {o: [14.3, 14, 0], x: [Math.sin(a), 0, -Math.cos(a)], y: [0, 1, 0]}; }, tap: (c, e) => { c.lights('toggle'); c.note('SIX 的招牌挂在 Vaudeville 剧院门口，开演前一圈灯泡都会亮起来。', e); }},
    station(56, 32, 'CHARING CROSS', '19:30'),
    {id: 'lampR', type: 'stand', X: 22, Z: 0, art: lamp(26), artLit: lamp(26, true)},
    {id: 'bus', type: 'box', X: 9, Z: -34, w: 9, d: 24, h: 13, inside: '#7a1f1c', ease: 4, drag: 'bus',
      faces: {front: busFront, back: busBack, left: bus87, right: mirror(bus87), top: busRoof},
      tap: (c, e) => { c.hop('bus'); c.note('87 路开往 Aldwych。按住巴士前后拖，它会沿着轨道开。', e); }},
    {...me(-34, 38, 'wave', '这里是西区的河岸街，今晚和朋友约好一起看 SIX！'), drag: 'meet'},
    {id: 'friend', type: 'stand', X: 34, Z: 38, w: 10, h: 17.5, art: mirror(traveller('hello', FRIEND)),
      tap: (c, e) => { c.hop('friend'); c.note('等你好久啦！票我已经取好了。', e); }},
    {id: 'tix', type: 'custom', anchor: 'center', art: tixArt, drag: 'tix', tap: tixTap, ease: 7,
      pose: s => ({o: [ENV.X, .3, s.Z ?? ENV.Z], x: FLAT_X, y: FLAT_Y})},
    {id: 'env', type: 'custom', anchor: 'center', art: envFront, tap: tixTap, pose: () => ({o: [ENV.X, .5, ENV.Z], x: FLAT_X, y: FLAT_Y})},
  ],
  controls: [
    // both tabs ride beside what they move; the bus and the traveller can also be dragged directly
    {id: 'bus', tab: {icon: 'bus', color: '#c8302c'}, slotW: .9, X: 16, Z: -34, len: 60, init: 0, apply: (v, c) => c.set('bus', {Z: -34 + v * 60})},
    {id: 'meet', tab: {icon: 'meet', color: '#d1435b'}, slotW: .9, X: -34, Z: 44, dir: [1, 0, 0], len: 28, init: 0, apply: (v, c) => {
      c.set('me', {X: -34 + v * 28}); c.set('friend', {X: 34 - v * 28});
      if (v > .96 && c.once('met')) { c.hop('me'); c.hop('friend'); c.note('终于碰面啦！走，看戏去。'); }
    }},
    // the ticket slides up out of its envelope (drag it, or tap)
    {id: 'tix', hidden: true, X: ENV.X, Z: ENV.Z, dir: [0, 0, -1], len: 9, init: 0, apply: (v, c) => c.set('tix', {Z: ENV.Z + .5 - v * 9})},
  ],
};

/* ======================= 4 · Tower Bridge at night ======================= */
const STONE_N = '#7f8ba0';
const nightSkyline = lit => art(192, 30, (() => {
  const r = rand(91); let x = 0, s = '', w = '';
  while (x < 1920) { const bw = 40 + r() * 80, bh = 60 + r() * 150; s += `<rect x="${x}" y="${300 - bh}" width="${bw}" height="${bh}" fill="${r() < .5 ? '#2d3d5c' : '#34466a'}"/>`;
    for (let k = 0; k < 6; k++) if (r() < .6) w += `<rect x="${x + 6 + r() * (bw - 14)}" y="${300 - bh + 10 + r() * (bh - 30)}" width="6" height="8" fill="#ffd27a"/>`; x += bw; }
  if (lit) return w + rng(24, i => `<circle cx="${40 + i * 80}" cy="290" r="9" fill="#ffd27a" filter="url(#glow)"/>`);
  return wc(`${s}<path d="M700,300 V200 A70,70 0 0 1 840,200 V300 Z" fill="#3c4d72"/><path d="M770,130 v-30" stroke-width="4"/>
    <path d="M1400,300 L1450,30 L1500,300 Z" fill="#3a4b70"/>
    <path d="M140,300 V200 H180 V180 H220 V200 H300 V180 H340 V200 H380 V300 Z" fill="#3e4a62"/>
    <rect x="0" y="288" width="1920" height="12" fill="#25324c"/>`, 1.2);
})());
const tbTower = lit => art(17, 60, lit
  ? `<rect x="25" y="170" width="120" height="350" fill="#fff0d0" opacity=".38"/>${rng(5, r => rng(2, k => `<path d="M${52 + k * 50},${230 + r * 58} v-22 a8,8 0 0 1 16,0 v22 Z" fill="#ffd77e"/>`))}
     ${[[27, 88], [143, 88], [85, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y - 34}" r="6" fill="${GOLD}"/><circle cx="${x}" cy="${y - 34}" r="16" fill="#ffd27a" opacity=".55" filter="url(#glow)"/>`).join('')}
     <rect x="10" y="520" width="150" height="10" fill="#5b7fe0"/><ellipse cx="85" cy="560" rx="70" ry="20" fill="#6f8cff" opacity=".5" filter="url(#glow)"/>`
  : wc(`<rect x="10" y="520" width="150" height="80" fill="#5b6475"/>
    <rect x="25" y="170" width="120" height="352" fill="${STONE_N}"/>
    ${rng(6, i => `<path d="M25,${200 + i * 56} H145" stroke="#6a768b" stroke-width="2"/>`)}
    ${rng(5, r => rng(2, k => `<path d="M${52 + k * 50},${230 + r * 58} v-22 a8,8 0 0 1 16,0 v22 Z" fill="#3a4252"/>`))}
    ${[[12, 42], [128, 42]].map(([x, w]) => `<rect x="${x}" y="88" width="30" height="${170 - 88 + 20}" fill="${STONE_N}"/><polygon points="${x - 2},90 ${x + 15},40 ${x + 32},90" fill="#55617a"/><path d="M${x + 15},40 v-12" stroke="${GOLD}" stroke-width="3"/>`).join('')}
    <polygon points="40,172 85,58 130,172" fill="#55617a"/><path d="M85,58 V30" stroke="${GOLD}" stroke-width="4"/><path d="M78,36 h14" stroke="${GOLD}" stroke-width="3"/>
    <rect x="40" y="120" width="90" height="16" fill="#6a768b"/>`, 1.6));
const walkway = lit => art(38, 56, lit
  ? `<path d="M0,62 H380 M0,94 H380 M0,108 H380 M0,132 H380" stroke="#fffbea" stroke-width="4"/><circle cx="190" cy="44" r="18" fill="#ffd27a" opacity=".6" filter="url(#glow)"/>`
  : wc(`<rect x="0" y="60" width="380" height="36" fill="#5d6a82"/><rect x="0" y="106" width="380" height="28" fill="#5d6a82"/>
    ${rng(19, i => `<path d="M${i * 20},62 L${i * 20 + 20},94 M${i * 20 + 20},62 L${i * 20},94" stroke="#8796b0" stroke-width="2"/>`)}
    ${rng(19, i => `<path d="M${i * 20},108 L${i * 20 + 20},132" stroke="#8796b0" stroke-width="2"/>`)}
    <path d="M168,60 L190,22 L212,60 Z" fill="${GOLD}"/><circle cx="190" cy="44" r="9" fill="#e9c56b"/>`, 1.4));
const chain = lit => art(62, 40, lit
  ? `<path d="M30,330 Q330,300 600,60" fill="none" stroke="#fffbea" stroke-width="5"/><path d="M30,366 H620" stroke="#fffbea" stroke-width="4"/>${rng(10, i => `<circle cx="${80 + i * 56}" cy="352" r="5" fill="#ffd27a"/>`)}`
  : wc(`<rect x="0" y="352" width="620" height="22" fill="#4d5a72"/>
    <path d="M30,330 Q330,300 600,60" fill="none" stroke="#5d6a82" stroke-width="26"/><path d="M30,330 Q330,300 600,60" fill="none" stroke="#8796b0" stroke-width="2" stroke-dasharray="10 8"/>
    ${rng(14, i => { const t = (i + 1) / 15, x = (1 - t) * (1 - t) * 30 + 2 * (1 - t) * t * 330 + t * t * 600, y = (1 - t) * (1 - t) * 330 + 2 * (1 - t) * t * 300 + t * t * 60; return `<path d="M${x},${y + 10} V352" stroke="#8796b0" stroke-width="2"/>`; })}
    <rect x="0" y="230" width="60" height="140" fill="${STONE_N}"/><polygon points="-2,232 30,190 62,232" fill="#55617a"/>`, 1.4));
const bascule = (dir) => art(18, 4, wc(`<rect x="2" y="6" width="176" height="28" fill="#44516a"/>${rng(11, i => `<path d="M${6 + i * 16},8 L${22 + i * 16},32" stroke="#8796b0" stroke-width="2"/>`)}`, 1.2));
const shipFront = lit => art(13, 13, lit
  ? rng(3, r => rng(4, k => `<rect x="${30 + k * 18}" y="${50 + r * 16}" width="10" height="8" fill="#ffd77e"/>`))
  : wc(`<path d="M10,90 L65,128 L120,90 V82 H10 Z" fill="#1d2840"/><path d="M10,90 L65,128 L120,90" fill="none" stroke="${RED}" stroke-width="4"/>
    <rect x="22" y="40" width="86" height="44" fill="#eef0f2"/>${rng(3, r => rng(4, k => `<rect x="${30 + k * 18}" y="${50 + r * 16}" width="10" height="8" fill="#3a4252" stroke="none"/>`))}
    <rect x="52" y="18" width="26" height="24" fill="${RED}"/><rect x="52" y="14" width="26" height="6" fill="#1d1d1d"/><path d="M90,40 V4" stroke-width="2"/>`, 1.4));
const embank = lit => art(84, 18, lit
  ? `<circle cx="120" cy="22" r="30" fill="#ffd27a" opacity=".8" filter="url(#glow)"/><polygon points="108,12 132,12 135,34 105,34" fill="#ffe7a6"/>`
  : wc(`<rect x="0" y="150" width="840" height="30" fill="#8e877b"/><path d="M0,112 H840 M0,140 H840" stroke="#1f2227" stroke-width="3"/>
    ${rng(56, i => `<path d="M${6 + i * 15},110 V150" stroke="#1f2227" stroke-width="2"/>`)}${rng(4, i => `<rect x="${200 + i * 200}" y="100" width="22" height="52" fill="#a39b8c"/>`)}
    <rect x="116" y="40" width="8" height="112" fill="#1f2227"/><rect x="106" y="146" width="28" height="12" fill="#1f2227"/>
    <polygon points="108,12 132,12 135,34 105,34" fill="#c9a24a"/><path d="M105,34 h30 l-4,6 h-22 Z M106,12 L120,0 L134,12 Z" fill="#1f2227"/>`, 1.4));
const waveRow = (seed, lit) => art(96, 6, lit
  ? (() => { const r = rand(seed); return rng(26, () => `<path d="M${r() * 940},${18 + r() * 30} h${16 + r() * 30}" stroke="${r() < .7 ? '#ffd27a' : '#7d95ff'}" stroke-width="3"/>`); })()
  : wc(`<path d="M0,60 V${26} ${rng(16, i => `Q${i * 60 + 15},${8 + (i % 2) * 6} ${i * 60 + 30},26 T${i * 60 + 60},26`)} V60 Z" fill="#26375a"/>
    <path d="M0,26 ${rng(16, i => `Q${i * 60 + 15},${8 + (i % 2) * 6} ${i * 60 + 30},26 T${i * 60 + 60},26`)}" fill="none" stroke="#8ea3c8" stroke-width="2"/>`, 1.2));
const WAVES = [[-14, 0, 101], [2, 1.3, 103], [14, 2.6, 107]];
// the bridge is worked from a hand winch on the embankment: turn the wheel and the bascules rise
const CRANK = {X: -34, Z: 38.6, y: 7.2};
const crankPost = art(10, 11, `${wc(`<rect x="22" y="40" width="56" height="70" fill="#2f4a3a"/><rect x="16" y="102" width="68" height="8" fill="#1f3328"/>
  <rect x="30" y="52" width="40" height="22" fill="#d8a93b"/>`, 1.4)}
  <text x="50" y="62" text-anchor="middle" font-size="7" fill="#2f2a1e" font-family="Georgia, serif">TURN TO</text>
  <text x="50" y="71" text-anchor="middle" font-size="7" fill="#2f2a1e" font-family="Georgia, serif">RAISE ↻</text>`);
const crankWheel = art(10, 10, `${wc(`<circle cx="50" cy="50" r="44" fill="none" stroke="#3a3f47" stroke-width="7"/>
  ${rng(6, i => { const a = i * Math.PI / 3; return `<path d="M50,50 L${50 + 42 * Math.cos(a)},${50 + 42 * Math.sin(a)}" stroke="#3a3f47" stroke-width="4"/>`; })}
  <circle cx="50" cy="50" r="9" fill="#d8a93b"/><circle cx="50" cy="8" r="7" fill="${RED}"/>`, 1.4)}`);
const WHEEL = {X: 70, Z: 54, r: 9};
const TB_FACTS = [['1894', '塔桥这一年通车'], ['800', '每年开桥约 800 次'], ['42 m', '高处人行道离河面'], ['~950', '北岸的伦敦塔已有约 950 年']];
const factDisc = art(18, 18, `<circle cx="90" cy="90" r="88" fill="#efe2c8" stroke="#5b4a3a" stroke-width="2.5"/>
  ${TB_FACTS.map(([big, small], k) => `<g transform="rotate(${-k * 90} 90 90)"><path d="M90,90 L28,28 A88,88 0 0 1 152,28 Z" fill="${['#f3e4c2', '#e9d4ad', '#f3e4c2', '#e9d4ad'][k]}"/>
    <text x="90" y="34" text-anchor="middle" font-size="17" fill="#2f3f5f" font-family="Georgia, serif">${big}</text>
    <text x="90" y="52" text-anchor="middle" font-size="9.5" fill="${INK}" font-family="Noto Serif SC, serif">${small}</text></g>`).join('')}
  <circle cx="90" cy="90" r="7" fill="#d8a93b" stroke="#5b4a3a" stroke-width="2"/>`);
const factCover = art(22, 21, `${wc(`<path fill-rule="evenodd" fill="#2f3f5f" d="M2,2 H218 V208 H2 Z M66,22 H154 Q160,22 160,28 V66 Q110,82 60,66 V28 Q60,22 66,22 Z"/>`, 1.4)}
  <path d="M60,66 Q110,82 160,66" fill="none" stroke="#d8a93b" stroke-width="2"/>
  <text x="110" y="120" text-anchor="middle" font-size="15" letter-spacing="3" fill="#e9c56b" font-family="Georgia, serif">TOWER BRIDGE</text>
  <text x="110" y="142" text-anchor="middle" font-size="11" fill="#e9e2d0" font-family="Noto Serif SC, serif">转一转，看小知识</text>
  <path d="M84,170 a26,26 0 1 1 52,0" fill="none" stroke="#e9c56b" stroke-width="3"/><path d="M136,170 l-6,-8 m6,8 l7,-6" stroke="#e9c56b" stroke-width="3" fill="none"/>`);
const spread4 = {
  eyebrow: '22:00 · Tower Bridge', station: 'Tower Hill', title: '塔桥之夜', en: 'A night on the Thames', light: 'night', lit: 0,
  story: '深夜十点，泰晤士河很黑，只有远处的城市亮着几扇窗。两座桥塔用十字插片立起来，高处的人行道是一张跨过书脊的 V 折。转动岸边的绞盘：桥面掀起，夜船随浪驶近，整座塔桥一起亮灯；倒着转，船退回去，灯也熄灭。晚安，伦敦。',
  todo: ['按住左下方岸边的绞盘绕圈转（顺时针）：桥面掀起，浪一层层起伏，夜船驶近，全桥亮灯。', '逆时针转回去：船退回桥后，灯光熄灭。', '点一点桥塔，单独开灯、关灯。', '转一转右下角的小转盘（或者点它），窗口里会换成下一条塔桥小知识。'],
  floor: floor(`${pageBg('#1d2b45')}
    ${(() => { const r = rand(97); return rng(180, () => { const x = r() * 1960, y = r() * fz(28); return `<path d="M${x},${y} q10,-6 20,0 q10,-6 20,0" fill="none" stroke="#33496f" stroke-width="2.4"/>`; }); })()}
    <rect x="0" y="${fz(28)}" width="2000" height="16" fill="#5d5a55"/>
    <rect x="0" y="${fz(28) + 16}" width="2000" height="${1300 - fz(28)}" fill="#8f897d"/>
    ${rng(9, i => `<path d="M0,${fz(32) + i * 40} H2000" stroke="#7c766b" stroke-width="1.6"/>`)}${rng(26, i => `<path d="M${i * 80 + (i % 2) * 40},${fz(32)} V1300" stroke="#7c766b" stroke-width="1.2"/>`)}
    ${plateBox}
    ${grain(2000, 1300, .25)}`),
  floorLit: floor(`<rect width="2000" height="1300" fill="#000"/>
    ${[[-27, '#c99a3a'], [27, '#c99a3a'], [0, '#3a4fa8']].map(([X, c]) => rng(12, i => `<path d="M${fx(X) - 50 + (i % 3) * 30},${fz(-14) + i * 34} h${60 + (i % 4) * 14}" stroke="${c}" stroke-width="8" opacity=".9"/>`)).join('')}
    ${(() => { const r = rand(101); return rng(60, () => `<path d="M${r() * 2000},${fz(-60) + r() * 120} h${10 + r() * 30}" stroke="#a07a2a" stroke-width="4"/>`); })()}
    <ellipse cx="${fx(-79)}" cy="${fz(36)}" rx="90" ry="40" fill="#7a5212" filter="url(#glow)"/>`),
  texts: [...plateTexts('TOWER BRIDGE', 'A night on the Thames', '塔桥 · 深夜 22:00', 'Tower Hill'),
  ],
  pieces: [
    {id: 'sky', type: 'v', Z: -58, sigma: -3, wl: 96, wr: 96, art: nightSkyline(false), artLit: nightSkyline(true)},
    {id: 'towerL', type: 'stand', X: -27, Z: -20, cross: 15, art: tbTower(false), artLit: tbTower(true), tap: (c, e) => { c.lights('toggle'); c.note('塔桥 1894 年通车。夜里桥身的灯带一亮，整条河都是倒影。', e); }},
    {id: 'towerR', type: 'stand', X: 27, Z: -20, cross: 15, art: tbTower(false), artLit: tbTower(true), tap: (c, e) => { c.lights('toggle'); c.note('高处的人行道原本是给行人在开桥时过河用的。', e); }},
    {id: 'walk', type: 'v', Z: -22, sigma: -2, wl: 19, wr: 19, art: walkway(false), artLit: walkway(true)},
    {id: 'chainL', type: 'stand', X: -66.8, Z: -22, art: chain(false), artLit: chain(true)},
    {id: 'chainR', type: 'stand', X: 66.8, Z: -22, art: mirror(chain(false)), artLit: mirror(chain(true))},
    // each half of the roadway is hinged at the foot of its tower
    {id: 'basL', type: 'custom', anchor: 'left', parent: 'towerL', art: bascule(), lift: 0, pose: s => { const L = s.lift * 72 * Math.PI / 180;
      return {o: [8.5, 8, -1.4], x: [Math.cos(L), Math.sin(L), 0], y: [-Math.sin(L), Math.cos(L), 0]}; }},
    {id: 'basR', type: 'custom', anchor: 'right', parent: 'towerR', art: bascule(), lift: 0, pose: s => { const L = s.lift * 72 * Math.PI / 180;
      return {o: [-8.5, 8, -1.4], x: [Math.cos(L), -Math.sin(L), 0], y: [Math.sin(L), Math.cos(L), 0]}; }},
    {id: 'ship', type: 'stand', X: 9, Z: -46, raise: .98, ease: 4, art: shipFront(false), artLit: shipFront(true), tap: (c, e) => { c.hop('ship'); c.note('嘟——夜船正从桥下穿过。', e); }},
    ...WAVES.flatMap(([Z, ph, sd], k) => ['L', 'R'].map(side => ({id: `wave${k}${side}`, type: 'stand', X: side === 'L' ? -49 : 49, Z, ease: 6,
      art: waveRow(sd + (side === 'L' ? 0 : 1), false), artLit: waveRow(sd + (side === 'L' ? 0 : 1), true)}))),
    {id: 'embank', type: 'stand', X: -56, Z: 31, art: embank(false), artLit: embank(true)},
    station(28, 40, 'TOWER HILL', '22:00'),
    {id: 'crankPost', type: 'stand', X: CRANK.X, Z: CRANK.Z - .5, art: crankPost},
    {id: 'crank', type: 'custom', anchor: 'center', art: crankWheel, ang: 0,
      parent: 'crankPost', pose: s => { const a = (s.ang || 0) * Math.PI / 180; return {o: [0, CRANK.y, .5], x: [Math.cos(a), -Math.sin(a), 0], y: [Math.sin(a), Math.cos(a), 0]}; },
      dial: (deg, c) => c.tab('open', c.tabV('open') + deg / 720), tap: (c, e) => c.note('按住绞盘绕圈转：顺时针开桥，逆时针收回。', e)},
    me(56, 44, 'wave', '这里是塔桥，夜里亮灯的样子最好看。晚安，伦敦，明天见！'),
    ...volvelle({id: 'facts', ...WHEEL, disc: factDisc, cover: factCover}),
  ],
  // no tab on the page edge: the winch drives it (two full turns from closed to open)
  controls: [{id: 'open', hidden: true, X: 1, Z: -46, len: 66, init: 0, apply: (v, c) => {
    c.set('crank', {ang: v * 720});
    const lift = Math.min(1, v / .4); c.set('basL', {lift}); c.set('basR', {lift});
    c.set('ship', {Z: -46 + Math.max(0, Math.min(1, (v - .4) / .45)) * 66, tilt: Math.sin(v * Math.PI * 5) * 4});
    WAVES.forEach(([Z, ph], k) => ['L', 'R'].forEach(side => c.set(`wave${k}${side}`, {X: (side === 'L' ? -49 : 49) + Math.sin(v * Math.PI * 3 + ph) * 2.6, Y: Math.max(0, Math.sin(v * Math.PI * 4 + ph)) * .8})));
    // lights come on as the ship sails in and go out again as it backs away
    c.lights(v > .8 ? 1 : 0);
  }}],
};

export const MEMORY_LONDON = {
  id: 'memory-london', title: 'Memory in London', subtitle: '伦敦的一天 · From Morning to Midnight', color: '#6b1e2a',
  cover, spreads: [spread0, spread1, spread2, spread3, spread4],
};
