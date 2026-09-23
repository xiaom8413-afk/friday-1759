(() => {
  'use strict';
  const {Game,TYPES,LEVELS,EVOLUTIONS,ENEMY_INFO,findPath,ENTRY,EXIT,key}=FridayEngine;
  const {icon,ui,hero}=FridayArt;
  const {Renderer,CELL,OX,OY,W,H}=FridayRenderer;
  const $=id=>document.getElementById(id),canvas=$('game'),renderer=new Renderer(canvas);
  const STORAGE={campaign:'friday1759-campaign-v2',checkpoint:'friday1759-checkpoint-v2',sound:'friday1759-sound'};
  const read=k=>{try{return JSON.parse(localStorage.getItem(k));}catch(_){return null;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}};
  const progress={}; const previous=read(STORAGE.campaign);
  for(const l of LEVELS){const old=previous?.[l.id];progress[l.id]={stars:Number.isInteger(old?.stars)?Math.max(0,Math.min(3,old.stars)):0,bestKills:Number.isSafeInteger(old?.bestKills)&&old.bestKills>=0?old.bestKills:0,wins:Number.isSafeInteger(old?.wins)&&old.wins>=0?old.wins:0};}
  let saved=read(STORAGE.checkpoint);if(!Game.restore(saved))saved=null;
  let game=new Game('intern',{seed:Date.now()>>>0}),tool='pot',selected=null,hover=null,hoverCheck=null,paused=false,speed=1,showPath=true;
  let audioEnabled=read(STORAGE.sound)===true,audioContext=null,shownEnd=false,toastTimer,resetUntil=0;
  let last=performance.now(),accumulator=0,lastUI=0,uiSignature='',previewSignature='',hoverSignature='',selectedLevel=0,storageOK=true;
  document.querySelectorAll('[data-art]').forEach(el=>el.innerHTML=icon(el.dataset.art));
  document.querySelectorAll('[data-control]').forEach(el=>el.insertAdjacentHTML('afterbegin',ui(el.dataset.control)));
  $('hero-art').innerHTML=hero();
  function sound(kind){if(!audioEnabled)return;try{audioContext ||= new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});const f={build:500,kill:650,cake:880,leak:95,wave:330,clear:780,freeze:240}[kind]||300;const o=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;o.type=kind==='leak'?'triangle':'sine';o.frequency.setValueAtTime(f,now);o.frequency.exponentialRampToValueAtTime(f*.65,now+.12);gain.gain.setValueAtTime(.025,now);gain.gain.exponentialRampToValueAtTime(.001,now+.15);o.connect(gain);gain.connect(audioContext.destination);o.start();o.stop(now+.16);}catch(_){audioEnabled=false;}}
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
  function checkpoint(){if(game.state!=='build')return;saved=game.snapshot();storageOK=write(STORAGE.checkpoint,saved);$('resume-banner').classList.add('hidden');}
  function saveVictory(){const record=progress[game.level.id];record.stars=Math.max(record.stars,game.lives>=16?3:game.lives>=8?2:1);record.bestKills=Math.max(record.bestKills,game.kills);record.wins++;storageOK=write(STORAGE.campaign,progress);}
  const systems=FridaySystems.create({getGame:()=>game,pause:()=>{if(game.state==='wave'){paused=true;accumulator=0;updateUI();}},changed:()=>{uiSignature='';checkpoint();consumeEvents();updateUI();},toast});
  function clearCheckpoint(){saved=null;try{localStorage.removeItem(STORAGE.checkpoint);}catch(_){}$('resume-banner').classList.add('hidden');}
  function levelNumber(){return LEVELS.findIndex(l=>l.id===game.level.id);}
  function renderChapters(){
    $('chapter-strip').innerHTML=LEVELS.map((l,i)=>`<button class="chapter-chip ${l.id===game.level.id?'active':''} ${progress[l.id].stars?'cleared':''}" data-level="${i}" aria-pressed="${l.id===game.level.id}"><span class="chapter-number">${String(i+1).padStart(2,'0')}</span><span><strong>${l.name}</strong><small>${l.waves} 波挑战${progress[l.id].stars?` · ${progress[l.id].stars}/3 星`:''}</small></span><span class="mini-star">${icon('star')}</span></button>`).join('');
    $('chapter-strip').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openLevels(Number(b.dataset.level))));
  }
  function mapThumbnail(level){const b=new Set(level.rocks.map(([x,y])=>key(x,y))),route=findPath(ENTRY,EXIT,b);const cells=level.rocks.map(([x,y])=>`<rect x="${20+x*8}" y="${7+y*8}" width="7" height="7" rx="1.5" fill="${level.color}" opacity=".65"/>`).join('');const zones=level.zones.flatMap(z=>z.cells.map(([x,y])=>`<rect x="${20+x*8}" y="${7+y*8}" width="7" height="7" rx="1" fill="${z.kind==='coffee'?'#eccb83':'#bedce3'}"/>`)).join('');return `<svg viewBox="0 0 200 110" aria-hidden="true"><rect width="200" height="110" fill="${level.accent}"/>${zones}<path d="${route.map((p,i)=>`${i?'L':'M'}${24+p.x*8} ${11+p.y*8}`).join(' ')}" fill="none" stroke="${level.color}" stroke-width="3" stroke-dasharray="3 4"/>${cells}<rect x="16" y="45" width="10" height="13" rx="3" fill="#d7b595"/><rect x="176" y="44" width="10" height="15" rx="3" fill="#83b596"/></svg>`;}
  function populateLevels(){
    $('level-grid').innerHTML=LEVELS.map((l,i)=>`<button class="level-card ${i===selectedLevel?'selected':''}" data-level="${i}" aria-pressed="${i===selectedLevel}"><span class="level-thumbnail">${mapThumbnail(l)}</span><span class="level-card-title"><strong>${String(i+1).padStart(2,'0')} ${l.name}</strong><small>${progress[l.id].stars}/3 星</small></span><small>${l.waves} 波 · ${l.rule}</small></button>`).join('');
    $('level-grid').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{selectedLevel=Number(b.dataset.level);populateLevels();}));
    const l=LEVELS[selectedLevel];$('level-detail-title').textContent=l.subtitle;$('level-detail-copy').textContent=l.detail;$('enter-level').innerHTML=`去这个工位 ${ui('arrow')}`;
  }
  function openLevels(index=levelNumber()){selectedLevel=Math.max(0,index);if(game.state==='wave'){paused=true;accumulator=0;updateUI();}populateLevels();$('level-dialog').showModal();}
  function newGame(id){game=new Game(id,{seed:Date.now()>>>0});tool='pot';selected=null;hover=null;hoverCheck=null;paused=false;speed=1;accumulator=0;shownEnd=false;resetUntil=0;renderer.effects=[];renderer.particles=[];uiSignature='';previewSignature='';hoverSignature='';$('result-overlay').classList.add('hidden');$('resume-banner').classList.add('hidden');systems.reset();renderChapters();checkpoint();updateUI();}
  $('levels-btn').addEventListener('click',()=>openLevels());$('close-levels').addEventListener('click',()=>$('level-dialog').close());
  $('enter-level').addEventListener('click',()=>{newGame(LEVELS[selectedLevel].id);$('level-dialog').close();toast(LEVELS[selectedLevel].subtitle);});
  if(saved){$('resume-text').textContent=`上次停在「${LEVELS.find(l=>l.id===saved.level).name}」第 ${saved.wave+1} 波前`;$('resume-banner').classList.remove('hidden');}
  $('resume-btn').addEventListener('click',()=>{const restored=Game.restore(saved);if(!restored)return;game=restored;tool='pot';selected=null;paused=false;accumulator=0;shownEnd=false;uiSignature='';previewSignature='';renderer.effects=[];renderer.particles=[];$('resume-banner').classList.add('hidden');renderChapters();updateUI();toast('已恢复本波开始前的布防，准备好就继续。');if(game.pendingPerks.length)systems.offer();});
  $('dismiss-resume').addEventListener('click',()=>$('resume-banner').classList.add('hidden'));
  function selectTool(type){if(!['build','wave'].includes(game.state))return;tool=tool===type?null:type;selected=null;uiSignature='';checkHover();updateUI();}
  for(const [id,t] of Object.entries(TYPES)){const button=document.createElement('button');button.className='tower-card';button.dataset.type=id;button.innerHTML=`<span class="tower-icon">${icon(id)}</span><span class="tower-copy"><strong>${t.name}</strong><small>${t.desc}</small></span><span class="tower-price">¥${t.cost}<kbd>${Object.keys(TYPES).indexOf(id)+1}</kbd></span>`;button.addEventListener('click',()=>selectTool(id));$('tower-list').append(button);}
  function checkHover(){hoverCheck=hover?tool==='cake'?game.cakeCheck(hover.x,hover.y):TYPES[tool]?game.buildCheck(hover.x,hover.y,tool):null:null;}
  function handleCell(x,y){
    if(!['build','wave'].includes(game.state))return;
    const tower=game.towerAt(x,y);
    if(tool==='cake'){const result=game.placeCake(x,y);if(!result.ok)toast(result.reason);else{tool=null;toast('饼已画好：这个项目做完，大家都是合伙人。');}}
    else if(tower){selected=tower.id;tool=null;}
    else if(TYPES[tool]){const result=game.build(x,y,tool);if(!result.ok)toast(result.reason);else{selected=null;checkpoint();if(game.towers.length===1)toast('第一台设备就位。沿途再放几台，然后开始第一波。');}}
    else toast('先选一个装备，或按 1 / 2 / 3 / 4。');
    uiSignature='';checkHover();consumeEvents();updateUI();
  }
  function cellFromEvent(e){const r=canvas.getBoundingClientRect();return{x:Math.floor(((e.clientX-r.left)/r.width*W-OX)/CELL),y:Math.floor(((e.clientY-r.top)/r.height*H-OY)/CELL)};}
  canvas.addEventListener('pointermove',e=>{const p=cellFromEvent(e);if(!hover||hover.x!==p.x||hover.y!==p.y){hover=p.x>=0&&p.x<20&&p.y>=0&&p.y<12?p:null;checkHover();}});
  canvas.addEventListener('pointerleave',()=>{hover=null;hoverCheck=null;});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();canvas.focus({preventScroll:true});const p=cellFromEvent(e);if(p.x>=0&&p.x<20&&p.y>=0&&p.y<12){hover=p;handleCell(p.x,p.y);}});
  function cake(){if(game.state!=='wave'){toast('先开始这一波，再请大家吃饼。');return;}if(game.cakeReady>game.time){toast('下一张饼还没烤好，再等一会儿。');return;}selectTool('cake');if(tool==='cake')toast('点一个远离主路的空工位，把他们骗过去。');}
  function freeze(){const r=game.freeze();if(!r.ok)toast(r.reason);else{toast(`网络开小差，现有工单暂停 ${game.hasPerk('wifi')?'3.8':'2.8'} 秒。`);consumeEvents();updateUI();}}
  $('cake-btn').addEventListener('click',cake);$('freeze-btn').addEventListener('click',freeze);
  function startWave(){if(game.state!=='build')return;if(game.pendingPerks.length){systems.offer();return;}checkpoint();if(!game.towers.some(t=>t.type!=='coffee'))toast('别只顾喝咖啡，现在仍可随时建造攻击设备。');if(game.startWave()){paused=false;accumulator=0;consumeEvents();updateUI();}}
  function togglePause(){if(game.state!=='wave')return;paused=!paused;accumulator=0;updateUI();}
  $('wave-btn').addEventListener('click',startWave);$('pause-btn').addEventListener('click',togglePause);
  $('speed-btn').addEventListener('click',()=>{speed=speed===1?2:speed===2?3:1;updateUI();});
  $('path-btn').addEventListener('click',()=>{showPath=!showPath;updateUI();});
  $('sound-btn').addEventListener('click',()=>{audioEnabled=!audioEnabled;write(STORAGE.sound,audioEnabled);if(audioEnabled)sound('build');updateUI();});
  function toggleFocus(){const active=document.body.classList.toggle('focus-mode');$('focus-btn').classList.toggle('active',active);$('focus-btn').setAttribute('aria-pressed',active);window.scrollTo({top:0});updateUI();}
  $('focus-btn').addEventListener('click',toggleFocus);
  $('reset-btn').addEventListener('click',()=>{if(!game.towers.length&&!game.wave)return;if(performance.now()<resetUntil)newGame(game.level.id);else{resetUntil=performance.now()+3500;toast('再点一次重开，重新开始这一关。');updateUI();}});
  $('play-again').addEventListener('click',()=>newGame(game.level.id));
  $('next-level').addEventListener('click',()=>{const next=levelNumber()+1;if(game.state==='won'&&next<LEVELS.length)newGame(LEVELS[next].id);else openLevels();});
  $('help-btn').addEventListener('click',()=>{if(game.state==='wave'){paused=true;updateUI();}$('help-dialog').showModal();});$('close-help').addEventListener('click',()=>$('help-dialog').close());$('start-help').addEventListener('click',()=>$('help-dialog').close());
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.repeat&&!e.key.startsWith('Arrow'))return;
    if(['1','2','3','4'].includes(e.key))selectTool(['pot','bubble','reply','coffee'][Number(e.key)-1]);
    if(e.key.toLowerCase()==='q')cake();if(e.key.toLowerCase()==='e')freeze();if(e.key.toLowerCase()==='f')toggleFocus();
    if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();game.state==='build'?startWave():togglePause();}
    if(e.key==='Escape'){tool=null;selected=null;uiSignature='';checkHover();updateUI();}
    if(document.activeElement===canvas){const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(dirs[e.key]){e.preventDefault();hover||={x:9,y:5};hover.x=Math.max(0,Math.min(19,hover.x+dirs[e.key][0]));hover.y=Math.max(0,Math.min(11,hover.y+dirs[e.key][1]));checkHover();}if(e.key==='Enter'&&hover){e.preventDefault();handleCell(hover.x,hover.y);}}
  });
  function backgroundPause(){if(game.state==='wave'){paused=true;accumulator=0;updateUI();}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)backgroundPause();});window.addEventListener('blur',backgroundPause);window.addEventListener('resize',()=>renderer.resize());
  function updateUI(){
    systems.refresh();
    const active=['build','wave'].includes(game.state),record=progress[game.level.id];
    $('lives').innerHTML=`${game.lives}<em> / 20</em>`;$('life-bar').style.width=`${game.lives*5}%`;$('money').textContent=`¥ ${game.money}`;$('wave').innerHTML=`${String(game.wave).padStart(2,'0')}<em> / ${String(game.maxWaves).padStart(2,'0')}</em>`;$('kills').textContent=String(game.kills).padStart(3,'0');
    $('bonus').textContent=game.income?`绕路已薅到 ¥${game.income}`:'绕路也能产生带薪收入';$('wave-name').textContent=game.wave?game.waveName():'暴风雨前的工位';$('best').textContent=record.stars?`本关最佳 ${record.stars}/3 星 · ${record.wins} 次通关`:'本关还未通关';
    const completed=game.state==='build'||game.state==='won'?game.wave:Math.max(0,game.wave-1),seconds=Math.max(0,60-Math.floor(completed/game.maxWaves*60));$('clock').textContent=seconds===60?'01:00':`00:${String(seconds).padStart(2,'0')}`;
    $('status').textContent=game.state==='build'?'布置工位':game.state==='won'?'下班成功':game.state==='lost'?'被迫加班':paused?'正在带薪暂停':'需求正在入侵';
    $('route-info').textContent=`路线 ${game.route.length-1} 格 · ${game.level.name}`;$('map-title').textContent=`${String(levelNumber()+1).padStart(2,'0')} / ${game.level.name}`;
    $('wave-btn').disabled=game.state!=='build';$('wave-btn').innerHTML=game.state==='build'?`<span>${ui('play')}${game.pendingPerks.length?'先领取这轮福利':game.wave?'下一波，接着摸':'准备好了，开始摸鱼'}</span><small>第 ${game.wave+1} 波</small>`:game.state==='wave'?`<span>${ui('paper')}正在婉拒中</span><small>剩余 ${game.pending.length+game.enemies.length} 张</small>`:game.state==='won'?'<span>准点下班，今天结束。</span>':'<span>精神状态已经清零</span>';
    $('pause-btn').disabled=game.state!=='wave';$('pause-btn').innerHTML=`${ui(paused?'play':'pause')}${paused?'继续':'暂停'}`;$('speed-btn').innerHTML=`${ui('speed')}${speed}×`;
    $('reset-btn').innerHTML=`${ui('reset')}<span>${performance.now()<resetUntil?'确认重开':'重开'}</span>`;
    const focus=document.body.classList.contains('focus-mode');$('focus-btn').innerHTML=`${ui('expand')}<span>${focus?'退出专注':'专注'}</span>`;$('focus-btn').setAttribute('aria-pressed',focus);
    $('path-btn').innerHTML=`${ui('route')}<span>路线</span>`;$('path-btn').classList.toggle('active',showPath);$('path-btn').setAttribute('aria-pressed',showPath);
    $('sound-btn').innerHTML=`${ui(audioEnabled?'sound':'mute')}<span>声音</span>`;$('sound-btn').classList.toggle('active',audioEnabled);$('sound-btn').setAttribute('aria-pressed',audioEnabled);$('sound-btn').setAttribute('aria-label',audioEnabled?'关闭声音':'开启声音');
    document.querySelectorAll('.tower-card').forEach(b=>{b.disabled=!active;b.classList.toggle('selected',tool===b.dataset.type);b.setAttribute('aria-pressed',tool===b.dataset.type);});
    const cakeCd=Math.max(0,Math.ceil(game.cakeReady-game.time)),freezeCd=Math.max(0,Math.ceil(game.freezeReady-game.time));
    $('cake-btn').disabled=game.state!=='wave'||cakeCd>0;$('cake-btn').classList.toggle('selected',tool==='cake');$('cake-btn').setAttribute('aria-pressed',tool==='cake');$('cake-timer').textContent=cakeCd?`${cakeCd}s`:'就绪';$('cake-label').textContent=game.cake?`饼还热乎 · ${Math.ceil(game.cake.expires-game.time)} 秒`:tool==='cake'?'点击空工位，开始画饼':'全场改道 · 8 秒';
    $('freeze-btn').disabled=game.state!=='wave'||freezeCd>0;$('freeze-timer').textContent=freezeCd?`${freezeCd}s`:'就绪';
    const t=game.towers.find(t=>t.id===selected),s=t?game.statsFor(t):null,signature=`${t?.id}-${t?.level}-${t?.evolution}-${t?.targetMode}-${s?.boost}-${game.perks.join(',')}-${t?game.money>=game.upgradeCost(t):''}-${tool}-${active}`;
    if(signature!==uiSignature){uiSignature=signature;
      if(t){
        const price=game.upgradeCost(t),branch=t.evolution&&EVOLUTIONS[t.type].find(b=>b.id===t.evolution);
        $('selection-panel').innerHTML=`<div class="selection-title"><b>${branch?branch.name:s.name}</b><span>${branch?'已进化':`LV.${t.level} / 3`}</span></div><p>${t.type==='coffee'?`范围 ${s.range.toFixed(1)} 格 · 提速 ${Math.round((s.aura-1)*100)}%<br>${branch?branch.desc:'覆盖更多设备，多个咖啡不叠加。'}`:`伤害 ${Math.round(s.damage)} · 射程 ${s.range.toFixed(1)} 格${s.boost>1?' · 咖啡加持':''}<br>${branch?branch.desc:TYPES[t.type].desc}`}</p>${t.type!=='coffee'?`<label class="target-control">优先攻击<select id="target-mode"><option value="exit">快到出口的</option><option value="strong">血量最高的</option><option value="near">距离最近的</option><option value="rage">正在红温的</option></select></label><div id="tower-live-metrics" class="tower-metrics"></div>`:''}<div class="selected-actions"><button id="upgrade-btn" ${!active||t.level>=3||game.money<price?'disabled':''}>${t.level>=3?'已满级':`升级 ¥${price}`}</button><button id="sell-btn" ${!active?'disabled':''}>出售 +¥${game.sellValue(t)}</button></div>${t.level===3&&!branch?`<button id="evolve-btn" class="evolve-trigger" ${!active?'disabled':''}>选择分支进化 ${ui('arrow')}</button>`:''}`;
        if($('target-mode')){$('target-mode').value=t.targetMode||'exit';$('target-mode').disabled=!active;$('target-mode').addEventListener('change',e=>{game.setTarget(t.id,e.target.value);checkpoint();updateUI();});}
        if($('evolve-btn'))$('evolve-btn').addEventListener('click',()=>systems.evolve(t.id));
        $('upgrade-btn').addEventListener('click',()=>{const r=game.upgrade(t.id);if(!r.ok)toast(r.reason);else toast(t.level===3?'已到三级，可以选择一个专属进化分支。':'升级完成，摸鱼效率提高了。');checkpoint();consumeEvents();updateUI();});
        $('sell-btn').addEventListener('click',()=>{game.sell(t.id);selected=null;uiSignature='';checkpoint();checkHover();updateUI();});
      }else if(tool==='cake')$('selection-panel').innerHTML='<div class="selection-title"><b>饼不必真，路线得真。</b><span>准备画饼</span></div><p>点一个远离主路的空格，<br>工单会先去那里报到，再找出口。</p><small>把饼放在火力区旁，顺便赚点绕路费。</small>';
      else $('selection-panel').innerHTML=`<div class="selection-title"><b>${TYPES[tool]?`已选：${TYPES[tool].name}`:'工位生存指南'}</b><span>点击地图建造</span></div><p>${tool==='coffee'?'放在多台设备之间，提高整体输出。<br>进化可选择极限增益或经济续航。':'设备可以挡路，点已有设备可升级。<br>三级后两种进化方向，搭配本局福利。'}</p><small>Esc 取消选择 · 可自定义攻击优先级</small>`;
    }
    if(t&&$('tower-live-metrics'))$('tower-live-metrics').textContent=`本机 ${Math.round(t.damage||0)} 伤害 · ${t.kills||0} 击退 · ${t.shots||0} 发射`;
    $('map-note').style.opacity=game.wave===0?'1':'0';$('map-note').innerHTML=game.towers.length?'<b>02</b> 防线就绪，点击下方按钮开始第一波':'<b>01</b> 选一台设备，再点击空工位布防';
    $('level-rule').textContent=game.level.rule;$('rule-copy').textContent=`每多绕 6 格，入账 ¥${game.detourPay()}，每张最多 ¥${game.detourPay()*3}。走到 ${game.level.rageAt||25} 格会红温。${game.level.id==='pantry'?'黄色地砖让工单加速，提前减速拦截。':game.level.id==='archive'?'蓝色地毯可以减速，适合布置交叉火力。':'用泡泡安抚，用画饼改道，再用咖啡放大火力。'}`;
    const ps=`${game.level.id}-${game.wave}-${game.state}`;if(previewSignature!==ps){previewSignature=ps;const next=Math.min(game.maxWaves,game.wave+(game.state==='build'?1:0));$('preview-title').textContent=game.state==='won'?'今天的需求已清空':game.waveName(next);const counts={};for(const type of game.waveTypes(next))counts[type]=(counts[type]||0)+1;const names=Object.fromEntries(Object.entries(ENEMY_INFO).map(([id,e])=>[id,e.name]));$('enemy-preview').innerHTML=game.state==='won'?'':Object.entries(counts).map(([type,n])=>`<span class="enemy-badge ${type}">${names[type]} ×${n}</span>`).join('');}
    $('save-indicator').innerHTML=`${ui('save')}${storageOK?'按波次自动存档':'当前无法保存到本机'}`;
    $('coord').textContent=hover?`WORKSTATION ${String.fromCharCode(65+hover.y)}${String(hover.x+1).padStart(2,'0')}`:`SUNSHINE OFFICE / ${String(levelNumber()+1).padStart(2,'0')}`;
    const hs=`${game.pathVersion}-${game.money}-${Math.floor(game.time*2)}`;if(hoverSignature!==hs){hoverSignature=hs;checkHover();}
  }
  function consumeEvents(){for(const e of game.takeEvents()){
    renderer.event(e);
    if(['build','kill','cake','leak','wave','clear','freeze','evolve'].includes(e.type))sound(e.type);
    if(e.type==='perk-offer')systems.offer();
    if(e.type==='wave')toast(`第 ${e.wave} 波：${e.name}`);
    if(e.type==='clear'){toast(`这一波已婉拒，补发摸鱼预算 ¥${e.bonus}。`);checkpoint();}
    if(e.type==='end'&&!shownEnd){shownEnd=true;paused=false;clearCheckpoint();if(e.won)saveVictory();renderChapters();const stars=e.won?(game.lives>=16?3:game.lives>=8?2:1):0;$('result-overlay').classList.remove('hidden');$('result-illustration').innerHTML=icon(e.won?'fish':'boss');$('result-tag').textContent=e.won?'OUT OF OFFICE. RIGHT ON TIME.':'ONE MORE TRY, ONE LESS MEETING.';$('result-title').textContent=e.won?'今天的班，就上到这。':'这次，需求抢先一步。';$('result-stars').innerHTML=Array.from({length:3},(_,i)=>`<span class="${i<stars?'':'empty'}">${icon('star')}</span>`).join('');$('result-description').textContent=`${game.level.name} · 婉拒 ${game.kills} 张 · 绕路收入 ¥${game.income}。${e.won?'这份下班成绩已经存好了。':'试试咖啡配群攻，再把需求骗回防线。'}`;$('next-level').innerHTML=`${e.won&&levelNumber()<LEVELS.length-1?'前往下一关':'选择其他关卡'} ${ui('arrow')}`;}
  }}
  function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(game.state==='wave'&&!paused){accumulator+=dt*speed;while(accumulator>=1/60){game.update(1/60);accumulator-=1/60;}consumeEvents();}else accumulator=0;if(now-lastUI>100){updateUI();lastUI=now;}renderer.render(game,{tool,selected,hover,hoverCheck,paused,showPath},dt);requestAnimationFrame(frame);}
  renderChapters();updateUI();requestAnimationFrame(frame);
})();
