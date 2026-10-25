/* Memory in London — the reference book for the city-travel template, as a horizontally opening 3D pop-up.
   One day from morning to midnight: the museum hall at ten, Westminster at golden hour, the West End at the start
   of a show, and Tower Bridge lighting up at night. A station sign marks every stop and the traveller walks
   through each spread. */
import {P, INK, RED, GOLD, NAVY, rng, rand, wc, art, grain, lg, cloud, lamp, roundel, traveller, ticket, FRIEND} from './paper-art.js';

const smoothstep = t => t * t * (3 - 2 * t);
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
const PLATE = {x: fx(-94), y: fz(42), w: 500, h: 180};
const plateBox = `<rect x="${PLATE.x}" y="${PLATE.y}" width="${PLATE.w}" height="${PLATE.h}" fill="#fbf6ea" stroke="#7a6650" stroke-width="2"/>
  <rect x="${PLATE.x + 9}" y="${PLATE.y + 9}" width="${PLATE.w - 18}" height="${PLATE.h - 18}" fill="none" stroke="#b9a37a" stroke-width="1.2"/>`;
const plateTexts = (en, sub, zh) => [
  {x: PLATE.x + 30, y: PLATE.y + 62, text: en, font: `600 36px ${SERIF}`, ls: 4, maxWidth: PLATE.w - 60},
  {x: PLATE.x + 30, y: PLATE.y + 106, text: sub, font: `italic 400 30px ${SERIF}`, color: '#5b4a3a', maxWidth: PLATE.w - 60},
  {x: PLATE.x + 30, y: PLATE.y + 150, text: zh, font: `400 24px ${SC}`, color: '#7a6650', maxWidth: PLATE.w - 60},
];
// text printed under a lift-up card, sized to fit the card's box (w units wide), centred on Z
const underTexts = (X, Z, w, lines) => {
  const size = Math.min(25, Math.floor((w * 10 - 30) / Math.max(...lines.map(l => l.length)))), lh = Math.round(size * 1.38);
  return lines.map((t, i) => ({x: fx(X), y: fz(Z) - (lines.length - 1) * lh / 2 + size * .36 + i * lh, text: t, font: `400 ${size}px ${SC}`, color: '#4a3b2e', align: 'center', maxWidth: w * 10 - 24}));
};
const underBox = (X, Z, w, h) => `<rect x="${fx(X - w / 2)}" y="${fz(Z - h / 2)}" width="${w * 10}" height="${h * 10}" fill="#fbf6ea" stroke="#b9a37a" stroke-width="2" stroke-dasharray="6 5"/>`;

