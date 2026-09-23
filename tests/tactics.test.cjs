const test=require('node:test');
const assert=require('node:assert/strict');
const {Game,EVOLUTIONS,TYPES}=require('../engine.js');
const advance=(g,s)=>{for(let i=0;i<s*60;i++)g.update(1/60);};
function setup(type,branch){const g=new Game('intern');g.money=10000;const t=g.build(4,4,type).tower;g.upgrade(t.id);g.upgrade(t.id);if(branch)assert.ok(g.evolve(t.id,branch).ok);g.state='wave';g.wave=1;g.pending=['normal'];g.spawnTimer=999;return {g,t};}
function enemy(g,type,x=5,y=4){const e=g.spawn(type);Object.assign(e,{x,y,cell:{x,y},path:[{x:x+1,y}],speed:0,hp:1000,maxHp:1000});return e;}
function fire(g,t){g.update(1/60);t.cooldown=999;advance(g,.35);}

test('evolution is paid once, mutually exclusive, and requires level three',()=>{
 const g=new Game('intern');g.money=1000;const t=g.build(4,4,'pot').tower;assert.equal(g.evolve(t.id,'sniper').ok,false);g.upgrade(t.id);g.upgrade(t.id);const before=g.money;assert.ok(g.evolve(t.id,'sniper').ok);assert.equal(g.money,before-110);assert.equal(g.evolve(t.id,'ricochet').ok,false);assert.equal(g.evolve(t.id,'espresso').ok,false);assert.equal(g.stats.evolutions,1);assert.equal(g.sellValue(t),Math.floor(t.spent*.7));
});

test('perk drafts are deterministic, survive refresh, gate the next wave, and cannot be claimed twice',()=>{
 const a=new Game('intern',{seed:58}),b=new Game('intern',{seed:58});a.wave=b.wave=2;a.offerPerks();b.offerPerks();assert.deepEqual(a.pendingPerks,b.pendingPerks);assert.equal(new Set(a.pendingPerks).size,3);assert.equal(a.startWave(),false);
 const restored=Game.restore(a.snapshot());assert.deepEqual(restored.pendingPerks,a.pendingPerks);const chosen=restored.pendingPerks[0];assert.ok(restored.choosePerk(chosen).ok);assert.equal(restored.choosePerk(chosen).ok,false);restored.offerPerks();assert.ok(!restored.pendingPerks.includes(chosen));
});

test('benefits change mechanics and instant rewards cannot be re-applied by restoring',()=>{
 const g=new Game('intern');g.lives=10;
 for(const id of ['funding','therapy','recycle','cake','wifi','reach','power','haste','detour']){g.pendingPerks=[id];assert.ok(g.choosePerk(id).ok);}
 assert.equal(g.money,300);assert.equal(g.lives,16);assert.equal(g.detourPay(),4);
 const t=g.build(5,4,'pot').tower,s=g.statsFor(t);assert.ok(s.range>TYPES.pot.range);assert.ok(s.damage>TYPES.pot.damage);assert.ok(s.interval<TYPES.pot.interval);assert.equal(g.sellValue(t),Math.floor(45*.9));
 const r=Game.restore(g.snapshot());assert.equal(r.money,g.money);assert.equal(r.lives,g.lives);r.startWave();assert.ok(r.placeCake(2,10).ok);assert.equal(r.cake.expires-r.time,11);assert.equal(r.cakeReady-r.time,18);const e=r.spawn('normal');r.freeze();assert.ok(Math.abs(e.holdUntil-r.time-3.8)<1e-10);
});

test('shield absorption, bypass, and overkill accounting measure only effective damage',()=>{
 const g=new Game('intern');g.wave=1;const e=g.spawn('shield'),hp=e.hp,shield=e.shield;g.hit(e,10,true);assert.equal(e.hp,hp);assert.equal(e.shield,shield-10);g.hit(e,5,true,null,true);assert.equal(e.hp,hp-5);assert.equal(e.shield,shield-10);g.hit(e,99999,true);assert.ok(e.dead);assert.ok(Math.abs(g.stats.damage-(shield+hp))<1e-8);const total=g.stats.damage;g.hit(e,100);assert.equal(g.stats.damage,total);
});

test('healers restore living allies, halve boss healing and cannot resurrect',()=>{
 const {g}=setup('pot');g.towers=[];const healer=enemy(g,'healer'),worker=enemy(g,'normal',6),boss=enemy(g,'boss',6,5),dead=enemy(g,'normal',7);healer.nextHeal=0;worker.hp=boss.hp=500;dead.hp=0;dead.dead=true;g.update(1/60);assert.equal(worker.hp,600);assert.equal(boss.hp,550);assert.equal(dead.hp,0);assert.equal(healer.nextHeal,4+g.time);
});

test('splitter children inherit a legal moving segment, never recursively split or repay detour income',()=>{
 const g=new Game('intern');g.wave=6;const e=enemy(g,'splitter',6,5);e.x=6.4;e.paid=1;e.steps=20;g.hit(e,99999,true);const children=g.enemies.filter(v=>v.mini);assert.equal(children.length,2);for(const child of children){assert.equal(child.x,6.4);assert.deepEqual(child.path,e.path);assert.equal(child.paid,3);assert.equal(child.type,'fast');g.hit(child,99999,true);}assert.equal(g.enemies.filter(v=>v.mini).length,2);assert.equal(g.kills,3);
});

