// The meeting message stays close to the speakers rather than the centre of the screen.
export default async t => {
  const p = await t.book(); await t.open(p); await t.go(p, 3);
  const [x, y] = await t.at(p, 'me'); await t.drag(p, [x, y], [x + 200, y]);
  // the bubble shows for 3 s: check it as soon as it is up (software rendering makes the drag itself slow)
  await p.waitForSelector('.note.dialogue', {timeout: 60000}); await p.waitForTimeout(300);
  const bubble = await p.locator('.note.dialogue').boundingBox();
  const a = await t.at(p, 'me'), b = await t.at(p, 'friend');
  t.check(bubble && Math.abs(bubble.x + bubble.width / 2 - (a[0] + b[0]) / 2) < 40 && Math.abs(bubble.y + bubble.height - (a[1] + b[1]) / 2) < 75, 'West End: the meeting bubble stays beside both speakers');
  await p.screenshot({path: t.ROOT + '/tests/output/meeting-dialogue.png'});
  t.noErrors(p);
};
