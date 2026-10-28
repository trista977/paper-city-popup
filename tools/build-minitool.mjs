#!/usr/bin/env node
/* Build Memory in London as a Xiaohongshu mini tool: an offline zip with index.html at its root.
     node tools/build-minitool.mjs          → dist/minitool/ and dist/memory-in-london-minitool.zip
   The reader (minitool/app.js → books/*, vendor/three) is bundled by esbuild into one classic script, lowered to
   ES2017 / Chrome 61; the two photos memory-london.js fetches at load time, and the share cover's grid still, are
   inlined as data URLs instead (the container has no network, and a classic script can't wait at the top level). index.html, style.css and the font
   subset are copied as they are. The zip is made from inside dist/minitool, so index.html sits at its root. */
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {cp, mkdir, readFile, rm, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist/minitool'), ZIP = path.join(ROOT, 'dist/memory-in-london-minitool.zip');

// memory-london.js loads its photos with fetch + top-level await; here they become constants
const inlinePhotos = {
  name: 'inline-photos',
  setup(b) {
    b.onLoad({filter: /books[\\/]memory-london\.js$/}, async args => {
      let src = await readFile(args.path, 'utf8');
      const load = /const photo = name => fetch\([^\n]*\n(const \[BIGBEN_PHOTO, EYE_PHOTO\]) = await Promise\.all\(\[photo\('([\w.-]+)'\), photo\('([\w.-]+)'\)\]\);/;
      const m = src.match(load);
      if (!m) throw new Error('memory-london.js: the photo loader changed; update tools/build-minitool.mjs');
      const url = async f => `data:image/jpeg;base64,${(await readFile(path.join(ROOT, 'books/assets', f))).toString('base64')}`;
      src = src.replace(load, `${m[1]} = ${JSON.stringify([await url(m[2]), await url(m[3])])};`);
      return {contents: src, loader: 'js'};
    });
    // the share cover's grid still (books/share-card.js) becomes a data URL too
    b.onLoad({filter: /books[\\/]share-card\.js$/}, async args => {
      let src = await readFile(args.path, 'utf8');
      const load = /const GRID = new URL\('\.\/assets\/([\w.-]+)', import\.meta\.url\)\.href;/, m = src.match(load);
      if (!m) throw new Error('share-card.js: the grid still loader changed; update tools/build-minitool.mjs');
      src = src.replace(load, `const GRID = ${JSON.stringify(`data:image/jpeg;base64,${(await readFile(path.join(ROOT, 'books/assets', m[1]))).toString('base64')}`)};`);
      return {contents: src, loader: 'js'};
    });
  },
};

await rm(OUT, {recursive: true, force: true}); await rm(ZIP, {force: true});
await mkdir(OUT, {recursive: true});
await build({
  entryPoints: [path.join(ROOT, 'minitool/app.js')], outfile: path.join(OUT, 'main.js'),
  bundle: true, format: 'iife', target: ['es2017', 'chrome61'], minify: true, legalComments: 'inline',
  alias: {three: path.join(ROOT, 'vendor/three/three.module.min.js')}, plugins: [inlinePhotos], logLevel: 'warning',
});
for (const f of ['index.html', 'style.css']) await cp(path.join(ROOT, 'minitool', f), path.join(OUT, f));
await mkdir(path.join(OUT, 'fonts'));
for (const s of ['400', '600', '400i', '600i']) await cp(path.join(ROOT, `minitool/fonts/cormorant-${s}.woff2`), path.join(OUT, `fonts/cormorant-${s}.woff2`));

execFileSync('zip', ['-r', '-X', '-q', ZIP, '.', '-x', '*.DS_Store'], {cwd: OUT});
const kb = async f => ((await stat(f)).size / 1024).toFixed(0) + ' KiB';
console.log(`dist/minitool/main.js ${await kb(path.join(OUT, 'main.js'))}`);
console.log(`dist/memory-in-london-minitool.zip ${await kb(ZIP)}`);
