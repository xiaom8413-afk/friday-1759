const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, findPath, ENTRY, EXIT, COLS, ROWS, key } = require('../engine.js');

function advance(g, seconds) { for (let i = 0; i < seconds * 60; i++) g.update(1 / 60); }
function funded() { const g = new Game(); g.money = 100000; return g; }

test('A* finds a shortest orthogonal path, including start=goal and unreachable targets', () => {
  const blocked = new Set([key(1, 5)]);
  const p = findPath(ENTRY, EXIT, blocked);
  assert.equal(p.length - 1, 21);
  for (let i = 1; i < p.length; i++) assert.equal(Math.abs(p[i].x - p[i - 1].x) + Math.abs(p[i].y - p[i - 1].y), 1);
  assert.deepEqual(findPath(ENTRY, ENTRY, new Set()), [ENTRY]);
  for (let y = 0; y < ROWS; y++) blocked.add(key(10, y));
  assert.equal(findPath(ENTRY, EXIT, blocked), null);
});

test('blocked placements are transactional and a full wall is rejected', () => {
  const g = funded();
  assert.equal(g.build(-1, 3, 'pot').ok, false);
  assert.equal(g.build(2, 2, 'missing').ok, false);
  for (let y = 0; y < ROWS - 1; y++) assert.equal(g.build(9, y, 'pot').ok, true);
  const before = g.money;
  assert.equal(g.build(9, ROWS - 1, 'pot').ok, false);
  assert.equal(g.money, before); assert.equal(g.towers.length, ROWS - 1);
  assert.ok(g.route.length > 20);
  assert.equal(g.build(9, 3, 'pot').ok, false);
});

test('upgrade and sale preserve budget, cap levels and recalculate paths', () => {
  const g = new Game(), built = g.build(9, 5, 'pot');
  assert.ok(built.ok); assert.equal(g.money, 140); assert.equal(g.route.length, 22);
  assert.ok(g.upgrade(built.tower.id).ok); assert.ok(g.upgrade(built.tower.id).ok);
  assert.equal(g.upgrade(built.tower.id).ok, false);
  const expected = g.money + Math.floor(built.tower.spent * .7);
  assert.ok(g.sell(built.tower.id)); assert.equal(g.money, expected); assert.equal(g.route.length, 20);
  assert.equal(g.sell(built.tower.id), false);
});

test('cake reroutes enemies, expires correctly and cannot be spammed', () => {
  const g = new Game();
  assert.equal(g.placeCake(4, 10).ok, false); g.startWave(); advance(g, 1);
  const e = g.enemies[0], before = { x: e.x, y: e.y };
  assert.ok(g.placeCake(4, 10).ok);
  assert.equal(e.x, before.x); assert.equal(e.y, before.y);
  assert.ok(e.path.some(p => p.x === 4 && p.y === 10));
  assert.equal(g.placeCake(8, 8).ok, false);
  advance(g, 8.1); assert.equal(g.cake, null);
  for (const enemy of g.enemies) assert.deepEqual(enemy.path.at(-1), EXIT);
});

test('building cannot occupy moving enemies or their active segment', () => {
  const g = funded(); g.startWave(); advance(g, 1.4);
  const e = g.enemies[0], next = e.path[0];
  assert.equal(g.build(next.x, next.y, 'pot').ok, false);
  assert.equal(g.build(e.cell.x, e.cell.y, 'pot').ok, false);
  const x = e.x, y = e.y;
  assert.ok(g.build(12, 5, 'pot').ok);
  assert.equal(e.x, x); assert.equal(e.y, y);
  assert.ok(e.path.every(p => !g.blocked.has(key(p.x, p.y))));
});

test('detour income has a per-enemy cap and straight traversal pays nothing', () => {
  const g = new Game(); g.wave = 1;
  const straight = g.spawn('normal');
  for (let i = 0; i < 19; i++) g.move(straight, 1 / straight.speed);
  assert.equal(g.income, 0);
  const e = g.spawn('normal');
  e.path = [];
  for (let i = 0; i < 35; i++) e.path.push({ x: 0, y: i % 2 === 0 ? 6 : 5 });
  for (let i = 0; i < 30; i++) g.move(e, 1 / e.speed);
  assert.equal(g.income, 9); assert.equal(e.paid, 3); assert.ok(e.rage);
  e.calmUntil = g.time + 3; g.move(e, .001); assert.equal(e.rage, false);
});

