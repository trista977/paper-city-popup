/* Shared drawing helpers for 3D pop-up books.
   Every piece of art is a standalone SVG (it is rasterised into a texture), so each one carries its own filter defs.
   Sizes are in book units: 1u = 1% of a page's width; an art(w, h) has a viewBox of w*10 × h*10. */

export const P = '#f6efe0', INK = '#3a3129', RED = '#c8423a', GOLD = '#d8a93b', NAVY = '#1f3c8f';
export const rng = (n, f) => Array.from({length: n}, (_, i) => f(i)).join('');
export const rand = seed => { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };

const DEFS = `<defs>
  <filter id="wc" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="3" xChannelSelector="R" yChannelSelector="G" result="wob"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="11" result="blot"/>
    <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.7 0 0 0 -0.6" result="blotA"/>
    <feFlood flood-color="#4a321c" flood-opacity="0.16"/>
    <feComposite in2="blotA" operator="in" result="stain"/>
    <feComposite in="stain" in2="wob" operator="in" result="stainIn"/>
    <feMerge><feMergeNode in="wob"/><feMergeNode in="stainIn"/></feMerge>
  </filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="2"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.33  0 0 0 0 0.22  0.7 0 0 0 -0.3"/>
  </filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
</defs>`;

// watercolour ink group: wobbly outline + paper stains
export const wc = (inner, sw = 2) => `<g filter="url(#wc)" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;
export const art = (w, h, inner) => ({w, h,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w*10} ${h*10}" width="${w*10}" height="${h*10}">${DEFS}${inner}</svg>`});
export const grain = (w, h, o = .45) => `<rect width="${w}" height="${h}" filter="url(#grain)" opacity="${o}"/>`;
export const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;

/* ---- small reusable motifs ---- */
export const cloud = (x, y, s = 1, fill = '#fbf8f0') =>
  `<path d="M${x},${y} h${90*s} a${14*s},${14*s} 0 0 0 ${-8*s},${-22*s} a${20*s},${20*s} 0 0 0 ${-34*s},${-12*s} a${18*s},${18*s} 0 0 0 ${-34*s},${6*s} a${14*s},${14*s} 0 0 0 ${-14*s},${28*s} Z" fill="${fill}"/>`;

// a Victorian street lamp, h units tall; lit = glow halo only (for the night overlay)
export const lamp = (h, lit = false) => art(6, h, lit
  ? `<circle cx="30" cy="30" r="26" fill="#ffd27a" opacity=".85" filter="url(#glow)"/><polygon points="20,18 40,18 43,40 17,40" fill="#ffe7a6"/>`
  : wc(`<rect x="27" y="44" width="6" height="${h*10-58}" fill="#2a2e33"/><rect x="21" y="${h*10-16}" width="18" height="14" fill="#2a2e33"/>
    <path d="M24,${h*10-30} h12" stroke-width="3"/>
    <polygon points="20,18 40,18 43,40 17,40" fill="#e8c86a"/><path d="M17,40 h26 l-4,6 h-18 Z" fill="#2a2e33"/>
    <polygon points="18,18 30,6 42,18" fill="#2a2e33"/><circle cx="30" cy="4" r="3" fill="#2a2e33"/>`, 1.6));

// Underground-style station sign on a post, with the time on a plate
export const roundel = (name, time) => art(26, 18, `
  ${wc(`<rect x="126" y="80" width="8" height="90" fill="#33373d"/><rect x="112" y="166" width="36" height="10" fill="#33373d"/>
    <circle cx="130" cy="50" r="38" fill="none" stroke="#d1352f" stroke-width="15"/>
    <rect x="6" y="38" width="248" height="24" fill="${NAVY}"/>
    <rect x="96" y="104" width="68" height="20" rx="3" fill="${P}"/>`)}
  <text x="130" y="56" text-anchor="middle" font-size="${Math.min(16, 300 / name.length)}" letter-spacing="1.2" fill="#fff" font-family="Helvetica, Arial, sans-serif" font-weight="700">${name}</text>
  <text x="130" y="119" text-anchor="middle" font-size="13" fill="${INK}" font-family="Georgia, serif">${time}</text>`);

/* ---- the traveller: a small storybook figure who walks through every spread ----
   long black hair, sunglasses pushed up, blue cable-knit sweater, a rust-red satchel and a folded umbrella */
