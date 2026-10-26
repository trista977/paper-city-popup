// Paper engineering: every piece folds flat inside the closed book, stays on its page, is attached to something, makes
// only movements card can make, and no two pieces pass through each other as the book closes. docs/structure.md must
// match the book.
import {execFileSync} from 'node:child_process';
export default async t => {
  const p = await t.book();
  const r = await p.evaluate(async () => {
    const {paperCheck, structureReport} = await import('./books/paper-check.js');
    const {MEMORY_LONDON} = await import('./books/memory-london.js');
    const a = paperCheck(MEMORY_LONDON), b = structureReport(MEMORY_LONDON);
    return {n: a.length, bad: a.filter(x => x.issues.length).map(x => `${x.spread}/${x.id}: ${x.issues.join('; ')}`),
      cross: b.filter(x => x.issues.length).map(x => `${x.spread}/${x.id}: ${x.issues.join('; ')}`)};
  });
  t.check(r.bad.length === 0, `paper check: ${r.n} pieces, ${r.bad.length} with issues ${r.bad.slice(0, 5).join(' | ')}`);
  t.check(r.cross.length === 0, `closing the book: no pieces pass through each other ${r.cross.slice(0, 5).join(' | ')}`);
  let out = '', ok = true;
  try { out = execFileSync(process.execPath, ['tools/structure-report.mjs', '--check'], {cwd: t.ROOT, encoding: 'utf8', env: process.env}); }
  catch (e) { ok = false; out = (e.stdout || '') + (e.stderr || ''); }
  t.check(ok, out.trim().split('\n').pop());
};
