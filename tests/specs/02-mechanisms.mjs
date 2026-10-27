// The signature move on each spread, and the other mechanisms, driven with the mouse the way a reader would.
export default async t => {
  const p = await t.book(); await t.open(p);
  await t.go(p, 1);
  // Hope hangs in the front arch, which is mostly open truss: aim at her spine
  const hope = () => p.evaluate(() => { const R = window.__reader, f = R.spreads[R.cur].byId.whale.parts[1].front;
    const c = f.position.clone().set(.004, .3, 0).applyMatrix4(f.matrixWorld).project(R.camera); return [(c.x + 1) / 2 * innerWidth, (1 - c.y) / 2 * innerHeight]; });
  { const [x, y] = await hope(); await p.mouse.click(x, y); await p.waitForTimeout(1200); t.check(((await t.state(p, 'whale')).flapT || 0) > .3, 'museum: tapping Hope sets her flippers moving'); }
  { const [x, y] = await t.at(p, 'dino'); await p.mouse.click(x, y + 10); await p.waitForTimeout(300); t.check(await t.tab(p, 'dino') > .9, 'museum: tapping the dinosaur stands it up'); }
  await t.go(p, 2);
  { const xy = await t.at(p, 'clockFace'); await t.circle(p, xy, 9, .5); await p.waitForTimeout(800);
    const v = await t.tab(p, 'time'), h = (await t.state(p, 'hourH')).ang; t.check(v > .05 && h > 90, `Westminster: turning the clock face moves the hands (time ${v.toFixed(2)}, hour hand ${h.toFixed(0)}°)`); }
  { const [x, y] = await t.at(p, 'boat'); await t.drag(p, [x, y], [x + 250, y]); await p.waitForTimeout(1200); t.check(await t.tab(p, 'boat') > .2, 'Westminster: the boat can be dragged along the river'); }
  { const [x, y] = await t.at(p, 'cam'); await p.mouse.click(x, y); await p.waitForTimeout(300); t.check((await t.state(p, 'photo')).opened, 'Westminster: the instax prints a photo'); }
  await t.go(p, 3);
  { const [x, y] = await t.at(p, 'bus'); await t.drag(p, [x, y], [x, y + 120]); await p.waitForTimeout(1500);
    const v = await t.tab(p, 'bus'), s = await t.state(p, 'bus'); t.check(v > .5 && Math.abs(s.yaw) > 1, `West End: the bus drives down its slanted lane (track ${v.toFixed(2)}, heading ${s.yaw.toFixed(1)}°)`); }
  { const [x, y] = await t.at(p, 'me'); await t.drag(p, [x, y], [x + 150, y]); await p.waitForTimeout(1500); t.check(await t.tab(p, 'meet') > .9, 'West End: the friends meet'); }
  await t.go(p, 4);
  { const xy = await t.at(p, 'crank'); await t.circle(p, xy, 10, 2.2); await p.waitForTimeout(2500);
    const v = await t.tab(p, 'open'), lit = await p.evaluate(() => window.__reader.spreads[4].litTarget), lift = (await t.state(p, 'basL')).lift;
    t.check(v > .95 && lift > .95 && lit === 1, 'Tower Bridge: the winch opens the bridge, the ship comes through, the lights come on');
    await t.circle(p, xy, 10, -2.2); await p.waitForTimeout(1500);
    t.check(await t.tab(p, 'open') < .05 && await p.evaluate(() => window.__reader.spreads[4].litTarget) === 0, 'Tower Bridge: winding back closes it and puts the lights out'); }
  t.noErrors(p);
};
