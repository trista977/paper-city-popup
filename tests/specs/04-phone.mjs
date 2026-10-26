// A phone in portrait: page corners turn pages, the bottom bar fits on one line, double-tap zooms in and out.
export default async t => {
  const p = await t.book({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 1});
  await p.tap('#openBook'); await t.settled(p, 0);
  await p.waitForFunction(() => window.__reader.spreads[1].built, null, {timeout: 300000}); await p.waitForTimeout(2500);
  const corner = async X => { const [x, y] = await t.pagePoint(p, X, 62); return [Math.min(385, Math.max(5, x)), y]; };
  { const [x, y] = await corner(96); await p.touchscreen.tap(x, y); await t.settled(p, 1); t.check(true, 'tapping the bottom-right corner turns to the next page'); }
  await p.waitForTimeout(1500);
  { const [x, y] = await corner(-96); await p.touchscreen.tap(x, y); await t.settled(p, 0); t.check(true, 'tapping the bottom-left corner turns back'); }
  await t.go(p, 4);
  const bar = await p.evaluate(() => { const e = document.getElementById('nowSub'); return {text: e.innerText, h: e.getBoundingClientRect().height}; });
  t.check(!bar.text.includes('站') && bar.h < 30, `the bottom bar shows time · place on one line ("${bar.text}")`);
  const r0 = await p.evaluate(() => window.__reader.camera.position.length());
  // double-taps land on bare pavement (a tap on a piece works that piece instead)
  const dbl = async () => { const [x, y] = await t.pagePoint(p, 42, 54); await p.touchscreen.tap(x, y); await p.waitForTimeout(120); await p.touchscreen.tap(x, y); await p.waitForTimeout(2500); };
  await dbl();
  const r1 = await p.evaluate(() => window.__reader.camera.position.length());
  t.check(r1 < r0 * .85, 'double-tap zooms in on a page');
  await dbl();
  t.check(Math.abs(await p.evaluate(() => window.__reader.camera.position.length()) - r0) < r0 * .05, 'double-tap again steps back');
  t.noErrors(p);
};
