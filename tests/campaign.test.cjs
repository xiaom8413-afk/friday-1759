const test=require('node:test');
const assert=require('node:assert/strict');
const {Game,LEVELS,TYPES,findPath,ENTRY,EXIT,key,distance}=require('../engine.js');
const advance=(g,s)=>{for(let i=0;i<s*60;i++)g.update(1/60);};

test('six distinct maps provide 48 waves, connected terrain and finite navigation',()=>{
 assert.equal(LEVELS.length,6);assert.equal(LEVELS.reduce((n,l)=>n+l.waves,0),48);
 const maps=new Set();for(const l of LEVELS){const g=new Game(l.id);maps.add(JSON.stringify(l.rocks));assert.ok(findPath(ENTRY,EXIT,g.blocked));assert.equal(g.maxWaves,l.waves);for(const e of g.route)assert.ok(!g.blocked.has(key(e.x,e.y)));}
 assert.equal(maps.size,6);assert.ok(new Game('archive').route.length>new Game('intern').route.length);
 const g=new Game('weekend');assert.deepEqual(Array.from({length:12},(_,i)=>i+1).filter(w=>g.waveTypes(w).includes('boss')),[5,10,12]);
});

test('coffee buffs only nearby attackers, takes the strongest aura and never stacks',()=>{
 const g=new Game('intern');g.money=10000;
 const pot=g.build(7,5,'pot').tower;const base=g.statsFor(pot).interval;
 const coffee=g.build(7,4,'coffee').tower;assert.equal(g.statsFor(pot).boost,1.25);assert.ok(g.statsFor(pot).interval<base);
 const second=g.build(6,4,'coffee').tower;assert.equal(g.statsFor(pot).boost,1.25);
 g.upgrade(second.id);g.upgrade(second.id);assert.equal(g.statsFor(pot).boost,1.45);
 const far=g.build(15,5,'pot').tower;assert.equal(g.statsFor(far).boost,1);
 g.sell(second.id);assert.equal(g.statsFor(pot).boost,1.25);g.sell(coffee.id);assert.equal(g.statsFor(pot).interval,base);
});

test('coffee stations support the office without creating zero-damage projectiles',()=>{
 const g=new Game('intern');g.build(2,4,'coffee');g.startWave();advance(g,3);
 assert.equal(g.stats.shots,0);assert.equal(g.projectiles.length,0);
});

test('network outage freezes existing bosses as well as workers, then expires',()=>{
 const g=new Game('intern');assert.equal(g.freeze().ok,false);g.state='wave';g.wave=1;g.spawnTimer=999;
 const worker=g.spawn('normal'),boss=g.spawn('boss');assert.ok(g.freeze().ok);assert.equal(g.freeze().ok,false);
 advance(g,2);assert.equal(worker.x,0);assert.equal(boss.x,0);
 const newcomer=g.spawn('fast');advance(g,.2);assert.ok(newcomer.x>0);
 advance(g,1);assert.ok(worker.x>0);assert.ok(boss.x>0);assert.equal(g.stats.freezes,1);
});

test('special terrain changes travel speed exactly as advertised',()=>{
 const g=new Game('pantry');g.wave=1;const e=g.spawn('normal');e.x=8;e.y=5;e.cell={x:8,y:5};e.path=[{x:9,y:5}];g.move(e,.1);assert.ok(Math.abs(e.x-8-e.speed*.1*1.3)<1e-10);
 const h=new Game('archive');h.wave=1;const f=h.spawn('normal');f.x=6;f.y=7;f.cell={x:6,y:7};f.path=[{x:7,y:7}];h.move(f,.1);assert.ok(Math.abs(f.x-6-f.speed*.1*.75)<1e-10);
});

test('rooftop detours pay more and cause earlier rage',()=>{
 const g=new Game('rooftop');g.wave=1;const e=g.spawn('normal');e.steps=21;e.paid=3;e.x=2;e.y=5;e.cell={x:2,y:5};e.path=[{x:3,y:5},{x:4,y:5}];g.move(e,1/e.speed);g.move(e,.01);assert.equal(e.rage,true);
 const fresh=g.spawn('normal');fresh.path=Array.from({length:20},(_,i)=>({x:0,y:i%2===0?6:5}));for(let i=0;i<20;i++)g.move(fresh,1/fresh.speed);assert.equal(g.income,12);
});

