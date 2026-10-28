#!/usr/bin/env node
/* Render the share cover's grid still: the four stops of Memory in London, each from its share card's own close-up
   (lit where the card is lit), in a 2 × 2 sprite at books/assets/share-grid.jpg for books/share-card.js.
     npm run share-grid           with the machine's GPU
     SOFT=1 npm run share-grid    software rendering, as the tests do
   Run it again after a stop's pieces or its shareView change. */
import {createServer} from 'node:http';
import {readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'books/assets/share-grid.jpg');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'};
const server = createServer(async (req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { if (!p.startsWith(ROOT) || !(await stat(p)).isFile()) throw 0; res.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const GL = process.env.SOFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--ignore-gpu-blocklist', '--enable-gpu'];
const browser = await chromium.launch({args: GL});
try {
  const p = await browser.newPage({viewport: {width: 1280, height: 800}});
  await p.goto(`http://localhost:${server.address().port}/memory.html`);
  await p.waitForFunction(() => window.__reader, null, {timeout: 240000});
  await p.click('#openBook');
  await p.waitForFunction(() => window.__reader.cur === 0 && !window.__reader.busy, null, {timeout: 400000});
  const tiles = [];
  for (const k of [1, 2, 3, 4]) {
    await p.evaluate(k => window.__reader.go(k), k);
    await p.waitForFunction(k => window.__reader.cur === k && !window.__reader.busy, k, {timeout: 400000});
    await p.waitForTimeout(2500); await p.evaluate(() => window.__reader.settle());
    tiles.push(await p.evaluate(async k => {
      const {closeView, GRID_TILE} = await import('./books/share-card.js'), {MEMORY_LONDON} = await import('./books/memory-london.js');
      return window.__reader.snapshot({w: GRID_TILE.w, h: GRID_TILE.h, ...closeView(MEMORY_LONDON.spreads[k], k)}).toDataURL('image/png');
    }, k));
    console.log(`stop ${k} rendered`);
  }
  const jpg = await p.evaluate(async tiles => {
    const {GRID_TILE: T} = await import('./books/share-card.js'), c = document.createElement('canvas'); c.width = T.w * 2; c.height = T.h * 2;
    const x = c.getContext('2d');
    for (const [k, src] of tiles.entries()) { const im = new Image(); im.src = src; await im.decode(); x.drawImage(im, (k % 2) * T.w, Math.floor(k / 2) * T.h); }
    return c.toDataURL('image/jpeg', .82);
  }, tiles);
  await writeFile(OUT, Buffer.from(jpg.split(',')[1], 'base64'));
  console.log(`${path.relative(ROOT, OUT)} written`);
} finally { await browser.close(); server.close(); }