// the traveller says where she is, so place names live in her lines rather than on signs
const me = (X, Z, pose, line) => ({id: 'me', type: 'stand', X, Z, w: 10, h: 17.5, art: traveller(pose), bob: 1, stride: .55, tap: (c, e) => { c.hop('me'); c.note(line, e); }});
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
  ${[[14, BIGBEN_PHOTO], [178, null]].map(([x, img]) => `<rect x="${x}" y="12" width="148" height="66" rx="8" fill="#f2ede3"/>
    ${img ? `<clipPath id="fw${x}"><rect x="${x + 6}" y="18" width="136" height="54" rx="5"/></clipPath><image href="${img}" x="${x + 6}" y="0" width="136" height="136" clip-path="url(#fw${x})" preserveAspectRatio="xMidYMid slice"/>` : ''}
    ${dashBox(x + 2, 14, 144, 62, '#3a3a40', 7)}`).join('')}
  ${wc(`<rect x="190" y="26" width="124" height="38" rx="8" fill="${RED}"/>${rng(5, i => `<rect x="${198 + i * 23}" y="32" width="17" height="12" rx="2" fill="#cfe1ea" stroke-width="1"/>`)}<rect x="190" y="50" width="124" height="3" fill="#f3e6c9" stroke="none"/>
    <circle cx="214" cy="66" r="6" fill="#222"/><circle cx="290" cy="66" r="6" fill="#222"/>`, 1.2)}`);
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
const STOPS = [
  {time: '10:00', en: 'NATURAL HISTORY MUSEUM', zh: '自然史博物馆', note: '大厅里挂着一整头蓝鲸，名字叫 Hope。', icon: `<path d="M118,92 q18,-26 50,-16 q20,6 28,-4 l-4,18 q-16,14 -40,10 q-20,-2 -34,-8 Z" fill="#e9e3d6" stroke="${INK}" stroke-width="2"/>`},
  {time: '17:30', en: 'WESTMINSTER', zh: '大本钟', note: '夕阳把钟楼照成了金色，拍到啦。', icon: `<rect x="150" y="58" width="24" height="48" fill="#e0b062" stroke="${INK}" stroke-width="2"/><polygon points="148,58 162,30 176,58" fill="#8e8a74" stroke="${INK}" stroke-width="2"/><circle cx="162" cy="72" r="7" fill="#faf4e4" stroke="${INK}" stroke-width="1.6"/>`},
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
// lay the file out for pull-tab value v (0 flat … 1 standing) and which cards have been flipped
function fileLayout(c) {
  const v = c.get('file').v ?? 0;
  c.set('file', {raise: v}); c.set('panel', {raise: v});
  STOPS.forEach((_, i) => { const s = c.get(`card${i}`);
    c.set(`card${i}`, {raise: v * (s.opened ? 1.93 - .03 * i : 1), Y: FILE.h * K * v + .25 + (STOPS.length - i) * .06}); });
}
function flipCard(c, e, i) {
  const flipped = STOPS.map((_, k) => !!c.get(`card${k}`).opened);
  if ((c.get('file').v ?? 0) < .8) { c.note('先把下面的拉片往外拉，让卡片盒站起来。', e); return; }
  // a flipped card goes back; otherwise the front-most standing card flips forward
  const k = flipped[i] ? flipped.lastIndexOf(true) : flipped.indexOf(false);
  if (k < 0) return;
  c.set(`card${k}`, {opened: !flipped[k]}); fileLayout(c);
  if (!flipped[k] && k === STOPS.length - 1) c.note('四站都看完啦。点翻下来的卡片，可以一张张放回去。', e);
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
const SIGHTS = [[-71, -23, 'palace', 'Buckingham Palace'], [-48, -26, 'column', 'Trafalgar Sq'], [-44, -50, 'museum', 'British Museum'], [-24, -42, 'dome', "St Paul's"],
  [-15, -36, 'castle', 'Tower of London'], [-25, -11, 'shard', 'The Shard'], [-50, 3, 'eye', 'London Eye']];
const spread0 = {
  eyebrow: '扉页 · The route', title: 'Memory in London', en: 'One day, from morning to midnight', light: 'morning',
  story: '这本书记下在伦敦的一天：上午在自然史博物馆的大厅，傍晚看大本钟被夕阳染成金色，晚上走进西区的剧院街，深夜停在灯火通明的塔桥。左页的地图上，四站各立着一座小建筑，其他景点印在地图上；右页的卡片盒里，一站一张卡片。',
  todo: ['把卡片盒右边的红色拉片往外拉，卡片盒和后面的照片板一起站起来。', '点卡片，最前面的一张向前翻下，露出下一站；翻下来的背面写着这一站的小记。', '点翻下来的卡片，可以一张张放回去。', '点一点小人，听听她说什么。'],
  floor: floor(`${pageBg()}${frameLines}
    <rect x="${fx(-92)}" y="${fz(-58)}" width="840" height="760" fill="#efe2c4" stroke="#b9a37a" stroke-width="2"/>
    <path d="M${fx(-92)},${fz(-10)} C${fx(-75)},${fz(-28)} ${fx(-60)},${fz(4)} ${fx(-45)},${fz(-6)} S${fx(-22)},${fz(-30)} ${fx(-8)},${fz(-18)}" fill="none" stroke="#9ec0d4" stroke-width="44"/>
    <ellipse cx="${fx(-72)}" cy="${fz(-50)}" rx="80" ry="34" fill="#bcd39a"/><ellipse cx="${fx(-63)}" cy="${fz(-20)}" rx="44" ry="18" fill="#c6dba6"/>
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
    // the river's name runs along the water
    {x: fx(-80), y: fz(-14.8) + 6, rot: -.04, text: 'RIVER THAMES', font: `600 17px ${SERIF}`, ls: 4, align: 'center', color: '#3f6782'},
    {x: fx(50), y: fz(30), text: 'Memory in London', font: `italic 600 84px ${SERIF}`, align: 'center'},
    {x: fx(50), y: fz(46) + 4, text: '伦敦的一天 · From Morning to Midnight', font: `400 30px ${SC}`, align: 'center', color: '#5b4a3a'},
    {x: fx(50), y: fz(54), text: 'A POP-UP JOURNEY IN FOUR STOPS', font: `500 22px ${SERIF}`, ls: 8, align: 'center', color: '#7a6650'},
  ],
  pieces: [
    ...STOPS_MAP.map(([X, Z, n, name, a]) => ({id: `stop${n}`, type: 'stand', X, Z: Z - 1.6, art: a})),
    {id: 'panel', type: 'stand', X: FILE.X, Z: FILE.Z - FILE.d * K / 2 - .3, Y: .05, w: FILE.w * K, h: 27 * K, raise: 0, ease: 6, art: filePanel},
    {id: 'file', type: 'box', X: FILE.X, Z: FILE.Z, w: FILE.w * K, d: FILE.d * K, h: FILE.h * K, raise: 0, ease: 6, inside: '#1a1a1d',
      faces: {front: fileFront, back: fileSide, left: fileSide, right: fileSide, top: fileTop}, tap: (c, e) => flipCard(c, e, -1)},
    ...STOPS.map((st, i) => ({id: `card${i}`, type: 'stand', X: FILE.X, Z: FILE.Z + (3.3 - i * 2.2) * K, w: 26 * K, h: 13 * K, raise: 0, ease: 6, art: stopCard(st, i), artBack: stopBack(st, i),
      tap: (c, e) => flipCard(c, e, i)})),
    me(88, 14, 'wave', '出发啦！背上书包，今天从南肯辛顿出发，一路往东走到塔桥。'),
  ],
  controls: [{id: 'file', X: FILE.X + 27, Z: FILE.Z + 10, len: 8, init: 0, apply: (v, c) => { c.set('file', {v}); fileLayout(c); }}],
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
const hallWall = art(100, 60, `${wc(`
  <path d="M0,600 V150 H40 V60 L90,20 L140,60 V150 H300 V110 L500,18 L700,110 V150 H860 V60 L910,20 L960,60 V150 H1000 V600 Z" fill="${BUFF}"/>
  ${stripes(0, 150, 1000, 450)}${stripes(40, 60, 100, 90)}${stripes(860, 60, 100, 90)}
  <path d="M330,330 V200 A170,170 0 0 1 670,200 V330 Z" fill="#e9d9b5"/>
  <circle cx="500" cy="96" r="30" fill="#e9d9b5"/>
  ${arches(60, 200, 4, 50, 90, '#6b5d4d', 12)}${arches(704, 200, 4, 50, 90, '#6b5d4d', 12)}
  ${arches(60, 360, 4, 50, 100, '#4f4438', 12)}${arches(704, 360, 4, 50, 100, '#4f4438', 12)}
  <rect x="40" y="320" width="270" height="12" fill="${STONE_D}"/><rect x="690" y="320" width="270" height="12" fill="${STONE_D}"/>
  <path d="M300,600 L360,430 H640 L700,600 Z" fill="#e7dcc4"/>
  ${rng(9, i => `<path d="M${300 + i * 6.7},${600 - i * 19} H${700 - i * 6.7}" stroke="#a89878" stroke-width="2"/>`)}
  <path d="M360,430 L250,350 H320 L400,430 Z M640,430 L750,350 H680 L600,430 Z" fill="#e2d6bc"/>
  <rect x="470" y="380" width="60" height="50" fill="#9aa1a6"/><circle cx="500" cy="372" r="14" fill="#9aa1a6"/>`, 1.8)}
  ${glass(350, 190, 80, 140, 3)}${glass(460, 170, 80, 160, 5)}${glass(570, 190, 80, 140, 7)}
  ${glass(476, 70, 48, 52, 9)}`);
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
const whaleArt = art(48, 48, `${wc(`
  <path d="M30,0 L205,190 M450,0 L275,190" stroke="#4a4038" stroke-width="2.5" fill="none"/>
  ${rng(9, i => { const y = 190 + i * 13; return `<path d="M232,${y} Q${150 - i * 4},${y + 6} ${170 - i * 2},${y + 70 - i * 3}" fill="none" stroke="#ece6d6" stroke-width="6"/><path d="M248,${y} Q${330 + i * 4},${y + 6} ${310 + i * 2},${y + 70 - i * 3}" fill="none" stroke="#ece6d6" stroke-width="6"/>`; })}
  ${rng(16, i => { const y = 40 + i * 17, s = .5 + i * .035; return `<rect x="${240 - 9 * s}" y="${y}" width="${18 * s}" height="13" rx="4" fill="#ece6d6"/><path d="M${240 - 22 * s},${y + 6} H${240 + 22 * s}" stroke="#ece6d6" stroke-width="4"/>`; })}
  <path d="M215,300 L110,330 L60,350 M110,330 L75,372 M110,330 L95,380 M265,300 L370,330 L420,350 M370,330 L405,372 M370,330 L385,380" stroke="#ece6d6" stroke-width="7" fill="none"/>
  <path d="M190,310 Q150,380 230,470 M290,310 Q330,380 250,470" fill="none" stroke="#ece6d6" stroke-width="14"/>
  <path d="M200,306 L280,306 L246,452 L234,452 Z" fill="#ece6d6"/><circle cx="216" cy="324" r="6" fill="#8a8172"/><circle cx="264" cy="324" r="6" fill="#8a8172"/>`, 1.4)}`);
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
const spread1 = {
  eyebrow: '10:00 · Natural History Museum', title: '自然史博物馆', en: 'Under the great roof', light: 'morning',
  story: '上午十点，走进自然史博物馆的大厅。两道铁拱横跨头顶，后墙是彩色玻璃窗和大楼梯，一副蓝鲸骨架从屋顶垂下来，好像正往下潜。拱和后墙都是跨过书脊的 V 折，两侧的拱廊立在各自的页面上。',
  todo: ['拉恐龙旁边的红色拉片（或者直接点恐龙），骨架会从地板上站起来。', '点蓝鲸 Hope，它会在大厅里游起来；再点一下停下。', '掀开右下角的门票。', '点一点小人。'],
  floor: floor(`${pageBg()}${frameLines}${mosaic}${plateBox}
    ${underBox(70, 52, 26, 14)}${grain(2000, 1300, .3)}`),
  texts: [...plateTexts('NATURAL HISTORY MUSEUM', 'Hintze Hall · Under the great roof', '自然史博物馆 · 上午 10:00'),
    ...underTexts(70, 52, 26, ['大厅里的蓝鲸骨架', '名字叫 Hope，', '长约 25 米。'])],
  pieces: [
    {id: 'wall', type: 'v', Z: -50, sigma: -5, wl: 50, wr: 50, art: hallWall},
    {id: 'galL', type: 'stand', X: -62, Z: -12, yaw: 78, art: galleryArt},
    {id: 'galR', type: 'stand', X: 62, Z: -12, yaw: -78, art: {...galleryArt, svg: galleryArt.svg.replace('<defs>', '<g transform="translate(640 0) scale(-1 1)"><defs>').replace(/<\/svg>$/, '</g></svg>')}},
    {id: 'arch1', type: 'v', Z: -32, sigma: -6, wl: 66, wr: 66, art: trussArch(132, 66)},
    {id: 'arch2', type: 'v', Z: -10, sigma: -6, wl: 62, wr: 62, art: trussArch(124, 60)},
    // tap Hope and she swims: the V-fold rises and falls on its wire and flexes like a tail; tap again to stop
    {id: 'whale', type: 'v', Z: 4, sigma: -14, wl: 24, wr: 24, art: whaleArt,
      tap: (c, e) => { const s = c.get('whale'); s.swimT = s.swimT > 0 ? 0 : 8;
        c.note(s.swimT ? 'Hope 游起来啦！它是一头真正的蓝鲸骨架，1891 年在爱尔兰搁浅。再点一下让它停下。' : 'Hope 停下来，又挂回大厅中央。', e); },
      tick: (s, dt) => { s.ph = (s.ph || 0) + dt; s.swimT = Math.max(0, (s.swimT || 0) - dt);
        s.amp = (s.amp || 0) + ((s.swimT > 0 ? 1 : 0) - (s.amp || 0)) * Math.min(1, dt * 2.5);
        s.lift = Math.sin(s.ph * 2.2) * 3 * s.amp; s.sigma = -14 + Math.sin(s.ph * 3.1) * 8 * s.amp; }},
    {id: 'dino', type: 'stand', X: -38, Z: 20, raise: 0, ease: 5, art: dinoSkeleton,
      tap: (c, e) => { const up = c.tabV('dino') < .5; c.tab('dino', up ? 1 : 0); c.note(up ? '嗷！恐龙骨架站起来了。博物馆的恐龙厅总是排着长队。' : '恐龙骨架又躺回地板上。', e); }},
    me(40, 26, 'point', '第一站：南肯辛顿的自然史博物馆！抬头看，蓝鲸好像正在往下潜。'),
    {id: 'ticket', type: 'card', X: 70, Z: 52, w: 26, h: 14, art: ticket(26, 14, 'ADMISSION', 'FREE · OPEN DAILY')},
  ],
  controls: [{id: 'dino', X: -22, Z: 15, len: 9, init: 0, apply: (v, c) => c.set('dino', {raise: v})}],
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
const clockFace = art(6.6, 6.6, `<circle cx="33" cy="33" r="31" fill="#faf4e4" stroke="${INK}" stroke-width="2.6"/>
  ${rng(12, i => { const a = i * Math.PI / 6; return `<line x1="${33 + 25 * Math.cos(a)}" y1="${33 + 25 * Math.sin(a)}" x2="${33 + 29 * Math.cos(a)}" y2="${33 + 29 * Math.sin(a)}" stroke="${INK}" stroke-width="${i % 3 ? 1.4 : 2.6}"/>`; })}`);
const hand = (len, wpx) => art(1.2, 6.6, `<path d="M6,33 L6,${33 - len}" stroke="${INK}" stroke-width="${wpx}" stroke-linecap="round"/><circle cx="6" cy="33" r="3.4" fill="${INK}"/>`);
const handPose = (dz, key) => (s) => { const a = (s[key] || 0) * Math.PI / 180;
  return {o: [BEN.X, BEN.cy, BEN.Z + dz], x: [Math.cos(a), -Math.sin(a), 0], y: [Math.sin(a), Math.cos(a), 0]}; };
const abbeyArt = art(16, 20, wc(`
  <rect x="40" y="90" width="80" height="110" fill="#d8cfb8"/><path d="M58,200 V150 a22,26 0 0 1 44,0 V200 Z" fill="#6b6150"/>
  <circle cx="80" cy="120" r="14" fill="#9fb3c4"/>
  ${[8, 120].map(x => `<rect x="${x}" y="30" width="32" height="170" fill="#e2d9c2"/>${rng(4, i => `<rect x="${x + 11}" y="${50 + i * 36}" width="10" height="22" rx="5" fill="#8f856f" stroke="none"/>`)}
    ${rng(3, i => `<polygon points="${x + i * 12 - 2},30 ${x + i * 12 + 4},6 ${x + i * 12 + 10},30" fill="#cfc5ab"/>`)}`).join('')}`, 1.3));
const eyeSmall = art(32, 34, `${wc(`<path d="M160,170 L104,336 M160,170 L216,336" stroke="#5d7387" stroke-width="8" stroke-linecap="round" fill="none"/><rect x="92" y="330" width="136" height="10" fill="#5d7387"/>`)}
  <circle cx="160" cy="170" r="146" fill="none" stroke="#5d7387" stroke-width="5"/><circle cx="160" cy="170" r="134" fill="none" stroke="#8fb0c4" stroke-width="2"/>
  ${rng(16, i => { const a = i * Math.PI / 8; return `<line x1="160" y1="170" x2="${160 + 134 * Math.cos(a)}" y2="${170 + 134 * Math.sin(a)}" stroke="#8fb0c4" stroke-width="1.3"/>`; })}
  ${rng(32, i => { const a = i * Math.PI / 16; return `<ellipse cx="${160 + 154 * Math.cos(a)}" cy="${170 + 154 * Math.sin(a)}" rx="7.5" ry="5.5" fill="${i % 5 ? '#d2e6ef' : RED}" stroke="#5d7387" stroke-width="1.3"/>`; })}
  <circle cx="160" cy="170" r="11" fill="#5d7387"/>`);
const phoneBox = art(8, 15, `${wc(`<path d="M2,26 Q40,2 78,26 V148 H2 Z" fill="${RED}"/><rect x="10" y="28" width="60" height="12" fill="#25282c"/>
  <rect x="10" y="48" width="60" height="96" fill="#b8372f"/>${rng(6, r => rng(3, k => `<rect x="${15 + k * 18}" y="${53 + r * 14}" width="14" height="10" fill="#d8e6ea" stroke-width="1"/>`))}
  <rect x="58" y="96" width="5" height="12" rx="2" fill="${GOLD}" stroke="none"/>`, 1.4)}
  <text x="40" y="38" text-anchor="middle" font-size="8" letter-spacing="1" fill="${P}" font-family="Georgia, serif">TELEPHONE</text>`);
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
  <text x="50" y="106" text-anchor="middle" font-size="9" fill="#5b4a3a" font-family="Georgia, serif" font-style="italic">17:30 · Big Ben</text>`);
const mirror = a => ({...a, svg: a.svg.replace('<defs>', `<g transform="translate(${a.w * 10} 0) scale(-1 1)"><defs>`).replace(/<\/svg>$/, '</g></svg>')});
const spread2 = {
  eyebrow: '17:30 · Westminster', title: '威斯敏斯特', en: 'Along the Thames', light: 'afternoon',
  story: '傍晚，站在南岸看对面的威斯敏斯特宫：议会大厦是一道跨过书脊的 V 折长立面，北端是大本钟，南端是维多利亚塔，西敏寺的双塔从后面探出头来；这一侧的河岸上是伦敦眼和红色电话亭。拨动大本钟的指针，时间走到 17:30，夕阳就把整片河岸照成金色。',
  todo: ['按住大本钟的钟面绕圈拖动，拨动指针：顺时针时间往后走，天色从午后变成金色的傍晚；每到整点会敲钟。', '点小人身边的拍立得，咔嚓一声，照片会慢慢出来；再点一下照片收回去。', '游船下面有一条轨道：拉船旁边的拉片，或者直接拖动船，让它沿河左右开。', '掀开右下角的卡片。'],
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
    ${underBox(71, 54, 22, 12)}${grain(2000, 1300, .3)}`),
  texts: [...plateTexts('WESTMINSTER', 'Along the Thames', '威斯敏斯特 · 傍晚 17:30'),
    ...underTexts(71, 54, 22, ['分针长约 4.2 米，', '和一辆双层巴士', '差不多高。'])],
  pieces: [
    {id: 'sky', type: 'v', Z: -60, sigma: -3, wl: 96, wr: 96, art: skylineDay},
    // seen from the South Bank: the Victoria Tower at the south (left) end, Big Ben at the north (right) end, the Abbey behind
    {id: 'abbey', type: 'stand', X: -84, Z: -44, art: abbeyArt, tap: (c, e) => c.note('西敏寺就在议会大厦后面，英国国王的加冕礼都在这里举行。', e)},
    {id: 'parl', type: 'v', Z: -36, sigma: -9, wl: 72, wr: 72, art: mirror(parliamentArt), tap: (c, e) => c.note('议会大厦（威斯敏斯特宫）里大约有 1100 个房间。', e)},
    {id: 'ben', type: 'stand', X: BEN.X, Z: BEN.Z, art: bigBenArt, tap: (c, e) => { c.bong(); c.note('当——！按住钟面绕圈拖，可以拨动指针。', e); }},
    {id: 'clockFace', type: 'custom', anchor: 'center', art: clockFace, pose: () => ({o: [BEN.X, BEN.cy, BEN.Z + .12], x: [1, 0, 0], y: [0, 1, 0]}),
      dial: (deg, c) => c.tab('time', c.tabV('time') + deg / 360 * 60 / 240), tap: (c, e) => c.note('按住钟面，顺时针绕圈拖动，时间就往后走。', e)},
    {id: 'hourH', type: 'custom', anchor: 'center', art: hand(17, 4.5), pose: handPose(.24, 'ang')},
    {id: 'minH', type: 'custom', anchor: 'center', art: hand(27, 2.6), pose: handPose(.34, 'ang')},
    {id: 'boat', type: 'stand', X: -78, Z: 2, art: boatArt, ease: 4, bob: .5, rock: 3, stride: .3, drag: 'boat', tap: (c, e) => { c.hop('boat'); c.note('坐游船沿河往东，就能一路看到塔桥。', e); }},
    {id: 'eye', type: 'stand', X: 77, Z: 17, art: eyeSmall, tap: (c, e) => c.note('伦敦眼就在南岸，高 135 米，坐一圈大约半小时。', e)},
    {id: 'phone', type: 'stand', X: 30, Z: 33, art: phoneBox, tap: (c, e) => c.note('红色电话亭：伦敦街头最上镜的背景。', e)},
    {id: 'railL', type: 'stand', X: -50, Z: 21, art: railArt([70])},
    {id: 'railR', type: 'stand', X: 50, Z: 21, art: mirror(railArt([70]))},
    station(-30, 33, 'WESTMINSTER', '17:30'),
    me(30, 39, 'camera', '这里是南岸，对面就是威斯敏斯特宫。在电话亭前面拍一张！'),
    {id: 'cam', type: 'stand', X: 47, Z: 44, w: 17, h: 15.6, art: instax,
      tap: (c, e) => { const out = c.get('photo').opened; c.toggle('photo'); if (!out) c.shutter(); if (c.once('photo')) c.note('咔嚓！照片慢慢从相机里出来了。', e); }},
    {id: 'photo', type: 'custom', X: 47, Z: 43.6, w: 13, h: 15, art: polaroid, speed: 2.5, tap: c => c.toggle('photo'),
      pose: (s, rise, p) => ({o: [s.X, .8 + 13.5 * smoothstep(p.open), s.Z], x: [1, 0, 0], y: [0, 1, 0]})},
    {id: 'card', type: 'card', X: 71, Z: 54, w: 22, h: 12, art: ticket(22, 12, 'BIG BEN', 'SINCE 1859', '#f0e2c0', '#5b4a2a')},
  ],
  controls: [
    // time runs from 15:00 (v = 0) to 19:00 (v = 1), turned by the clock hands
    {id: 'time', hidden: true, X: BEN.X, Z: BEN.Z, len: 10, init: .25, apply: (v, c) => {
      const t = 900 + v * 240, h = t / 60, hr = Math.floor(h + 1e-6), clk = c.get('clockFace');
      c.set('hourH', {ang: (h % 12) * 30}); c.set('minH', {ang: (t % 60) * 6});
      if (h <= 17.5) c.light('afternoon', 'golden', clamp01((h - 16) / 1.5)); else c.light('golden', 'evening', clamp01((h - 17.5) / 1.5));
      if (clk.hr !== undefined && hr !== clk.hr) c.bong(); clk.hr = hr;
    }},
    // the boat runs on a track along the river; its tab rides beside it
    {id: 'boat', X: -78, Z: 9, dir: [1, 0, 0], len: 156, init: 0, apply: (v, c) => c.set('boat', {X: -78 + v * 156})},
  ],
};

