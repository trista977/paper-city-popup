// A phone in portrait: page corners turn pages, the bottom bar fits on one line, double-tap zooms in and out, swiping
// slides between the pages.
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
  // portrait: a sideways swipe slides to a page and settles there; the switch above the bar follows; a page turn shows
  // the whole spread again
  const swipe = async (x0, x1) => { await p.mouse.move(x0, 230); await p.mouse.down();
    for (let k = 1; k <= 8; k++) { await p.mouse.move(x0 + (x1 - x0) * k / 8, 230); await p.waitForTimeout(16); } await p.mouse.up(); await p.waitForTimeout(2500); };
  const pane = () => p.evaluate(() => ({at: window.__reader.paneAt, on: document.querySelector('#panes [aria-pressed="true"]').dataset.pane}));
  await t.go(p, 2); await p.waitForTimeout(2000);
  await swipe(300, 120); let s1 = await pane();
  t.check(s1.at === 1 && s1.on === '1', `swiping left shows the right page (${JSON.stringify(s1)})`);
  await swipe(80, 330); await swipe(80, 330); s1 = await pane();
  t.check(s1.at === -1 && s1.on === '-1', `swiping right twice shows the left page (${JSON.stringify(s1)})`);
  await p.tap('#panes [data-pane="0"]'); await p.waitForTimeout(1500);
  t.check((await pane()).at === 0, 'the 整页 button shows the whole spread');
  await p.tap('#panes [data-pane="1"]'); await p.waitForTimeout(1500); await t.go(p, 3);
  t.check((await pane()).at === 0, 'a page turn goes back to the whole spread');
  t.noErrors(p);
};
