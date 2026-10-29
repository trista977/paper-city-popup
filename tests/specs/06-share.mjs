// 本页介绍 → 保存这一页 makes a 1080 × 1440 (2×) share card.
export default async t => {
  const p = await t.book(); await t.open(p); await t.go(p, 2, 2500);
  await p.click('#story'); await p.waitForTimeout(400);
  const [dl] = await Promise.all([p.waitForEvent('download', {timeout: 120000}), p.click('#savePage')]);
  t.check(dl.suggestedFilename() === 'memory-in-london-2.png', `the card downloads as ${dl.suggestedFilename()}`);
  const file = await dl.path(), {readFile} = await import('node:fs/promises'), b = await readFile(file);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  t.check(w === 2160 && h === 2880, `the card is ${w} × ${h}`);
  // Review all page cards, including the route and the cover; each uses a different mechanism set.
  const {mkdir, writeFile} = await import('node:fs/promises');
  const out = process.env.SHARE_REVIEW_DIR || `${t.ROOT}/tests/output/share`;
  await mkdir(out, {recursive: true});
  await writeFile(`${out}/memory-in-london-2.png`, b);
  for (const k of [0, 1, 3, 4]) {
    await t.go(p, k, 1000);
    const data = await p.evaluate(async () => (await window.__shareCard()).toDataURL('image/png'));
    await writeFile(`${out}/memory-in-london-${k}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  const cover = await p.evaluate(async () => (await window.__coverCard()).toDataURL('image/png'));
  const cb = Buffer.from(cover.split(',')[1], 'base64');
  t.check(cb.readUInt32BE(16) === 2160 && cb.readUInt32BE(20) === 2522, 'cover exports at 2160 × 2522, cut to its grid');
  await writeFile(`${out}/memory-in-london-cover.png`, cb);
  t.noErrors(p);
};
