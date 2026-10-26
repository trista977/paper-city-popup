// 本页介绍 → 保存这一页 makes a 1080 × 1440 (2×) share card.
export default async t => {
  const p = await t.book(); await t.open(p); await t.go(p, 2, 2500);
  await p.click('#story'); await p.waitForTimeout(400);
  const [dl] = await Promise.all([p.waitForEvent('download', {timeout: 120000}), p.click('#savePage')]);
  t.check(dl.suggestedFilename() === 'memory-in-london-2.png', `the card downloads as ${dl.suggestedFilename()}`);
  const file = await dl.path(), {readFile} = await import('node:fs/promises'), b = await readFile(file);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  t.check(w === 2160 && h === 2880, `the card is ${w} × ${h}`);
  t.noErrors(p);
};
