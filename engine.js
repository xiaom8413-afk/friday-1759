/* Pure simulation. No browser, network, timer, or rendering dependency. */
(function (root) {
  'use strict';
  const COLS = 20, ROWS = 12;
  const ENTRY = { x: 0, y: 5 }, EXIT = { x: 19, y: 5 };
  const ROCKS = [[5, 2], [5, 3], [5, 8], [5, 9], [14, 2], [14, 3], [14, 8], [14, 9]];
  const TYPES = {
    pot: { name: '甩锅回旋镖', cost: 45, range: 3.1, damage: 18, interval: .82, color: '#278765', desc: '精准甩锅，专治临时需求', tag: '单体' },
    bubble: { name: '摸鱼泡泡机', cost: 60, range: 2.8, damage: 5, interval: 1.15, color: '#328ea8', desc: '群体减速，还能安抚红温', tag: '减速' },
    reply: { name: '已读乱回台', cost: 85, range: 3.35, damage: 19, interval: 1.6, color: '#d17b4e', desc: '范围回复，直接穿透护甲', tag: '群攻' },
    coffee: { name: '咖啡续命站', cost: 75, range: 2.5, damage: 0, interval: 1, color: '#a97937', desc: '附近设备攻击提速 25% 起', tag: '辅助' }
  };
  const EVOLUTIONS = {
    pot: [{id:'ricochet',name:'甩锅接力',cost:95,desc:'每次命中再弹向 2 个附近目标，造成 65% 伤害。',tag:'弹射清场'}, {id:'sniper',name:'责任狙击',cost:110,desc:'射程 +1.7，伤害 +80%，攻击间隔增加 35%。',tag:'远程点杀'}],
    bubble: [{id:'glacier',name:'冰镇摸鱼',cost:90,desc:'减速提高到 70%，并短暂冰住非领导工单。',tag:'强力控制'}, {id:'foam',name:'情绪按摩',cost:95,desc:'泡泡范围扩大；被安抚目标 3 秒内受到额外 25% 伤害。',tag:'团队增伤'}],
    reply: [{id:'viral',name:'已读传染',cost:110,desc:'命中后追加 3 秒持续伤害，同一目标不重复叠加。',tag:'持续敷衍'}, {id:'shredder',name:'格式粉碎',cost:110,desc:'伤害 +50%，无视护盾；爆炸范围缩小到 1.1 格。',tag:'破盾专家'}],
    coffee: [{id:'espresso',name:'双倍浓缩',cost:100,desc:'攻击频率加成提高到 70%，覆盖范围额外 +0.5。',tag:'极限支援'}, {id:'payroll',name:'带薪续杯',cost:75,desc:'每波结束补贴 ¥18，修复 1 精神；全场每波最多修复 2。',tag:'经济续航'}]
  };
  const PERKS = [
    {id:'detour',name:'摸鱼报销',icon:'coin',category:'经济',desc:'每档绕路收入 +¥1，上限仍为三档。'},
    {id:'reach',name:'长臂管辖',icon:'pot',category:'火力',desc:'所有攻击设备射程 +0.4 格。'},
    {id:'power',name:'甩锅专业户',icon:'pot',category:'火力',desc:'所有甩锅机伤害增加 18%。'},
    {id:'cold',name:'冰杯补贴',icon:'bubble',category:'控制',desc:'泡泡的减速持续时间延长 0.8 秒。'},
    {id:'haste',name:'快捷回复',icon:'reply',category:'火力',desc:'所有攻击设备的攻击间隔缩短 10%。'},
    {id:'cake',name:'五年规划',icon:'cake',category:'技能',desc:'画饼持续时间 +3 秒，冷却缩短 4 秒。'},
    {id:'wifi',name:'拔线自由',icon:'sleep',category:'技能',desc:'断网暂停延长 1 秒，冷却缩短 5 秒。'},
    {id:'therapy',name:'心理补助',icon:'heart',category:'即时',desc:'立即恢复 6 点精神，最多回到 20。'},
    {id:'funding',name:'专项经费',icon:'coin',category:'即时',desc:'立即获得 ¥100，今天的预算很充足。'},
    {id:'recycle',name:'以旧换新',icon:'plant',category:'经济',desc:'出售设备的返还比例从 70% 提高到 90%。'},
    {id:'salary',name:'午休津贴',icon:'coffee',category:'经济',desc:'之后每波结束，额外获得 ¥20。'},
    {id:'rage',name:'专治急急怪',icon:'sun',category:'火力',desc:'对红温工单造成的伤害增加 25%。'}
  ];
  const ENEMY_INFO = {
    normal:{name:'临时需求',icon:'paper',desc:'普通工单，别被它一脸无辜的样子骗了。',counter:'基础火力即可处理'},
    fast:{name:'顺手帮下',icon:'paper',desc:'血量少但跑得快，容易从防线边缘溜走。',counter:'泡泡减速，出口优先'},
    armor:{name:'需求文档',icon:'reply',desc:'厚文档抵挡 45% 普通伤害。',counter:'已读乱回的穿甲伤害'},
    meeting:{name:'紧急会议',icon:'meeting',desc:'周期性让附近工单停下开会，领导不参加。',counter:'利用开会窗口集中群攻'},
    shield:{name:'抄送全员',icon:'shield',desc:'自带一次性护盾，先吸收伤害再损失生命。',counter:'格式粉碎直接无视护盾'},
    healer:{name:'团建部长',icon:'medic',desc:'每 4 秒治疗附近同事，领导受到的治疗减半。',counter:'优先击杀或集中爆发'},
    splitter:{name:'需求套娃',icon:'splitter',desc:'被击败后变出两张更快的小需求，不会无限分裂。',counter:'范围火力守住第二轮'},
    boss:{name:'就改一版',icon:'boss',desc:'半血时发起紧急催办，附近工单加速 4 秒；漏掉扣 8 精神。',counter:'高伤设备配合断网集火'}
  };
  const WAVES = ['临下班，来个小需求', '这事顺手帮一下', '先拉个会对齐一下', '需求文档共 208 页', '小领导：耽误你两分钟', '刚才的需求全部推翻', '下班前再开个短会', '甲方说还是第一版好', '全员紧急！紧急！紧急！', '终极 Boss：就改一版'];
  const vertical = (x, ys) => ys.map(y => [x, y]);
  const LEVELS = [
    { id: 'intern', name: '阳光实习区', subtitle: '第一天上班，先学会下班。', waves: 5, money: 200, scale: .85, color: '#7fbaa0', accent: '#ecf7ed', icon: 'plant', rule: '宽敞工位 · 适合练习', detail: '开阔地图，200 元开局预算。练习摆出折线路径，用画饼把需求引回火力区。', rocks: [[5,2],[5,9],[14,2],[14,9]], zones: [] },
    { id: 'pantry', name: '茶水间奇袭', subtitle: '咖啡喝太多，需求跑得快。', waves: 6, money: 205, scale: .93, color: '#d5a35d', accent: '#fff5df', icon: 'coffee', rule: '咖啡地砖 · 敌人加速 30%', detail: '黄色地砖会让工单加速。可以在地砖上建造挡路，也可以在加速带前铺设泡泡防线。', rocks: [...vertical(6,[2,3,4]),...vertical(13,[7,8,9]),[10,2],[10,9]], zones: [{ kind:'coffee', cells:[[8,5],[9,5],[10,5],[11,5],[8,6],[9,6],[10,6],[11,6]] }] },
    { id: 'archive', name: '档案室迷航', subtitle: '文件很多，出路总会有的。', waves: 7, money: 220, scale: 1, color: '#81a8be', accent: '#edf5fb', icon: 'reply', rule: '软绵地毯 · 敌人减速 25%', detail: '书柜将走廊分成多个区域。蓝色地毯能减速工单；把高伤害设备放在地毯周围。', rocks: [...vertical(5,[0,1,2,3,4,5,6]),...vertical(10,[5,6,7,8,9,10,11]),...vertical(14,[0,1,2,3,4,5,6])], zones:[{kind:'carpet',cells:[[6,7],[7,7],[8,7],[8,6],[8,5],[9,4],[10,4],[11,4],[12,5],[12,6],[12,7],[13,7]]}] },
    { id: 'meeting', name: '会议室逃生', subtitle: '用一场会议，阻止另一场会议。', waves: 8, money: 220, scale: 1.06, color: '#b399c9', accent: '#f6effb', icon: 'meeting', rule: '会议密集 · 停顿更频繁', detail: '紧急会议从第一波就出现，并且更频繁地拉住同事开会。布置范围攻击，利用他们内耗的时间。', rocks: [[7,3],[8,3],[9,3],[10,3],[11,3],[12,3],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8]], zones:[], meetingRate:5 },
    { id: 'rooftop', name: '天台下班线', subtitle: '风很舒服，甩锅要有分寸。', waves: 10, money: 200, scale: 1.08, color: '#df9a84', accent: '#fff0e9', icon: 'sun', rule: '绕路收入 +1 · 更容易红温', detail: '每绕 6 格收入提高到 4 元，但 22 格就会红温。让泡泡与画饼配合，风险和收入一起涨。', rocks: ROCKS, zones:[], detourPay:4, rageAt:22 },
    { id: 'weekend', name: '周末拒绝返工', subtitle: '最终考核：把免打扰开到底。', waves: 12, money: 235, scale: 1.18, color: '#82b3a6', accent: '#edf7f3', icon: 'boss', rule: '12 波高压 · 三位领导来访', detail: '更密集的工单和三场 Boss 战。咖啡站能放大整条防线的输出，别忘记用断网争取喘息时间。', rocks:[...vertical(4,[1,2,3,4,5]),...vertical(8,[6,7,8,9,10]),...vertical(12,[1,2,3,4,5]),...vertical(16,[6,7,8,9,10])], zones:[{kind:'coffee',cells:[[8,5],[9,5],[10,5],[11,5]]},{kind:'carpet',cells:[[14,4],[14,5],[14,6],[15,4],[15,5],[15,6]]}], pressure:true }
  ];
  const key = (x, y) => x + y * COLS;
  const same = (a, b) => a.x === b.x && a.y === b.y;
  const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // A*: Manhattan heuristic is admissible for the four-connected office grid.
  function findPath(start, goal, blocked) {
    if (!inside(start.x, start.y) || !inside(goal.x, goal.y) || blocked.has(key(start.x, start.y)) || blocked.has(key(goal.x, goal.y))) return null;
    const startKey = key(start.x, start.y), endKey = key(goal.x, goal.y);
    const scores = new Map([[startKey, 0]]), parents = new Map(), closed = new Set();
    const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const open = [{ x: start.x, y: start.y, k: startKey, f: h(start.x, start.y), h: h(start.x, start.y) }];
    while (open.length) {
      open.sort((a, b) => a.f - b.f || a.h - b.h || a.k - b.k);
      const n = open.shift();
      if (closed.has(n.k)) continue;
      if (n.k === endKey) {
        const path = [{ x: n.x, y: n.y }];
        let at = n.k;
        while (at !== startKey) { at = parents.get(at); path.push({ x: at % COLS, y: Math.floor(at / COLS) }); }
        return path.reverse();
      }
      closed.add(n.k);
      for (const [dx, dy] of [[1, 0], [0, -1], [0, 1], [-1, 0]]) {
        const x = n.x + dx, y = n.y + dy, k = key(x, y), g = scores.get(n.k) + 1;
        if (!inside(x, y) || blocked.has(k) || closed.has(k) || g >= (scores.get(k) ?? Infinity)) continue;
        scores.set(k, g); parents.set(k, n.k); open.push({ x, y, k, f: g + h(x, y), h: h(x, y) });
      }
    }
    return null;
  }

  class Game {
    constructor(levelId = 'classic', options = {}) {
      this.level = LEVELS.find(l => l.id === levelId) || { id:'classic',name:'经典办公室',waves:10,money:185,scale:1,rocks:ROCKS,zones:[],color:'#7fbaa0',accent:'#edf7ef',rule:'经典十波挑战' };
      this.maxWaves = this.level.waves;
      this.money = this.level.money; this.lives = 20; this.wave = 0; this.kills = 0; this.income = 0;
      this.state = 'build'; this.time = 0; this.towers = []; this.enemies = []; this.projectiles = []; this.events = [];
      this.cake = null; this.cakeReady = 0; this.freezeReady = 0; this.nextId = 1; this.pending = []; this.spawnTimer = 0;
      this.rocks = new Set(this.level.rocks.map(([x, y]) => key(x, y))); this.blocked = new Set(this.rocks);
      this.zones = new Map(); for (const zone of this.level.zones) for (const [x,y] of zone.cells) this.zones.set(key(x,y),zone.kind);
      this.route = findPath(ENTRY, EXIT, this.blocked); this.pathVersion = 0;
      this.seed = Number.isSafeInteger(options.seed) ? options.seed >>> 0 : 1759;
      this.perks = []; this.pendingPerks = [];
      this.stats = { cakes: 0, rage: 0, shots: 0, freezes:0, damage:0, earned:0, spent:0, leaked:0, healing:0, evolutions:0, byType:Object.fromEntries(Object.keys(TYPES).map(k=>[k,{damage:0,kills:0,shots:0}])) };
    }
    emit(type, data = {}) { this.events.push({ type, ...data }); if (this.events.length > 300) this.events.shift(); }
    takeEvents() { return this.events.splice(0); }
    towerAt(x, y) { return this.towers.find(t => t.x === x && t.y === y); }
    hasPerk(id) { return this.perks.includes(id); }
    detourPay() { return (this.level.detourPay||3)+(this.hasPerk('detour')?1:0); }
    sellValue(t) { return Math.floor(t.spent*(this.hasPerk('recycle')?.9:.7)); }
    offerPerks() {
      const pool=PERKS.filter(p=>!this.hasPerk(p.id)).map(p=>p.id);
      this.pendingPerks=[];
      for(let i=0;i<3&&pool.length;i++){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;this.pendingPerks.push(pool.splice(this.seed%pool.length,1)[0]);}
      this.emit('perk-offer');
    }
    choosePerk(id) {
      if(this.state!=='build'||!this.pendingPerks.includes(id)||this.hasPerk(id))return {ok:false,reason:'这项福利当前无法领取。'};
      this.perks.push(id);this.pendingPerks=[];
      if(id==='funding'){this.money+=100;this.stats.earned+=100;}
      if(id==='therapy'){const heal=Math.min(6,20-this.lives);this.lives+=heal;this.stats.healing+=heal;}
      this.emit('perk', {id});return {ok:true};
    }
    evolve(id,branch) {
      const t=this.towers.find(t=>t.id===id),choice=t&&EVOLUTIONS[t.type].find(e=>e.id===branch);
      if(!t||t.level!==3||t.evolution||!choice||!['build','wave'].includes(this.state))return {ok:false,reason:'先升到三级，每台设备只能选择一个进化分支。'};
      if(this.money<choice.cost)return {ok:false,reason:'进化经费不足，先攒点摸鱼预算。'};
      this.money-=choice.cost;this.stats.spent+=choice.cost;t.spent+=choice.cost;t.evolution=branch;this.stats.evolutions++;
      this.emit('evolve',{x:t.x,y:t.y,color:TYPES[t.type].color,name:choice.name});return {ok:true};
    }
    setTarget(id,mode) {
      const t=this.towers.find(t=>t.id===id);if(!t||t.type==='coffee'||!['exit','strong','near','rage'].includes(mode))return false;
      t.targetMode=mode;return true;
    }
    statsFor(t) {
      const base = TYPES[t.type], n = t.level - 1;
      let boost = 1;
      if (t.type !== 'coffee') for (const station of this.towers) if (station.type === 'coffee' && distance(t,station) <= TYPES.coffee.range + .35 * (station.level-1)+(station.evolution==='espresso'?.5:0)) boost = Math.max(boost, 1.25 + .1 * (station.level-1)+(station.evolution==='espresso'?.25:0));
      const s={ ...base, damage: base.damage * (1 + n * .65), range: base.range + n * .35, interval: base.interval / ((1 + n * .16)*boost), boost, aura:1.25 + .1*n };
      if(t.type!=='coffee'){if(this.hasPerk('reach'))s.range+=.4;if(this.hasPerk('haste'))s.interval*=.9;}
      if(t.type==='pot'&&this.hasPerk('power'))s.damage*=1.18;
      if(t.evolution==='sniper'){s.range+=1.7;s.damage*=1.8;s.interval*=1.35;}
      if(t.evolution==='shredder')s.damage*=1.5;
      if(t.evolution==='espresso'){s.range+=.5;s.aura+=.25;}
      return s;
    }
    buildCheck(x, y, type) {
      if (!TYPES[type]) return { ok: false, reason: '先选一种反内卷装备。' };
      if (!['build', 'wave'].includes(this.state)) return { ok: false, reason: '这局已经结束，重新开局吧。' };
      if (!inside(x, y) || x === 0 || x === COLS - 1) return { ok: false, reason: '入口和出口的消防通道不能占。' };
      if (this.blocked.has(key(x, y))) return { ok: false, reason: '这个工位已经有人了。' };
      if (this.cake && same(this.cake, { x, y })) return { ok: false, reason: '饼还在这里，先让他们吃完。' };
      if (this.money < TYPES[type].cost) return { ok: false, reason: '经费不足，先让工单多绕两步。' };
      if (this.enemies.some(e => same(e.cell, { x, y }) || (e.path[0] && same(e.path[0], { x, y })))) return { ok: false, reason: '工单正在经过，不能直接拿桌子压人。' };
      const blocked = new Set(this.blocked); blocked.add(key(x, y));
      if (!findPath(ENTRY, EXIT, blocked)) return { ok: false, reason: '不能封死道路。给需求留条活路。' };
      if (this.cake && !findPath(ENTRY, this.cake, blocked)) return { ok: false, reason: '你把画的饼堵住了，这不合规。' };
      for (const e of this.enemies) {
        const from = e.path[0] || e.cell;
        if (!findPath(from, EXIT, blocked) || (this.cake && e.ate !== this.cake.id && !findPath(from, this.cake, blocked))) return { ok: false, reason: '会把工单困在里面，换个工位。' };
      }
      return { ok: true, blocked };
    }
    build(x, y, type) {
      const check = this.buildCheck(x, y, type); if (!check.ok) return check;
      const t = { id: this.nextId++, x, y, type, level: 1, spent: TYPES[type].cost, cooldown: 0, angle: -.4, evolution:null,targetMode:'exit',damage:0,kills:0,shots:0 };
      this.towers.push(t); this.money -= TYPES[type].cost; this.blocked = check.blocked; this.repath();
      this.stats.spent+=TYPES[type].cost;
      this.emit('build', { x, y, color: TYPES[type].color }); return { ok: true, tower: t };
    }
    upgradeCost(t) { return Math.round(TYPES[t.type].cost * (.75 + .45 * (t.level - 1))); }
    upgrade(id) {
      const t = this.towers.find(t => t.id === id);
      if (!t || t.level >= 3 || !['build', 'wave'].includes(this.state)) return { ok: false, reason: '已经是反内卷满级装备了。' };
      const cost = this.upgradeCost(t);
      if (this.money < cost) return { ok: false, reason: '升级经费不足。' };
      t.level++; t.spent += cost; this.money -= cost; this.stats.spent+=cost; this.emit('build', { x: t.x, y: t.y, color: TYPES[t.type].color }); return { ok: true };
    }
    sell(id) {
      if (!['build', 'wave'].includes(this.state)) return false;
      const t = this.towers.find(t => t.id === id); if (!t) return false;
      this.money += this.sellValue(t); this.towers = this.towers.filter(v => v !== t); this.blocked.delete(key(t.x, t.y)); this.repath(); return true;
    }
    pathFor(start, e) {
      if (this.cake && e.ate !== this.cake.id) {
        const first = findPath(start, this.cake, this.blocked), second = findPath(this.cake, EXIT, this.blocked);
        if (first && second) return first.concat(second.slice(1));
      }
      return findPath(start, EXIT, this.blocked);
    }
    repath() {
      this.pathVersion++; this.route = findPath(ENTRY, EXIT, this.blocked);
      for (const e of this.enemies) {
        // Keep the segment already being traversed; never jump through a desk.
        const next = e.path[0];
        e.path = next ? this.pathFor(next, e) : this.pathFor(e.cell, e).slice(1);
      }
    }
    cakeCheck(x, y) {
      if (this.state !== 'wave') return { ok: false, reason: '先开始这一波，再请大家吃饼。' };
      if (this.cakeReady > this.time) return { ok: false, reason: '领导正在组织下一张饼，稍等。' };
      if (!inside(x, y) || x === 0 || x === COLS - 1 || this.blocked.has(key(x, y))) return { ok: false, reason: '选一个能走到的空工位画饼。' };
      if (!findPath(ENTRY, { x, y }, this.blocked)) return { ok: false, reason: '饼太远，大家够不着。' };
      if (this.enemies.some(e => !findPath(e.path[0] || e.cell, { x, y }, this.blocked))) return { ok: false, reason: '有工单走不到这个饼。' };
      return { ok: true };
    }
    placeCake(x, y) {
      const check = this.cakeCheck(x, y); if (!check.ok) return check;
      this.cake = { x, y, id: this.nextId++, expires: this.time + 8+(this.hasPerk('cake')?3:0) }; this.cakeReady = this.time + 22-(this.hasPerk('cake')?4:0);
      this.stats.cakes++; this.repath(); this.emit('cake', { x, y }); return { ok: true };
    }
    freeze() {
      if (this.state !== 'wave' || this.freezeReady > this.time) return {ok:false,reason:'断网还在冷却，或当前没有需求入侵。'};
      this.freezeReady = this.time+30-(this.hasPerk('wifi')?5:0); this.stats.freezes++;
      for (const e of this.enemies) e.holdUntil = Math.max(e.holdUntil,this.time+2.8+(this.hasPerk('wifi')?1:0));
      this.emit('freeze'); return {ok:true};
    }
    waveName(wave = this.wave) { return wave === this.maxWaves ? '最终 Boss：就改一版' : WAVES[(wave-1)%WAVES.length]; }
    waveTypes(wave = this.wave+1) {
      const types=[]; const count=6+wave*2+(this.level.pressure?2:0);
      for(let i=0;i<count;i++) {
        let type='normal';
        if(wave>=2&&i%4===2)type='fast';
        if(wave>=3&&i%5===4)type='armor';
        if((wave>=3||this.level.id==='meeting')&&i%7===3)type='meeting';
        if(this.level.id!=='classic'){
          if(wave>=4&&i%9===4)type='shield';
          if(wave>=5&&i%11===6)type='healer';
          if(wave>=6&&i%10===5)type='splitter';
        }
        types.push(type);
      }
      if(wave%5===0||wave===this.maxWaves)types.splice(Math.floor(count/2),0,'boss');
      return types;
    }
    startWave() {
      if (this.state !== 'build' || this.wave >= this.maxWaves || this.pendingPerks.length) return false;
      this.wave++; this.state = 'wave'; this.pending = []; this.spawnTimer = .5;
      this.pending = this.waveTypes(this.wave);
      this.emit('wave', { wave: this.wave, name: this.waveName() }); return true;
    }
    spawn(type) {
      const scale = (1 + .16 * (this.wave - 1) + .02 * (this.wave - 1) ** 2)*this.level.scale;
      const spec = {
        normal: { hp: 34, speed: 1.55, reward: 6, leak: 1, armor: 0, name: '临时需求', color: '#e8e5d0' },
        fast: { hp: 23, speed: 2.55, reward: 7, leak: 1, armor: 0, name: '顺手帮下', color: '#d7fa69' },
        armor: { hp: 80, speed: 1.05, reward: 11, leak: 2, armor: .45, name: '需求文档', color: '#a8bab7' },
        meeting: { hp: 49, speed: 1.7, reward: 9, leak: 2, armor: .12, name: '紧急会议', color: '#d6b1d8' },
        shield: {hp:42,speed:1.3,reward:11,leak:2,armor:0,name:'抄送全员',color:'#94bed7'},
        healer: {hp:54,speed:1.25,reward:12,leak:2,armor:0,name:'团建部长',color:'#aad2a9'},
        splitter: {hp:52,speed:1.4,reward:8,leak:2,armor:.1,name:'需求套娃',color:'#dab68e'},
        boss: { hp: this.wave === this.maxWaves ? 330 : 220, speed: .75, reward: 65, leak: 8, armor: .25, name: this.wave === this.maxWaves ? '就改一版' : '耽误两分钟', color: '#f99d83' }
      }[type];
      const e = { ...spec, id: this.nextId++, type, x: ENTRY.x, y: ENTRY.y, cell: { ...ENTRY }, hp: spec.hp * scale, maxHp: spec.hp * scale, steps: 0, paid: 0, slowUntil: 0, calmUntil: 0, holdUntil: 0, nextMeeting: this.time + 4, ate: null, rage: false, path: [] };
      e.shield=type==='shield'?32*scale:0;e.maxShield=e.shield;e.nextHeal=this.time+4;e.slowFactor=.48;e.vulnerableUntil=0;e.hasteUntil=0;e.dotUntil=0;e.dotDamage=0;
      e.path = this.pathFor(ENTRY, e).slice(1); this.enemies.push(e); return e;
    }
    hit(e, damage, trueDamage = false, source = null, ignoreShield = false) {
      if (e.dead || !Number.isFinite(damage) || damage<=0) return;
      let amount=damage*(trueDamage?1:1-e.armor)*(e.vulnerableUntil>this.time?1.25:1)*(e.rage&&this.hasPerk('rage')?1.25:1);
      const absorbed=ignoreShield?0:Math.min(e.shield||0,amount);e.shield=(e.shield||0)-absorbed;amount-=absorbed;
      const actual=absorbed+Math.min(Math.max(0,e.hp),amount);e.hp-=amount;
      this.stats.damage+=actual;
      const tower=source&&this.towers.find(t=>t.id===source.towerId),typeStats=source&&this.stats.byType[source.type];
      if(tower)tower.damage=(tower.damage||0)+actual;if(typeStats)typeStats.damage+=actual;
      e.flash = this.time + .1;
      if(this.level.id!=='classic'&&e.type==='boss'&&!e.rallied&&e.hp>0&&e.hp<=e.maxHp*.5){e.rallied=true;for(const ally of this.enemies)if(!ally.dead&&distance(e,ally)<=3)ally.hasteUntil=this.time+4;this.emit('rally',{x:e.x,y:e.y});}
      if (e.hp <= 0) {
        e.dead = true; this.kills++; this.money += e.reward;this.stats.earned+=e.reward;
        if(tower)tower.kills=(tower.kills||0)+1;if(typeStats)typeStats.kills++;
        this.emit('kill', { x: e.x, y: e.y, reward: e.reward, color: e.color, boss: e.type === 'boss' });
        if(e.type==='splitter'){
          for(let i=0;i<2;i++){const child=this.spawn('fast');Object.assign(child,{x:e.x,y:e.y,cell:{...e.cell},path:e.path.map(p=>({...p})),steps:e.steps,paid:3,ate:e.ate,hp:e.maxHp*.22,maxHp:e.maxHp*.22,reward:2,name:'追加小需求',mini:true,speed:2.2+i*.15});}
          this.emit('split',{x:e.x,y:e.y});
        }
      }
    }
    move(e, dt) {
      if (e.holdUntil > this.time) return;
      const angry = e.steps >= (this.level.rageAt||25) && e.calmUntil <= this.time;
      if (angry && !e.rage) { this.stats.rage++; this.emit('rage', { x: e.x, y: e.y }); }
      e.rage = angry;
      const zone = this.zones.get(key(e.cell.x,e.cell.y));
      let remaining = e.speed * dt * (angry ? 1.45 : 1) * (e.slowUntil > this.time ? (e.slowFactor??.48) : 1) * (e.hasteUntil>this.time?1.3:1) * (zone==='coffee'?1.3:zone==='carpet'?.75:1);
      while (remaining > 0 && e.path.length) {
        const next = e.path[0], d = distance(e, next);
        if (d > remaining) { e.x += (next.x - e.x) / d * remaining; e.y += (next.y - e.y) / d * remaining; remaining = 0; }
        else {
          e.x = next.x; e.y = next.y; e.cell = { ...next }; e.path.shift(); remaining -= d; e.steps++;
          const due = Math.min(3, Math.floor(Math.max(0, e.steps - e.cell.x) / 6));
          if (due > e.paid) { const amount = (due - e.paid) * this.detourPay(); e.paid = due; this.money += amount; this.income += amount; this.stats.earned+=amount; this.emit('income', { x: e.x, y: e.y, amount }); }
          if (this.cake && e.ate !== this.cake.id && same(e.cell, this.cake)) { e.ate = this.cake.id; this.emit('eat', { x: e.x, y: e.y }); }
        }
      }
      if (!e.path.length && same(e.cell, EXIT)) {
        e.dead = true; e.escaped = true; this.stats.leaked++; this.lives = Math.max(0, this.lives - e.leak); this.emit('leak', { x: EXIT.x, y: EXIT.y, amount: e.leak, name: e.name });
      }
    }
    update(dt) {
      if (this.state !== 'wave' || !Number.isFinite(dt) || dt <= 0) return;
      // Fixed-step caller supplies 1/60 s; clamp accidental large jumps.
      dt = Math.min(dt, .05); this.time += dt;
      if (this.cake && this.cake.expires <= this.time) { this.cake = null; this.repath(); this.emit('cake-end'); }
      this.spawnTimer -= dt;
      if (this.pending.length && this.spawnTimer <= 0) { this.spawn(this.pending.shift()); this.spawnTimer += Math.max(.5, 1.05 - this.wave * .035); }
      for(const e of this.enemies)if(!e.dead&&e.dotUntil>this.time)this.hit(e,e.dotDamage*dt,true,e.dotSource);
      for(const e of this.enemies)if(!e.dead&&e.type==='healer'&&e.nextHeal<=this.time&&e.holdUntil<=this.time){
        e.nextHeal=this.time+4;let healed=false;
        for(const ally of this.enemies)if(!ally.dead&&ally!==e&&distance(e,ally)<=2.3&&ally.hp<ally.maxHp){ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*(ally.type==='boss'?.05:.1));healed=true;}
        if(healed)this.emit('heal',{x:e.x,y:e.y});
      }
      // A meeting is its own worst enemy: it periodically stops nearby paperwork.
      for (const e of this.enemies) if (!e.dead && e.type === 'meeting' && e.nextMeeting <= this.time) {
        e.nextMeeting = this.time + (this.level.meetingRate||7.5);
        for (const colleague of this.enemies) if (!colleague.dead && colleague.type !== 'boss' && distance(e, colleague) <= 2.1) colleague.holdUntil = Math.max(colleague.holdUntil, this.time + 1.8);
        this.emit('meeting', { x: e.x, y: e.y });
      }
      for (const e of this.enemies) if (!e.dead) this.move(e, dt);
      if (this.lives <= 0) { this.state = 'lost'; this.emit('end', { won: false }); return; }
      for (const t of this.towers) {
        if(t.type==='coffee')continue;
        t.cooldown -= dt; if (t.cooldown > 0) continue;
        const s = this.statsFor(t);
        const targets = this.enemies.filter(e => !e.dead && distance(e, t) <= s.range);
        targets.sort((a,b)=>{
          if(t.targetMode==='strong')return (b.hp+(b.shield||0))-(a.hp+(a.shield||0));
          if(t.targetMode==='near')return distance(a,t)-distance(b,t);
          if(t.targetMode==='rage'&&a.rage!==b.rage)return a.rage?-1:1;
          return (a.path.length-b.path.length)||(a.hp-b.hp);
        });
        const target = targets[0]; if (!target) continue;
        t.angle = Math.atan2(target.y - t.y, target.x - t.x); t.cooldown = s.interval;
        this.projectiles.push({ x: t.x, y: t.y, fromX: t.x, fromY: t.y, target: target.id, tx: target.x, ty: target.y, type: t.type, damage: s.damage, level: t.level, age: 0, towerId:t.id, evolution:t.evolution }); this.stats.shots++;t.shots=(t.shots||0)+1;this.stats.byType[t.type].shots++;
        this.emit('shot', { typeName: t.type, x: t.x, y: t.y });
      }
      for (const p of this.projectiles) {
        p.age += dt;
        const target = this.enemies.find(e => e.id === p.target && !e.dead);
        if (target) { p.tx = target.x; p.ty = target.y; }
        const d = Math.hypot(p.tx - p.x, p.ty - p.y), step = 11 * dt;
        if (d <= step) {
          if (p.returning) { p.done = true; continue; }
          p.done = true;
          const center = { x: p.tx, y: p.ty };
          if (p.type === 'pot') {
            if (target) this.hit(target,p.damage,false,p);
            if(p.evolution==='ricochet'){
              const visited=new Set([p.target]);let from=center;
              for(let bounce=0;bounce<2;bounce++){const next=this.enemies.filter(e=>!e.dead&&!visited.has(e.id)&&distance(e,from)<=2.2).sort((a,b)=>distance(a,from)-distance(b,from))[0];if(!next)break;visited.add(next.id);this.emit('chain',{x:from.x,y:from.y,tx:next.x,ty:next.y});this.hit(next,p.damage*.65,false,p);from=next;}
            }
          }
          else {
            const radius = p.evolution==='foam'?1.85:p.evolution==='shredder'?1.1:p.type === 'bubble' ? 1.15 : 1.45;
            for (const e of this.enemies) if (!e.dead && distance(e, center) <= radius) {
              if (p.type === 'bubble') {
                const factor=p.evolution==='glacier'?.3:.48;e.slowFactor=e.slowUntil>this.time?Math.min(e.slowFactor,factor):factor;
                e.slowUntil=Math.max(e.slowUntil,this.time+2+p.level*.2+(this.hasPerk('cold')?.8:0));e.calmUntil=Math.max(e.calmUntil,this.time+(p.evolution==='foam'?8:3));
                if(p.evolution==='glacier'&&e.type!=='boss')e.holdUntil=Math.max(e.holdUntil,this.time+.35);
                if(p.evolution==='foam')e.vulnerableUntil=this.time+3;
              }
              this.hit(e,p.damage,p.type==='reply',p,p.evolution==='shredder');
              if(!e.dead&&p.evolution==='viral'){const d=p.damage*.25;if(e.dotUntil<=this.time||d>=e.dotDamage){e.dotDamage=d;e.dotSource={towerId:p.towerId,type:p.type};}e.dotUntil=this.time+3;}
            }
          }
          this.emit('impact', { x: p.tx, y: p.ty, kind: p.type, radius: p.type === 'pot' ? .28 : p.evolution==='foam'?1.85:p.evolution==='shredder'?1.1:p.type === 'bubble' ? 1.15 : 1.45 });
          if (p.type === 'pot') { p.done = false; p.returning = true; p.x = p.tx; p.y = p.ty; p.tx = p.fromX; p.ty = p.fromY; p.target = null; }
        } else { p.x += (p.tx - p.x) / d * step; p.y += (p.ty - p.y) / d * step; }
      }
      this.enemies = this.enemies.filter(e => !e.dead); this.projectiles = this.projectiles.filter(p => !p.done && p.age < 3);
      if (!this.pending.length && !this.enemies.length) {
        const payroll=this.towers.filter(t=>t.evolution==='payroll').length,bonus=40+this.wave*7+(this.hasPerk('salary')?20:0)+payroll*18;
        const heal=Math.min(2,payroll,20-this.lives);this.lives+=heal;this.stats.healing+=heal;
        this.money += bonus;this.stats.earned+=bonus; this.projectiles = []; this.cake = null; this.cakeReady = this.time; this.freezeReady = this.time; this.repath();
        if (this.wave >= this.maxWaves) { this.state = 'won'; this.emit('end', { won: true }); }
        else { this.state = 'build';if(this.level.id!=='classic'&&this.wave%2===0)this.offerPerks(); this.emit('clear', { wave: this.wave, bonus }); }
      }
    }
    snapshot() {
      if(this.state!=='build')return null;
      return {version:3,level:this.level.id,money:this.money,lives:this.lives,wave:this.wave,kills:this.kills,income:this.income,towers:this.towers.map(t=>({...t})),stats:JSON.parse(JSON.stringify(this.stats)),perks:[...this.perks],pendingPerks:[...this.pendingPerks],seed:this.seed};
    }
    static restore(data) {
      if(!data||![2,3].includes(data.version)||!LEVELS.some(l=>l.id===data.level)||!Array.isArray(data.towers))return null;
      const g=new Game(data.level);
      if(data.version===3){
        if(!Array.isArray(data.perks)||!Array.isArray(data.pendingPerks)||data.pendingPerks.length>3||new Set([...data.perks,...data.pendingPerks]).size!==data.perks.length+data.pendingPerks.length||[...data.perks,...data.pendingPerks].some(id=>!PERKS.some(p=>p.id===id)))return null;
        g.perks=[...data.perks];g.pendingPerks=[...data.pendingPerks];if(Number.isSafeInteger(data.seed))g.seed=data.seed>>>0;
      }
      for(const k of ['money','lives','wave','kills','income'])if(!Number.isSafeInteger(data[k])||data[k]<0||data[k]>10000000)return null;
      if(data.lives<1||data.lives>20||data.wave>=g.maxWaves||data.towers.length>216)return null;
      for(const t of data.towers){
        if(!t||!TYPES[t.type]||!inside(t.x,t.y)||t.x===0||t.x===19||g.blocked.has(key(t.x,t.y))||![1,2,3].includes(t.level))return null;
        let spent=TYPES[t.type].cost; for(let lv=1;lv<t.level;lv++)spent+=g.upgradeCost({type:t.type,level:lv});
        const branch=t.evolution&&EVOLUTIONS[t.type].find(e=>e.id===t.evolution);if(t.evolution&&(!branch||t.level!==3))return null;if(branch)spent+=branch.cost;
        const metrics={};for(const k of ['damage','kills','shots'])metrics[k]=Number.isFinite(t[k])&&t[k]>=0?t[k]:0;
        g.towers.push({id:g.nextId++,x:t.x,y:t.y,type:t.type,level:t.level,spent,cooldown:0,angle:-.4,evolution:branch?.id||null,targetMode:['exit','strong','near','rage'].includes(t.targetMode)?t.targetMode:'exit',...metrics});g.blocked.add(key(t.x,t.y));
      }
      if(!findPath(ENTRY,EXIT,g.blocked))return null;
      for(const k of ['money','lives','wave','kills','income'])g[k]=data[k];
      for(const k of Object.keys(g.stats))if(k!=='byType'&&Number.isFinite(data.stats?.[k])&&data.stats[k]>=0)g.stats[k]=data.stats[k];
      for(const type of Object.keys(TYPES))for(const k of ['damage','kills','shots'])if(Number.isFinite(data.stats?.byType?.[type]?.[k])&&data.stats.byType[type][k]>=0)g.stats.byType[type][k]=data.stats.byType[type][k];
      g.repath();return g;
    }
  }
  const api = { Game, findPath, COLS, ROWS, ENTRY, EXIT, ROCKS, TYPES, WAVES, LEVELS, EVOLUTIONS, PERKS, ENEMY_INFO, key, distance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FridayEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