test('tower target priorities select different valid enemies',()=>{
 for(const [mode,expected]of [['exit',0],['strong',1],['near',2],['rage',1]]){const {g,t}=setup('pot');const enemies=[enemy(g,'normal',6,4),enemy(g,'normal',6,5),enemy(g,'normal',5,4)];enemies[0].path=[{x:19,y:5}];enemies[1].hp=2000;enemies[1].maxHp=2000;enemies[1].steps=30;enemies[1].rage=true;enemies[1].path=[{x:7,y:5},{x:8,y:5}];enemies[2].path=[{x:6,y:4},{x:7,y:4},{x:8,y:4}];assert.ok(g.setTarget(t.id,mode));g.update(1/60);assert.equal(g.projectiles[0].target,enemies[expected].id,mode);}
});

test('ricochet hits two additional targets and sniper trades fire rate for damage and reach',()=>{
 const {g,t}=setup('pot','ricochet');const enemies=[enemy(g,'normal',5),enemy(g,'normal',6),enemy(g,'normal',7)];fire(g,t);assert.ok(enemies.every(e=>e.hp<1000));assert.ok(Math.abs((1000-enemies[1].hp)/(1000-enemies[0].hp)-.65)<1e-8);
 const {g:h,t:s}=setup('pot','sniper');const normal=h.statsFor({...s,evolution:null}),special=h.statsFor(s);assert.ok(special.range>normal.range+1.6);assert.ok(Math.abs(special.damage/normal.damage-1.8)<1e-8);assert.ok(special.interval>normal.interval);
});

test('glacier controls enemies and foam creates a real damage amplification window',()=>{
 const {g,t}=setup('bubble','glacier');const e=enemy(g,'normal');fire(g,t);assert.equal(e.slowFactor,.3);assert.ok(e.slowUntil>g.time);assert.ok(e.holdUntil>g.time);
 const {g:h,t:f}=setup('bubble','foam');const target=enemy(h,'normal');fire(h,f);assert.ok(target.vulnerableUntil>h.time);const hp=target.hp;h.hit(target,100,true);assert.equal(hp-target.hp,125);
});

test('viral damage persists with attribution and shredder bypasses intact shields',()=>{
 const {g,t}=setup('reply','viral');const e=enemy(g,'normal');fire(g,t);const hp=e.hp;advance(g,1);assert.ok(e.hp<hp);assert.ok(g.stats.byType.reply.damage>g.statsFor(t).damage);assert.ok(t.damage>0);
 const {g:h,t:s}=setup('reply','shredder');const shield=enemy(h,'shield');shield.shield=shield.maxShield=500;fire(h,s);assert.equal(shield.shield,500);assert.ok(shield.hp<1000);
});

test('espresso expands support and payroll grants money with a two-point healing cap',()=>{
 const g=new Game('intern');g.money=10000;const pot=g.build(6,5,'pot').tower;
 for(const [x,y]of [[7,4],[8,4],[9,4]]){const t=g.build(x,y,'coffee').tower;g.upgrade(t.id);g.upgrade(t.id);g.evolve(t.id,'payroll');}
 const station=g.build(5,4,'coffee').tower;g.upgrade(station.id);g.upgrade(station.id);g.evolve(station.id,'espresso');assert.ok(Math.abs(g.statsFor(pot).boost-1.7)<1e-8);assert.ok(g.statsFor(station).range>3.5);
 g.state='wave';g.wave=1;g.lives=10;g.pending=[];g.spawnTimer=999;const money=g.money;g.update(1/60);assert.equal(g.state,'build');assert.equal(g.money,money+47+3*18);assert.equal(g.lives,12);assert.equal(g.stats.healing,2);
});

test('boss rally triggers once at half health and grants temporary movement haste',()=>{
 const {g}=setup('pot');const boss=enemy(g,'boss'),worker=enemy(g,'normal',6);g.hit(boss,550,true);assert.ok(boss.rallied);assert.equal(worker.hasteUntil,g.time+4);const first=worker.hasteUntil;g.time+=1;g.hit(boss,10,true);assert.equal(worker.hasteUntil,first);
});

test('v3 checkpoints retain branches, targeting and fractional damage while accepting old v2 saves',()=>{
 const g=new Game('intern');g.money=1000;const t=g.build(5,4,'pot').tower;g.upgrade(t.id);g.upgrade(t.id);g.evolve(t.id,'ricochet');g.setTarget(t.id,'strong');g.stats.damage=3.75;g.stats.byType.pot.damage=3.75;t.damage=3.75;
 const saved=g.snapshot(),r=Game.restore(saved);assert.equal(r.towers[0].evolution,'ricochet');assert.equal(r.towers[0].targetMode,'strong');assert.equal(r.towers[0].damage,3.75);assert.equal(r.stats.byType.pot.damage,3.75);
 const old=new Game('intern').snapshot();old.version=2;delete old.perks;delete old.pendingPerks;delete old.seed;assert.ok(Game.restore(old));
 assert.equal(Game.restore({...saved,perks:['not-a-perk']}),null);assert.equal(Game.restore({...saved,towers:[{...saved.towers[0],evolution:'espresso'}]}),null);
});
