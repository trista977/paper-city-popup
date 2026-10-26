#!/usr/bin/env node
/* Test runner for the pop-up books. Serves the repo, drives Chromium (software WebGL, so it runs the same on a laptop
   and in CI) and runs every spec in tests/specs/ in turn.
     npm test                      run everything
     npm test -- paper phone       run only specs whose file name contains one of these words
     npm run test:update           re-record the screenshot baselines in tests/baseline/
   Screenshots that fail their comparison are written to tests/output/ (actual + diff) for a look. */
import {createServer} from 'node:http';
import {readFile, readdir, stat, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), update = args.includes('--update'), only = args.filter(a => !a.startsWith('--'));
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'};
const server = createServer(async (req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { if (!p.startsWith(ROOT) || !(await stat(p)).isFile()) throw 0; res.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}`;

let chromium;
try { ({chromium} = createRequire(import.meta.url)('playwright')); } catch { ({chromium} = await import('playwright')); }
const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
await mkdir(path.join(ROOT, 'tests/output'), {recursive: true});

/* ---------- helpers every spec gets ---------- */
class Fail extends Error {}
function helpers(log) {
  const pages = [];
  const t = {
    ROOT, BASE, update, log,
    check(ok, msg) { if (!ok) throw new Fail(msg); log(`  ✓ ${msg}`); },
    // a page with the book loaded; options as for browser.newContext (viewport, isMobile, hasTouch…)
    async book(opts = {}) {
      const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, acceptDownloads: true, ...opts}), p = await ctx.newPage();
      p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); p.on('console', m => m.type() === 'error' && p.errors.push(m.text()));
      pages.push(p);
      await p.goto(`${BASE}/memory.html`);
      await p.waitForFunction(() => window.__reader, null, {timeout: 240000});
      return p;
    },
    async open(p) { await p.click('#openBook'); await t.settled(p, 0); },
    async settled(p, k) { await p.waitForFunction(k => window.__reader.cur === k && !window.__reader.busy, k, {timeout: 400000}); },
    async go(p, k, wait = 1500) { await p.evaluate(k => window.__reader.go(k), k); await t.settled(p, k); await p.waitForTimeout(wait); },
    // screen position of a piece's centre
    at: (p, id, k = 0) => p.evaluate(([id, k]) => { const R = window.__reader, f = R.spreads[R.cur].byId[id].parts[k].front;
      f.geometry.computeBoundingBox(); const c = f.geometry.boundingBox.getCenter(f.position.clone()).applyMatrix4(f.matrixWorld).project(R.camera);
      return [(c.x + 1) / 2 * innerWidth, (1 - c.y) / 2 * innerHeight]; }, [id, k]),
    // screen position of a point on the flat page (flat-world X, Z)
    pagePoint: (p, X, Z) => p.evaluate(([X, Z]) => { const R = window.__reader, v = R.camera.position.clone().set(X / 100, .042, Z / 100).project(R.camera);
      return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, [X, Z]),
    state: (p, id) => p.evaluate(id => { const R = window.__reader; return R.spreads[R.cur].byId[id].s; }, id),
    tab: (p, id) => p.evaluate(id => { const R = window.__reader; return R.spreads[R.cur].tabs.find(t => t.c.id === id).v; }, id),
    async drag(p, [x0, y0], [x1, y1]) { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, {steps: 12}); await p.mouse.up(); },
    async circle(p, [cx, cy], r, turns) { await p.mouse.move(cx + r, cy); await p.mouse.down(); const n = Math.round(36 * Math.abs(turns));
      for (let i = 1; i <= n; i++) { const a = Math.sign(turns) * i / 36 * 2 * Math.PI; await p.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a)); } await p.mouse.up(); },
    noErrors(p) { t.check(p.errors.length === 0, `no page errors${p.errors.length ? ': ' + p.errors.slice(0, 3).join(' | ') : ''}`); },
    // compare a screenshot with tests/baseline/<name>.png: fails when more than `max` of the pixels differ by more than
    // `delta` in any channel (software rendering and font fallbacks differ a little between machines)
    async matches(p, name, {max = .04, delta = 48, clip} = {}) {
      const buf = await p.screenshot({clip}), file = path.join(ROOT, 'tests/baseline', `${name}.png`);
      if (update) { await import('node:fs/promises').then(fs => fs.writeFile(file, buf)); log(`  ↺ baseline ${name}.png recorded`); return; }
      let base; try { base = await readFile(file); } catch { throw new Fail(`no baseline for ${name} (run npm run test:update)`); }
      const cmp = await browser.newPage();
      const r = await cmp.evaluate(async ([a, b, delta]) => {
        const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
        const [A, B] = await Promise.all([load(a), load(b)]);
        if (A.width !== B.width || A.height !== B.height) return {size: `${A.width}×${A.height} vs ${B.width}×${B.height}`};
        const c = document.createElement('canvas'); c.width = A.width; c.height = A.height; const x = c.getContext('2d', {willReadFrequently: true});
        x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, c.width, c.height); x.drawImage(B, 0, 0); const db = x.getImageData(0, 0, c.width, c.height);
        const out = x.createImageData(c.width, c.height); let n = 0;
        for (let i = 0; i < da.data.length; i += 4) {
          const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
          const bad = d > delta; if (bad) n++;
          out.data[i] = bad ? 255 : da.data[i] * .3; out.data[i + 1] = bad ? 0 : da.data[i + 1] * .3; out.data[i + 2] = bad ? 60 : da.data[i + 2] * .3; out.data[i + 3] = 255;
        }
        x.putImageData(out, 0, 0);
        return {frac: n / (da.data.length / 4), diff: c.toDataURL('image/png')};
      }, [`data:image/png;base64,${buf.toString('base64')}`, `data:image/png;base64,${base.toString('base64')}`, delta]);
      await cmp.close();
      const fs = await import('node:fs/promises');
      if (r.size) { await fs.writeFile(path.join(ROOT, 'tests/output', `${name}.png`), buf); throw new Fail(`${name}: size changed (${r.size})`); }
      if (r.frac > max) {
        await fs.writeFile(path.join(ROOT, 'tests/output', `${name}.png`), buf);
        await fs.writeFile(path.join(ROOT, 'tests/output', `${name}.diff.png`), Buffer.from(r.diff.split(',')[1], 'base64'));
        throw new Fail(`${name}: ${(r.frac * 100).toFixed(1)}% of pixels differ from the baseline (limit ${max * 100}%); see tests/output/`);
      }
      log(`  ✓ ${name} matches its baseline (${(r.frac * 100).toFixed(2)}% different)`);
    },
    async close() { for (const p of pages) await p.context().close().catch(() => {}); pages.length = 0; },
  };
  return t;
}

/* ---------- run ---------- */
const specs = (await readdir(path.join(ROOT, 'tests/specs'))).filter(f => f.endsWith('.mjs')).sort()
  .filter(f => !only.length || only.some(w => f.includes(w)));
const results = [];
for (const f of specs) {
  const lines = [], log = s => { lines.push(s); console.log(s); }, t = helpers(log), t0 = Date.now();
  console.log(`\n● ${f}`);
  try { await (await import(pathToFileURL(path.join(ROOT, 'tests/specs', f)))).default(t); results.push([f, true]); }
  catch (e) { console.log(`  ✗ ${e instanceof Fail ? e.message : e.stack || e}`); results.push([f, false]); }
  await t.close();
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close(); server.close();
const failed = results.filter(r => !r[1]);
console.log(`\n${results.length - failed.length} / ${results.length} specs passed${failed.length ? ` — failed: ${failed.map(r => r[0]).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
