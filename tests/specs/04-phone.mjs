// A phone in portrait: page corners turn pages, the bottom bar fits on one line, double-tap zooms in and out, dragging
// sideways moves along the book.
export default async t => {
  const p = await t.book({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 1});
  await p.tap('#openBook'); await t.settled(p, 0);
  await p.waitForFunction(() => window.__reader.spreads[1].built, null, {timeout: 300000}); await p.waitForTimeout(2500);
  const corner = async X => { const [x, y] = await t.pagePoint(p, X, 62); return [Math.min(385, Math.max(5, x)), y]; };
  // in portrait the book is wider than the screen: drag over to a corner first
  const toEdge = async dir => { await p.mouse.move(195 - dir * 120, 230); await p.mouse.down();
    for (let k = 1; k <= 10; k++) { await p.mouse.move(195 - dir * 120 + dir * 24 * k, 230); await p.waitForTimeout(40); } await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(2500); };
  await toEdge(-1); await toEdge(-1);
  { const [x, y] = await corner(96); await p.touchscreen.tap(x, y); await t.settled(p, 1); t.check(true, 'tapping the bottom-right corner turns to the next page'); }
  await p.waitForTimeout(1500); await toEdge(1); await toEdge(1);
  { const [x, y] = await corner(-96); await p.touchscreen.tap(x, y); await t.settled(p, 0); t.check(true, 'tapping the bottom-left corner turns back'); }
  await t.go(p, 4);
  const bar = await p.evaluate(() => { const e = document.getElementById('nowSub'); return {text: e.innerText, h: e.getBoundingClientRect().height}; });
  t.check(!bar.text.includes('站') && bar.h < 30, `the bottom bar shows time · place on one line ("${bar.text}")`);
  const r0 = await p.evaluate(() => window.__reader.camera.position.y);
  // double-taps land on bare pavement (a tap on a piece works that piece instead)
  const camY = () => p.evaluate(() => window.__reader.camera.position.y);
  // the two taps are sent from inside the page, 120 ms apart: under software rendering each Playwright tap waits for a
  // frame, which can push the second one past the double-tap window
  const dbl = async () => { const [x, y] = await t.pagePoint(p, 42, 54);
    await p.evaluate(async ([x, y]) => { const c = document.getElementById('scene'), o = {clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true};
      const tap = () => { c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); };
      tap(); await new Promise(r => setTimeout(r, 120)); tap(); }, [x, y]);
    await p.waitForTimeout(2500); };
  await dbl();
  const r1 = await camY();
  t.check(r1 < r0 * .85, 'double-tap zooms in on a page');
  await dbl();
  t.check(Math.abs(await camY() - r0) < r0 * .05, 'double-tap again steps back');
  // portrait: dragging sideways moves the view along the book and it stays there (no snapping back); it stops at the
  // book's edge; a page turn starts from the middle again
  const drag = async (x0, x1) => { await p.mouse.move(x0, 230); await p.mouse.down();
    for (let k = 1; k <= 10; k++) { await p.mouse.move(x0 + (x1 - x0) * k / 10, 230); await p.waitForTimeout(40); }
    await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(2500); };
  const camX = () => p.evaluate(() => window.__reader.camera.position.x);
  await t.go(p, 2); await p.waitForTimeout(2000);
  await drag(120, 260); const xl = await camX();
  t.check(xl < -.15, `dragging right brings the left page into view (camera x ${xl.toFixed(2)})`);
  await p.waitForTimeout(1500);
  t.check(Math.abs(await camX() - xl) < .02, 'the view stays where it was left');
  await drag(330, 30); await drag(330, 30); const xr = await camX();
  t.check(xr > .15 && xr < .6, `dragging left brings the right page into view and stops at the edge (camera x ${xr.toFixed(2)})`);
  await t.go(p, 3, 3500);
  const x3 = await camX(); t.check(Math.abs(x3) < .05, `a page turn starts from the middle of the book (camera x ${x3.toFixed(2)})`);
  // the desk: each stop's travel thing lies in front of the book and says what it is when tapped
  { const [x, y] = await t.pagePoint(p, -24, 90); await p.touchscreen.tap(x, y); await p.waitForTimeout(600);
    const note = await p.evaluate(() => document.getElementById('noteLayer').innerText);
    t.check(note.includes('票根'), `tapping the ticket stub on the desk says what it is ("${note}")`); }
  t.noErrors(p);
};