test('damage rewards happen once, armor works and splash replies bypass it', () => {
  const g = new Game(); g.wave = 1; const e = g.spawn('armor'), hp = e.hp;
  g.hit(e, 10); assert.equal(e.hp, hp - 5.5);
  g.hit(e, 10, true); assert.equal(e.hp, hp - 15.5);
  const startMoney = g.money; g.hit(e, 999); g.hit(e, 999);
  assert.equal(g.kills, 1); assert.equal(g.money, startMoney + e.reward);
});

test('meeting enemies stop nearby colleagues, spare bosses, then release the crowd', () => {
  const g = new Game(); g.state = 'wave'; g.wave = 3; g.spawnTimer = 999;
  const meeting = g.spawn('meeting'), worker = g.spawn('normal'), boss = g.spawn('boss');
  meeting.nextMeeting = 0;
  g.update(1 / 60);
  assert.ok(worker.holdUntil > g.time); assert.ok(meeting.holdUntil > g.time);
  assert.equal(worker.x, 0); assert.equal(meeting.x, 0); assert.ok(boss.x > 0);
  advance(g, 2); assert.ok(worker.x > 0); assert.ok(meeting.x > 0);
});

test('an undefended office loses cleanly and never ticks after game over', () => {
  const g = new Game();
  for (let wave = 0; wave < 5 && g.state !== 'lost'; wave++) { g.startWave(); advance(g, 60); }
  assert.equal(g.state, 'lost'); assert.equal(g.lives, 0);
  const time = g.time, money = g.money; advance(g, 10);
  assert.equal(g.time, time); assert.equal(g.money, money);
  assert.equal(g.startWave(), false); assert.equal(g.build(4, 5, 'pot').ok, false);
});

test('all ten wave queues clear, award budgets, and produce exactly one victory', () => {
  const g = funded();
  // Strong defense isolates lifecycle correctness from balance testing.
  for (let x = 2; x < COLS - 1; x += 2) for (const y of [4, 6]) {
    const t = g.build(x, y, x % 4 === 0 ? 'reply' : 'pot').tower;
    g.upgrade(t.id); g.upgrade(t.id);
  }
  for (let w = 1; w <= 10; w++) {
    assert.ok(g.startWave()); assert.equal(g.startWave(), false);
    advance(g, 180);
    assert.equal(g.wave, w); assert.equal(g.state, w === 10 ? 'won' : 'build');
  }
  assert.equal(g.lives, 20); assert.equal(g.pending.length, 0); assert.equal(g.enemies.length, 0);
  assert.equal(g.takeEvents().filter(e => e.type === 'end').length, 1);
  assert.equal(g.startWave(), false);
});

test('random legal edits never disconnect enemies or corrupt the simulation', () => {
  const g = funded(); let seed = 42;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.startWave();
  for (let i = 0; i < 180; i++) {
    const x = 1 + Math.floor(random() * 18), y = Math.floor(random() * 12);
    if (i % 4 === 0 && g.towers.length) g.sell(g.towers[Math.floor(random() * g.towers.length)].id);
    else g.build(x, y, ['pot', 'bubble', 'reply'][i % 3]);
    if (i % 30 === 0) g.placeCake(x, y);
    advance(g, .15);
    assert.ok(findPath(ENTRY, EXIT, g.blocked));
    for (const e of g.enemies) {
      assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
      assert.ok(e.path.length); assert.deepEqual(e.path.at(-1), EXIT);
      assert.ok(e.path.every(p => !g.blocked.has(key(p.x, p.y))));
    }
  }
});

test('a full campaign is winnable with the real starting budget and earned income', () => {
  const g = new Game();
  const plan = [[6,5,'pot'],[10,5,'pot'],[8,6,'bubble'],[7,4,'reply'],[11,4,'pot'],[12,5,'pot'],[13,4,'reply'],[16,5,'pot'],[15,6,'bubble'],[4,5,'pot'],[7,6,'pot'],[9,4,'reply']];
  const { TYPES } = require('../engine.js'); let cursor = 0;
  for (let wave = 1; wave <= 10; wave++) {
    while (cursor < plan.length && g.money >= TYPES[plan[cursor][2]].cost) assert.ok(g.build(...plan[cursor++]).ok);
    for (const t of g.towers) while (t.level < 3 && g.money >= g.upgradeCost(t)) assert.ok(g.upgrade(t.id).ok);
    assert.ok(g.startWave());
    let cake = false;
    for (let i = 0; i < 60 * 160 && g.state === 'wave'; i++) {
      if (!cake && i > 240) cake = g.placeCake(8, 9).ok;
      g.update(1 / 60);
    }
    assert.ok(g.lives > 0, `The office must survive wave ${wave}`);
    assert.ok(g.money >= 0);
  }
  assert.equal(g.state, 'won'); assert.equal(g.wave, 10);
});