const TRAVELLER = {hair: '#211d21', knit: '#5b86d6', knitD: '#3f66b5', skin: '#f2d2b6', long: true, shades: true, legs: '#2b3140', pack: '#b5523f'};
// her friend for the West End: short brown hair, mustard coat
export const FRIEND = {hair: '#6b4226', knit: '#d9a441', knitD: '#b5832a', skin: '#f0cfae', long: false, shades: false, legs: '#3a3f4a'};
export function traveller(pose, look = TRAVELLER) {
  const {hair: HAIR, knit: KNIT, knitD: KNIT_D, skin: SKIN} = look;
  const arm = (x1, y1, x2, y2) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="${KNIT_D}" stroke-width="10" stroke-linecap="round"/><path d="M${x1},${y1} L${x2},${y2}" stroke="${KNIT}" stroke-width="7" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="4.5" fill="${SKIN}" stroke-width="1.2"/>`;
  // a closed umbrella hanging from the hand by its crook handle
  const suitcase = `<path d="M13,96 q-7,0 -7,6" fill="none" stroke="#5b3a26" stroke-width="3"/>
    <path d="M13,98 L13,136" stroke="#5b3a26" stroke-width="2.4"/>
    <path d="M13,104 Q20,112 17,128 L13,134 L9,128 Q6,112 13,104 Z" fill="#2d5a43"/>
    <path d="M13,106 L13,132 M10,112 L15,126" stroke="#1f4230" stroke-width="1" fill="none"/>
    <rect x="9" y="116" width="8" height="3" rx="1.5" fill="#d8a93b" stroke="none"/>`;
  const arms = {
    wave:   `${suitcase}${arm(24, 68, 13, 96)}${arm(56, 68, 70, 42)}`,
    hello:  `${arm(24, 68, 12, 94)}${arm(56, 68, 70, 42)}`,
    point:  `${suitcase}${arm(24, 68, 13, 96)}${arm(56, 68, 71, 47)}<path d="M72,45 l4,-5" stroke="${SKIN}" stroke-width="3.5" stroke-linecap="round"/>`,
    map:    `${arm(24, 68, 24, 84)}${arm(56, 68, 56, 84)}<rect x="16" y="74" width="48" height="26" fill="#f4ead2"/><path d="M40,74 v26" stroke-width="1"/><path d="M22,94 q8,-14 16,-6 t20,-8" fill="none" stroke="${RED}" stroke-width="2" stroke-dasharray="3 3"/>`,
    camera: `${suitcase}${arm(24, 68, 13, 96)}${arm(56, 68, 62, 50)}<rect x="56" y="36" width="20" height="14" rx="3" fill="#2b2f36"/><circle cx="66" cy="43" r="4.5" fill="#8fb0c4"/>`,
  }[pose];
  // a small satchel worn across the body: strap over the left shoulder, bag with a flap and buckle at the right hip
  const pack = '';
  const straps = look.pack ? `<path d="M27,60 L63,92" stroke="#6b3a22" stroke-width="4"/>
    <path d="M55,86 H77 Q79,86 79,88 V104 Q79,108 75,108 H57 Q53,108 53,104 V88 Q53,86 55,86 Z" fill="${look.pack}"/>
    <path d="M53,88 Q53,86 55,86 H77 Q79,86 79,88 V96 Q66,101 53,96 Z" fill="#8f3b2a"/>
    <rect x="63" y="94" width="6" height="7" rx="1" fill="#d8a93b" stroke-width="1"/>` : '';
  return art(8, 14, wc(`
    ${pack}
    ${look.long ? `<path d="M19,42 C14,18 30,8 40,8 C52,8 66,18 61,42 L64,98 Q40,106 16,98 Z" fill="${HAIR}"/>` : `<path d="M21,44 C16,20 30,12 40,12 C50,12 64,20 59,44 L60,58 Q40,64 20,58 Z" fill="${HAIR}"/>`}
    <rect x="26" y="104" width="11" height="26" fill="${look.legs}"/><rect x="43" y="104" width="11" height="26" fill="${look.legs}"/>
    <ellipse cx="30" cy="132" rx="8" ry="4" fill="#1d1d1d"/><ellipse cx="50" cy="132" rx="8" ry="4" fill="#1d1d1d"/>
    <path d="M22,64 Q40,57 58,64 L62,106 H18 Z" fill="${KNIT}"/>
    ${[30, 40, 50].map(x => `<path d="M${x},70 q3,5 0,10 t0,10 t0,10" fill="none" stroke="${KNIT_D}" stroke-width="1.6"/>`).join('')}
    <polygon points="31,60 40,72 49,60" fill="${KNIT_D}"/>
    ${straps}
    ${look.long ? `<path d="M23,40 L20,80 Q24,83 27,77 L27,46 Z M57,40 L60,80 Q56,83 53,77 L53,46 Z" fill="${HAIR}" stroke="none"/>` : ''}
    <circle cx="40" cy="38" r="17" fill="${SKIN}"/>
    <path d="M22,38 Q22,17 40,17 Q58,17 58,38 Q52,25 41,24 Q30,25 22,38 Z" fill="${HAIR}"/>
    ${look.shades ? `<rect x="24" y="15" width="14" height="8" rx="3.5" fill="#1b2430"/><rect x="42" y="15" width="14" height="8" rx="3.5" fill="#1b2430"/><path d="M38,18 h4" stroke-width="1.5"/>` : ''}
    <circle cx="33" cy="40" r="2.3" fill="${INK}" stroke="none"/><circle cx="47" cy="40" r="2.3" fill="${INK}" stroke="none"/>
    <circle cx="29" cy="46" r="3" fill="#ef9f92" opacity=".6" stroke="none"/><circle cx="51" cy="46" r="3" fill="#ef9f92" opacity=".6" stroke="none"/>
    <path d="M36,47 Q40,50 44,47" fill="none" stroke-width="1.6"/>
    ${arms}`, 1.6));
}

// a paper card that lies on the page and lifts on a hinge along its back edge
export const ticket = (w, h, title, sub, color = '#f3e3c4', ink = '#7a2a2a') => art(w, h, `
  ${wc(`<path d="M4,4 H${w*10-4} V${h*10/2-10} a10,10 0 0 0 0,20 V${h*10-4} H4 V${h*10/2+10} a10,10 0 0 0 0,-20 Z" fill="${color}"/>
    <rect x="16" y="14" width="${w*10-32}" height="${h*10-28}" fill="none" stroke="${ink}" stroke-width="1.4"/>`, 1.6)}
  <text x="${w*5}" y="${h*5 + 2}" text-anchor="middle" font-size="${Math.min(22, w*10/title.length*1.15)}" letter-spacing="3" fill="${ink}" font-family="Georgia, serif">${title}</text>
  <text x="${w*5}" y="${h*5 + 24}" text-anchor="middle" font-size="11" letter-spacing="2" fill="${ink}" font-family="Georgia, serif" opacity=".8">${sub}</text>`);