test('checkpoint round-trip preserves economy, towers, stats and legal routes',()=>{
 const g=new Game('pantry');const t=g.build(7,5,'pot').tower;g.upgrade(t.id);g.build(8,4,'coffee');g.wave=2;g.lives=15;g.income=18;g.stats.cakes=3;
 const snapshot=JSON.parse(JSON.stringify(g.snapshot()));const restored=Game.restore(snapshot);
 assert.ok(restored);for(const k of ['money','wave','lives','income','kills'])assert.equal(restored[k],g[k]);assert.deepEqual(restored.stats,g.stats);
 assert.equal(restored.towers.length,2);assert.equal(restored.towers[0].level,2);assert.equal(restored.towers[0].spent,g.towers[0].spent);assert.ok(restored.route);
 const before=restored.money;restored.sell(restored.towers[0].id);assert.equal(restored.money,before+Math.floor(g.towers[0].spent*.7));
 g.startWave();assert.equal(g.snapshot(),null);
});

test('corrupt or incompatible checkpoints cannot break startup or create invalid towers',()=>{
 assert.equal(Game.restore(null),null);assert.equal(Game.restore({version:1}),null);
 const g=new Game('intern');g.build(7,5,'pot');const saved=g.snapshot();
 for(const bad of [{...saved,money:Infinity},{...saved,level:'unknown'},{...saved,lives:0},{...saved,wave:99},{...saved,towers:[{...saved.towers[0],type:'malicious'}]},{...saved,towers:[saved.towers[0],saved.towers[0]]},{...saved,towers:[{...saved.towers[0],x:0}]}])assert.equal(Game.restore(bad),null);
});

// This reference strategy uses normal build/upgrade APIs and the real budget.
// It places along the current path and values coffee coverage without any stat overrides.
function placeStrategically(g,type){
 let best=null;
 for(let x=1;x<19;x++)for(let y=0;y<12;y++){
  if(g.route.some(p=>p.x===x&&p.y===y)||!g.buildCheck(x,y,type).ok)continue;
  let score=0;
  if(type==='coffee'){for(const t of g.towers)if(t.type!=='coffee'&&distance(t,{x,y})<=2.5&&g.statsFor(t).boost===1)score+=TYPES[t.type].damage/TYPES[t.type].interval;}
  else for(const p of g.route){const d=distance(p,{x,y});if(d<TYPES[type].range){let coverage=0;for(const t of g.towers)if(t.type!=='coffee'&&distance(t,p)<g.statsFor(t).range)coverage++;score+=(1-d/TYPES[type].range*.3)/(1+coverage*.8);}}
  if(!best||score>best.score)best={x,y,score};
 }
 return best&&g.build(best.x,best.y,type).ok;
}
for(const level of LEVELS)test(`${level.name}: all ${level.waves} waves are winnable on a real budget`,()=>{
 const g=new Game(level.id);let cursor=0;const order=['pot','pot','bubble','reply','reply','coffee','pot','reply','bubble','pot','reply','coffee','reply','pot','reply','pot','coffee','reply'];
 for(let w=1;w<=level.waves;w++){
  while(cursor<order.length&&g.money>=TYPES[order[cursor]].cost){assert.ok(placeStrategically(g,order[cursor]));cursor++;}
  for(const t of g.towers)while(t.level<3&&g.money>=g.upgradeCost(t))assert.ok(g.upgrade(t.id).ok);
  if(g.pendingPerks.length)assert.ok(g.choosePerk(g.pendingPerks[0]).ok);
  assert.ok(g.startWave());
  for(let i=0;i<60*180&&g.state==='wave';i++){if(i>300&&i%900===0)g.placeCake(3,10);if(i>700&&i%1000===0)g.freeze();g.update(1/60);}
  assert.ok(g.lives>0,`wave ${w} survives`);assert.ok(g.money>=0);assert.equal(g.wave,w);
 }
 assert.equal(g.state,'won');assert.equal(g.wave,level.waves);
});
