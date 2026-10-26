#!/usr/bin/env node
/* Writes docs/structure.md: for every piece of Memory in London, where it folds, what lifts it and where it lies once the
   book is closed (books/paper-check.js → structureReport). Run from the repo root:  node tools/structure-report.mjs
   Needs Playwright with Chromium (the book module loads its photos with fetch, so it runs in a browser). */
import {createServer} from 'node:http';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png'};
const server = createServer(async (req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { if (!p.startsWith(ROOT) || !(await stat(p)).isFile()) throw 0; res.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
let chromium;
try { ({chromium} = createRequire(import.meta.url)('playwright')); } catch { ({chromium} = await import('playwright')); }
const browser = await chromium.launch(), page = await browser.newPage();
await page.goto(`http://localhost:${server.address().port}/index.html`);
const rows = await page.evaluate(async () => {
  const {structureReport, paperCheck} = await import('./books/paper-check.js');
  const {MEMORY_LONDON} = await import('./books/memory-london.js');
  const issues = Object.fromEntries(paperCheck(MEMORY_LONDON).map(r => [`${r.spread}/${r.id}`, r.issues]));
  return structureReport(MEMORY_LONDON).map(r => ({...r, issues: [...r.issues, ...(issues[`${r.spread}/${r.id}`] || [])]}));
});
await browser.close(); server.close();

const TYPE = {stand: '立片', v: 'V 折', box: '箱形折', custom: '活动件', card: '翻盖'};
const esc = s => String(s).replace(/\|/g, '\\|');
let md = `# 《Memory in London》结构清单

每张纸片三件事：**折线在哪里**、**谁带动它展开**、**合书后叠在哪一层**。由 \`tools/structure-report.mjs\` 从书的数据自动生成（\`books/paper-check.js\` 的 \`structureReport\`），改了书之后重新运行即可。

- 坐标：X 横跨两页（书脊 0，页边 ±100），Z 顺着书脊（远边 -65，近边 +65）。
- 层：从页面往上数，1 = 直接贴着纸；数字大的压在上面。附在别的纸片上的件，跟着它的母纸片折平。
- 倒向：面向读者的立片向前倒（朝读者），沿街侧墙向外倒（离开书脊），V 折朝读者合下。

`;
const total = rows.filter(r => r.issues.length).length;
md += `**检查结果：${rows.length} 件，${total ? `${total} 件有问题` : '没有问题'}。**\n\n`;
for (const si of [...new Set(rows.map(r => r.spread))]) {
  const rs = rows.filter(r => r.spread === si);
  md += `## ${si === 0 ? '扉页' : `第 ${si} 页`} · ${rs[0].title}\n\n| 纸片 | 类型 | 折线在哪里 | 谁带动它展开 | 合书后 |\n|---|---|---|---|---|\n`;
  for (const r of rs) md += `| \`${r.id}\` | ${TYPE[r.type] || r.type} | ${esc(r.fold)} | ${esc(r.driver)} | ${esc(r.closed)}${r.issues.length ? ` ⚠️ ${esc(r.issues.join('；'))}` : ''} |\n`;
  md += '\n';
}
await writeFile(path.join(ROOT, 'docs/structure.md'), md);
console.log(`docs/structure.md: ${rows.length} pieces, ${total} with issues`);
for (const r of rows.filter(r => r.issues.length)) console.log(`  p${r.spread} ${r.id}: ${r.issues.join(' | ')}`);