/* ======================= 3 · West End, a night at the theatre ======================= */
const BRICK = '#b5523f', CREAM = '#e9dcc0';
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
const leftStreet = lit => {
  const blocks = [[0, 200, 60, BRICK, 'chim'], [200, 180, 100, CREAM], [380, 180, 80, BRICK, 'dome'], [560, 200, 120, CREAM, 'chim']];
  const sign = `<rect x="40" y="250" width="150" height="70" fill="#1d1c22" stroke="${GOLD}" stroke-width="3"/>${bulbs(40, 250, 150, 70, lit)}
    <text x="115" y="300" text-anchor="middle" font-size="40" font-family="Georgia, serif" fill="${lit ? '#fff4c8' : GOLD}" letter-spacing="4">SIX</text><path d="M104,262 l6,-8 l5,6 l5,-6 l5,6 l6,-6 l-3,10 Z" fill="${GOLD}"/>`;
  return art(76, 52, lit ? `${facadeRow(blocks, 520, true)}${sign}` : `${wc(facadeRow(blocks, 520, false), 1.6)}${sign}`);
};
const rightStreet = lit => {
  const blocks = [[0, 200, 120, CREAM, 'chim'], [200, 170, 80, BRICK], [370, 170, 100, CREAM, 'chim'], [540, 220, 60, CREAM]];
  const vert = `<rect x="440" y="150" width="34" height="200" fill="#1f2b4f" stroke="${GOLD}" stroke-width="2"/>${'ADELPHI'.split('').map((ch, i) => `<text x="457" y="${182 + i * 25}" text-anchor="middle" font-size="22" font-family="Georgia, serif" fill="${lit ? '#fff4c8' : GOLD}">${ch}</text>`).join('')}`;
  const canopy = `<rect x="550" y="400" width="200" height="22" fill="#2a2a30"/>${bulbs(550, 398, 200, 26, lit)}
    <rect x="570" y="300" width="160" height="56" fill="#1d1c22" stroke="${GOLD}" stroke-width="3"/><text x="650" y="338" text-anchor="middle" font-size="24" letter-spacing="3" font-family="Georgia, serif" fill="${lit ? '#fff4c8' : GOLD}">VAUDEVILLE</text>`;
  return art(76, 52, lit ? `${facadeRow(blocks, 520, true)}${vert}${canopy}` : `${wc(facadeRow(blocks, 520, false), 1.6)}${vert}${canopy}`);
};
const corner = (color, lit, arch = true) => art(34, 48, lit
  ? `${rng(4, f => rng(3, k => ((f + k) % 2 ? win(46 + k * 90, 70 + f * 70, 40, 44, true) : '')))}<path d="M110,480 V400 A60,60 0 0 1 230,400 V480 Z" fill="#ffcf7e"/>`
  : `${wc(`<path d="M0,480 V60 L40,30 H300 L340,60 V480 Z" fill="${color}"/><rect x="0" y="54" width="340" height="12" fill="#d8ccb2"/>
    ${rng(4, f => rng(3, k => win(46 + k * 90, 70 + f * 70, 40, 44)))}
    ${arch ? `<path d="M100,480 V390 A70,70 0 0 1 240,390 V480 Z" fill="#3a3029"/>` : `<rect x="40" y="380" width="260" height="100" fill="#3a3029"/>`}
    <rect x="0" y="360" width="340" height="12" fill="#d8ccb2"/>`, 1.6)}`);
