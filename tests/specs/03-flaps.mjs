// The small mechanisms in the lower-right corners and the title page's card file.
export default async t => {
  const p = await t.book(); await t.open(p);
  const flipped = () => p.evaluate(() => ['lid', 'card0', 'card1', 'card2', 'card3'].map(i => window.__reader.spreads[0].byId[i].s.opened ? 1 : 0).join(''));
  await p.evaluate(() => window.__reader.pull('file', 1)); await p.waitForTimeout(3000);
  for (const id of ['lid', 'card0', 'card1', 'card2', 'card3']) { const [x, y] = await t.at(p, id); await p.mouse.click(x, y); await p.waitForTimeout(1600); }
  t.check(await flipped() === '11111', 'title page: the lid and four cards flip forward one by one');
  { const [x, y] = await t.at(p, 'card3'); await p.mouse.click(x, y); await p.waitForTimeout(1200); }
  t.check(await flipped() === '11110', 'title page: tapping a flipped card puts it back');
  await t.go(p, 1);
  // each tap turns the top unturned leaf (tapping a turned one would turn it back)
  for (let k = 0; k < 3; k++) { const [x, y] = await t.at(p, `leaf${k}`); await p.mouse.click(x + 20, y); await p.waitForTimeout(1500); }
  t.check(await p.evaluate(() => [0, 1, 2].every(k => window.__reader.spreads[1].byId['leaf' + k].s.opened)), 'museum: the booklet pages turn');
  await t.go(p, 2);
  { const [x, y] = await t.at(p, 'cam'); await p.mouse.click(x, y); await p.waitForTimeout(2200);
    t.check((await t.state(p, 'photo')).opened, 'Westminster: corner camera prints a photo');
    await p.mouse.click(x, y); await p.waitForTimeout(1800);
    t.check(!(await t.state(p, 'photo')).opened, 'Westminster: corner camera retracts the photo');
    t.check(await p.evaluate(() => !window.__reader.spreads[2].byId.postcard), 'Westminster: postcard removed'); }
  await t.go(p, 3);
  { const [x, y] = await t.at(p, 'env'); await p.mouse.click(x, y); await p.waitForTimeout(2500);
    const f = await t.state(p, 'envFlap'), k = await t.state(p, 'tix'); t.check(f.open > .99 && k.Z < 50, `West End: the envelope flap opens and the ticket slides out (flap ${f.open.toFixed(2)}, ticket Z ${k.Z.toFixed(1)})`); }
  await t.go(p, 4);
  { const [x, y] = await t.at(p, 'factsCover'); await p.mouse.click(x, y); await p.waitForTimeout(2000); t.check((await t.state(p, 'facts')).target === 90, 'Tower Bridge: the fact wheel turns a quarter');
    for (const target of [180, 270, 360]) { const xy = await t.at(p, 'factsKnob'); await p.mouse.click(...xy); await p.waitForTimeout(1500); t.check((await t.state(p, 'facts')).target === target, `Tower Bridge: knob advances to ${target} degrees`); }
    await p.waitForFunction(() => { const s = window.__reader.spreads[4].byId.facts.s; return Math.abs(s.ang - s.target) < .5; }, null, {timeout: 30000});
    await t.circle(p, await t.at(p, 'factsKnob'), 9, .3); await p.waitForTimeout(1500);
    t.check((await t.state(p, 'facts')).target > 360, 'Tower Bridge: dragging the knob turns the fact wheel'); }
  // turning the page with things out folds them away first
  await p.evaluate(() => window.__reader.pull('open', .6)); await p.waitForTimeout(500);
  await t.go(p, 3, 300);
  t.check(await p.evaluate(() => !window.__reader.spreads[4].built || window.__reader.spreads[4].tabs[0].v === 0), 'turning the page puts the Tower Bridge winch back first');
  // 回到封面 closes the book straight from the open page, without leafing back through the others
  const seen = new Set([await p.evaluate(() => window.__reader.cur)]);
  await p.click('#closeBook');
  while (true) { const [c, busy] = await p.evaluate(() => [window.__reader.cur, window.__reader.busy]); seen.add(c); if (c === -1 && !busy) break; await p.waitForTimeout(100); }
  t.check([...seen].join(',') === '3,-1', `回到封面 closes straight from the open page (pages seen: ${[...seen].join(', ')})`);
  t.noErrors(p);
};
