// Only the open spread and its neighbours stay in memory; phones use smaller textures.
export default async t => {
  const p = await t.book({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  await p.tap('#openBook'); await t.settled(p, 0);
  let peak = 0;
  for (const k of [1, 2, 3, 4]) { await t.go(p, k, 500); await p.waitForFunction(k => window.__reader.spreads.filter(s => s.built).length <= 3, k);
    peak = Math.max(peak, (await p.evaluate(() => window.__reader.memory())).textureMB); }
  const built = await p.evaluate(() => window.__reader.spreads.map(s => s.built ? 1 : 0).join(''));
  t.check(built.startsWith('00'), `after reading to the end, the first spreads are freed (${built})`);
  t.check(peak < 140, `phone texture memory stays low (peak ${peak} MB)`);
  await t.go(p, 0, 500);
  t.check(await p.evaluate(() => window.__reader.spreads[0].built), 'going back rebuilds a freed spread');
  t.noErrors(p);
};
