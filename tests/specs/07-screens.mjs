// Every spread from a fixed camera, compared with tests/baseline/. Hints are off and everything has settled.
export default async t => {
  const p = await t.book({viewport: {width: 960, height: 600}});
  await t.open(p);
  for (const k of [0, 1, 2, 3, 4]) {
    if (k) await t.go(p, k, 500);
    await p.evaluate(() => { const R = window.__reader; R.spreads[R.cur].stopHints(); R.setView({az: 0, pol: 50, r: 1.0, target: [0, .1, .02]}); });
    await p.waitForTimeout(4000);
    await t.matches(p, `spread-${k}`);
  }
  t.noErrors(p);
};