const wireBanners = lit => art(80, 62, lit
  ? rng(18, i => `<circle cx="${30 + i * 42}" cy="${112 + Math.sin(i / 17 * Math.PI) * 40}" r="5" fill="#fff2b0"/><circle cx="${30 + i * 42}" cy="${112 + Math.sin(i / 17 * Math.PI) * 40}" r="12" fill="#ffd27a" opacity=".5" filter="url(#glow)"/>`)
  : wc(`<path d="M0,60 Q400,170 800,60" fill="none" stroke="#2a2a2a" stroke-width="3"/><path d="M0,100 Q400,180 800,100" fill="none" stroke="#2a2a2a" stroke-width="2"/>
    ${[150, 300, 500, 650].map((x, i) => { const y = 60 + 110 * (1 - Math.pow((x - 400) / 400, 2)) * .82;
      return `<rect x="${x - 34}" y="${y}" width="68" height="130" fill="${i % 2 ? '#3b2f5c' : '#7a2a3a'}"/><path d="M${x - 34},${y + 130} l34,18 l34,-18" fill="${i % 2 ? '#3b2f5c' : '#7a2a3a'}"/>
        <circle cx="${x}" cy="${y + 50}" r="20" fill="none" stroke="${GOLD}" stroke-width="3"/><path d="M${x - 12},${y + 92} h24 M${x - 8},${y + 104} h16" stroke="${GOLD}" stroke-width="3"/>`; }).join('')}
    ${rng(18, i => `<circle cx="${30 + i * 42}" cy="${112 + Math.sin(i / 17 * Math.PI) * 40}" r="5" fill="#c9b37a"/>`)}`, 1.4));
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
const spread3 = {
  eyebrow: '19:30 · West End', title: '西区剧院街', en: 'A night at the theatre', light: 'evening', lit: 1,
  story: '晚上七点半，河岸街的路灯刚亮，剧院门口排起了队。两排房子立在街道两侧，远处的街景是一张跨过书脊的 V 折，头顶挂着一串彩旗。拉一拉小人脚边的拉片，和朋友在路中间碰头；87 路巴士是一只纸盒，直接按住它就能沿着轨道前后开。',
  todo: ['拉小人脚边的拉片（或者直接拖小人），她和朋友从两边走过来碰面。', '按住 87 路巴士前后拖（或者拉它旁边的拉片），巴士沿着轨道开。', '点两边的房子，开灯、关灯。', '掀开右下角的入场券。'],
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
    ${underBox(72, 56, 22, 11)}${grain(2000, 1300, .3)}`),
  floorLit: floor(`<rect width="2000" height="1300" fill="#000"/>
    ${[[-22, 14], [22, 0], [-50, 30], [56, 26], [-40, -6], [40, -10]].map(([X, Z]) => `<ellipse cx="${fx(X)}" cy="${fz(Z) + 30}" rx="130" ry="60" fill="#4a2c0c" filter="url(#glow)"/>`).join('')}`),
  texts: [...plateTexts('WEST END', 'A night at the theatre', '西区 · 晚上 19:30'),
    {x: fx(0), y: fz(54), text: 'LOOK RIGHT →', font: `700 26px sans-serif`, color: '#f4efe2', align: 'center', ls: 3},
    ...underTexts(72, 56, 22, ['SIX 把亨利八世的', '六位王后', '唱成了演唱会。'])],
  pieces: [
    {id: 'back', type: 'v', Z: -54, sigma: -4, wl: 46, wr: 46, art: streetBack(false), artLit: streetBack(true)},
    {id: 'flags', type: 'v', Z: -22, sigma: -5, wl: 40, wr: 40, art: wireBanners(false), artLit: wireBanners(true)},
    {id: 'left', type: 'stand', X: -36, Z: -8, yaw: 78, art: leftStreet(false), artLit: leftStreet(true), tap: (c, e) => { c.lights('toggle'); c.note('开演前，整条街的橱窗和招牌都亮着。', e); }},
    {id: 'right', type: 'stand', X: 36, Z: -8, yaw: -78, art: rightStreet(false), artLit: rightStreet(true), tap: (c, e) => { c.lights('toggle'); c.note('Vaudeville 剧院 1870 年开张，就在河岸街上。', e); }},
    {id: 'cornerL', type: 'stand', X: -68, Z: 30, art: corner(BRICK, false), artLit: corner(BRICK, true)},
    {id: 'cornerR', type: 'stand', X: 68, Z: 30, art: corner(CREAM, false, false), artLit: corner(CREAM, true, false)},
    {id: 'lampL', type: 'stand', X: -22, Z: 14, art: lamp(26), artLit: lamp(26, true)},
    {id: 'lampR', type: 'stand', X: 22, Z: 0, art: lamp(26), artLit: lamp(26, true)},
    {id: 'bus', type: 'box', X: 9, Z: -34, w: 9, d: 24, h: 13, inside: '#7a1f1c', ease: 4, bob: .25, stride: .5, drag: 'bus',
      faces: {front: busFront, back: busBack, left: bus87, right: mirror(bus87), top: busRoof},
      tap: (c, e) => { c.hop('bus'); c.note('87 路开往 Aldwych。按住巴士前后拖，它会沿着轨道开。', e); }},
    station(58, 40, 'CHARING CROSS', '19:30'),
    {...me(-38, 38, 'wave', '这里是西区的河岸街，今晚和朋友约好一起看 SIX！'), drag: 'meet'},
    {id: 'friend', type: 'stand', X: 38, Z: 38, w: 10, h: 17.5, art: mirror(traveller('hello', FRIEND)), bob: 1, stride: .55,
      tap: (c, e) => { c.hop('friend'); c.note('等你好久啦！票我已经取好了。', e); }},
    {id: 'ticket', type: 'card', X: 72, Z: 56, w: 22, h: 11, art: ticket(22, 11, 'ADMIT ONE', 'STALLS · ROW F', '#f2d4cf', '#7a2a3a')},
  ],
  controls: [
    // both tabs ride beside what they move; the bus and the traveller can also be dragged directly
    {id: 'bus', X: 16, Z: -34, len: 60, init: 0, apply: (v, c) => c.set('bus', {Z: -34 + v * 60})},
    {id: 'meet', X: -38, Z: 44, dir: [1, 0, 0], len: 32, init: 0, apply: (v, c) => {
      c.set('me', {X: -38 + v * 32}); c.set('friend', {X: 38 - v * 32});
      if (v > .96 && c.once('met')) { c.hop('me'); c.hop('friend'); c.note('终于碰面啦！走，看戏去。'); }
    }},
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
const spread4 = {
  eyebrow: '22:00 · Tower Bridge', title: '塔桥之夜', en: 'A night on the Thames', light: 'night', lit: 0,
  story: '深夜十点，泰晤士河很黑，只有远处的城市亮着几扇窗。两座桥塔用十字插片立起来，高处的人行道是一张跨过书脊的 V 折。转动岸边的绞盘：桥面掀起，夜船随浪驶近，整座塔桥一起亮灯；倒着转，船退回去，灯也熄灭。晚安，伦敦。',
  todo: ['按住左下方岸边的绞盘绕圈转（顺时针）：桥面掀起，浪一层层起伏，夜船驶近，全桥亮灯。', '逆时针转回去：船退回桥后，灯光熄灭。', '点一点桥塔，单独开灯、关灯。', '掀开右下角的卡片。'],
  floor: floor(`${pageBg('#1d2b45')}
    ${(() => { const r = rand(97); return rng(180, () => { const x = r() * 1960, y = r() * fz(28); return `<path d="M${x},${y} q10,-6 20,0 q10,-6 20,0" fill="none" stroke="#33496f" stroke-width="2.4"/>`; }); })()}
    <rect x="0" y="${fz(28)}" width="2000" height="16" fill="#5d5a55"/>
    <rect x="0" y="${fz(28) + 16}" width="2000" height="${1300 - fz(28)}" fill="#8f897d"/>
    ${rng(9, i => `<path d="M0,${fz(32) + i * 40} H2000" stroke="#7c766b" stroke-width="1.6"/>`)}${rng(26, i => `<path d="M${i * 80 + (i % 2) * 40},${fz(32)} V1300" stroke="#7c766b" stroke-width="1.2"/>`)}
    ${plateBox}
    ${underBox(72, 56, 22, 11)}${grain(2000, 1300, .25)}`),
  floorLit: floor(`<rect width="2000" height="1300" fill="#000"/>
    ${[[-27, '#c99a3a'], [27, '#c99a3a'], [0, '#3a4fa8']].map(([X, c]) => rng(12, i => `<path d="M${fx(X) - 50 + (i % 3) * 30},${fz(-14) + i * 34} h${60 + (i % 4) * 14}" stroke="${c}" stroke-width="8" opacity=".9"/>`)).join('')}
    ${(() => { const r = rand(101); return rng(60, () => `<path d="M${r() * 2000},${fz(-60) + r() * 120} h${10 + r() * 30}" stroke="#a07a2a" stroke-width="4"/>`); })()}
    <ellipse cx="${fx(-79)}" cy="${fz(36)}" rx="90" ry="40" fill="#7a5212" filter="url(#glow)"/>`),
  texts: [...plateTexts('TOWER BRIDGE', 'A night on the Thames', '塔桥 · 深夜 22:00'),
    ...underTexts(72, 56, 22, ['塔桥每年大约', '开桥 800 次。'])],
  pieces: [
    {id: 'sky', type: 'v', Z: -58, sigma: -3, wl: 96, wr: 96, art: nightSkyline(false), artLit: nightSkyline(true)},
    {id: 'towerL', type: 'stand', X: -27, Z: -20, cross: 15, art: tbTower(false), artLit: tbTower(true), tap: (c, e) => { c.lights('toggle'); c.note('塔桥 1894 年通车。夜里桥身的灯带一亮，整条河都是倒影。', e); }},
    {id: 'towerR', type: 'stand', X: 27, Z: -20, cross: 15, art: tbTower(false), artLit: tbTower(true), tap: (c, e) => { c.lights('toggle'); c.note('高处的人行道原本是给行人在开桥时过河用的。', e); }},
    {id: 'walk', type: 'v', Z: -22, sigma: -2, wl: 19, wr: 19, art: walkway(false), artLit: walkway(true)},
    {id: 'chainL', type: 'stand', X: -66.8, Z: -22, art: chain(false), artLit: chain(true)},
    {id: 'chainR', type: 'stand', X: 66.8, Z: -22, art: mirror(chain(false)), artLit: mirror(chain(true))},
    {id: 'basL', type: 'custom', anchor: 'left', art: bascule(), lift: 0, pose: (s, rise) => { const L = s.lift * 72 * Math.PI / 180;
      return {o: [-18.5, 8 * rise, -21.4], x: [Math.cos(L), Math.sin(L), 0], y: [-Math.sin(L), Math.cos(L), 0]}; }},
    {id: 'basR', type: 'custom', anchor: 'right', art: bascule(), lift: 0, pose: (s, rise) => { const L = s.lift * 72 * Math.PI / 180;
      return {o: [18.5, 8 * rise, -21.4], x: [Math.cos(L), -Math.sin(L), 0], y: [Math.sin(L), Math.cos(L), 0]}; }},
    {id: 'ship', type: 'stand', X: 1, Z: -46, raise: .98, ease: 4, bob: .5, rock: 3, stride: .3, art: shipFront(false), artLit: shipFront(true), tap: (c, e) => { c.hop('ship'); c.note('嘟——夜船正从桥下穿过。', e); }},
    ...WAVES.flatMap(([Z, ph, sd], k) => ['L', 'R'].map(side => ({id: `wave${k}${side}`, type: 'stand', X: side === 'L' ? -49 : 49, Z, ease: 6,
      art: waveRow(sd + (side === 'L' ? 0 : 1), false), artLit: waveRow(sd + (side === 'L' ? 0 : 1), true)}))),
    {id: 'embank', type: 'stand', X: -56, Z: 31, art: embank(false), artLit: embank(true)},
    {id: 'crankPost', type: 'stand', X: CRANK.X, Z: CRANK.Z - .5, art: crankPost},
    {id: 'crank', type: 'custom', anchor: 'center', art: crankWheel, ang: 0,
      pose: s => { const a = (s.ang || 0) * Math.PI / 180; return {o: [CRANK.X, CRANK.y, CRANK.Z], x: [Math.cos(a), -Math.sin(a), 0], y: [Math.sin(a), Math.cos(a), 0]}; },
      dial: (deg, c) => c.tab('open', c.tabV('open') + deg / 720), tap: (c, e) => c.note('按住绞盘绕圈转：顺时针开桥，逆时针收回。', e)},
    station(-24, 50, 'TOWER HILL', '22:00'),
    me(56, 44, 'wave', '这里是塔桥，夜里亮灯的样子最好看。晚安，伦敦，明天见！'),
    {id: 'card', type: 'card', X: 72, Z: 56, w: 22, h: 11, art: ticket(22, 11, 'OUR LONDON', '22:00 · TOWER BRIDGE', '#e9e2d0', '#2f3f5f')},
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
