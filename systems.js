(() => {
  'use strict';
  const {TYPES,EVOLUTIONS,PERKS,ENEMY_INFO}=FridayEngine;
  const {icon,ui}=FridayArt;
  const $=id=>document.getElementById(id);
  const integer=n=>Math.round(n||0).toLocaleString('zh-CN');
  window.FridaySystems={create(adapter){
    let tab='report',signature='';
    const game=adapter.getGame;
    function show(dialog){adapter.pause();if(!dialog.open)dialog.showModal();}
    function afterChange(){signature='';adapter.changed();refresh();}
    function offer(){
      const g=game();if(!g.pendingPerks.length){intel('perks');return;}
      $('perk-options').innerHTML=g.pendingPerks.map(id=>{const p=PERKS.find(p=>p.id===id);return `<button class="perk-choice" data-perk="${id}"><span class="perk-category">${p.category}福利</span><span class="perk-art">${icon(p.icon)}</span><h3>${p.name}</h3><p>${p.desc}</p><span class="choice-action">就选这个 ${ui('arrow')}</span></button>`;}).join('');
      $('perk-options').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const p=PERKS.find(p=>p.id===b.dataset.perk),r=g.choosePerk(p.id);if(r.ok){$('perk-dialog').close();adapter.toast(`已领取「${p.name}」，本关持续生效。`);afterChange();}}));
      show($('perk-dialog'));
    }
    function evolve(id){
      const g=game(),t=g.towers.find(t=>t.id===id);if(!t||t.level!==3||t.evolution)return;
      $('evolve-title').textContent=`${TYPES[t.type].name}，走哪条路？`;
      $('evolve-options').innerHTML=EVOLUTIONS[t.type].map((e,i)=>`<button class="evolution-choice branch-${i}" data-branch="${e.id}" ${g.money<e.cost?'disabled':''}><span class="perk-category">${e.tag}</span><span class="evolution-art">${icon(e.id)}<b>${i?'B':'A'}</b></span><h3>${e.name}</h3><p>${e.desc}</p><span class="choice-action">${g.money<e.cost?'经费不足':'确认进化'} · ¥${e.cost}</span></button>`).join('');
      $('evolve-options').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const r=g.evolve(id,b.dataset.branch);if(r.ok){$('evolve-dialog').close();adapter.toast('分支进化完成，试试和福利搭配。');afterChange();}else adapter.toast(r.reason);}));
      show($('evolve-dialog'));
    }
    function report(){
      const g=game(),stats=g.stats,max=Math.max(1,...Object.values(stats.byType).map(s=>s.damage));
      const bars=Object.entries(TYPES).map(([type,t])=>{const v=stats.byType[type];return `<div class="damage-row"><span class="report-art">${icon(type)}</span><div><span class="damage-name">${t.name}<small>${type==='coffee'?'支援增益计入攻击设备':`${integer(v.damage)} 伤害 · ${v.kills} 击退`}</small></span><div class="damage-track"><i style="width:${v.damage/max*100}%;background:${t.color}"></i></div></div></div>`;}).join('');
      const branches=g.towers.filter(t=>t.evolution);
      return `<div class="report-summary"><div><small>累计有效伤害</small><strong>${integer(stats.damage)}</strong></div><div><small>婉拒 / 漏过</small><strong>${g.kills}<em> / ${stats.leaked}</em></strong></div><div><small>累计收入</small><strong>¥${integer(stats.earned)}</strong></div><div><small>累计投入</small><strong>¥${integer(stats.spent)}</strong></div></div><div class="report-columns"><section><h3>谁在认真干活？</h3>${bars}<p class="dialog-hint">含已售设备；有效伤害包含护盾，溢出伤害不计入。</p></section><section class="report-notes"><h3>本局战术笔记</h3><p>画饼 <b>${stats.cakes}</b> 次，断网 <b>${stats.freezes}</b> 次。</p><p>绕路赚到 <b>¥${g.income}</b>，累计修复 <b>${stats.healing}</b> 精神。</p><p>已领取 <b>${g.perks.length}</b> 项福利，完成 <b>${stats.evolutions}</b> 次进化。</p><div class="branch-tags">${branches.map(t=>`<span>${EVOLUTIONS[t.type].find(b=>b.id===t.evolution).name}</span>`).join('')||'<small>三级设备可选择专属进化方向。</small>'}</div></section></div>`;
    }
    function intel(next=tab){
      tab=next;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
      if(tab==='report')$('intel-content').innerHTML=report();
      else if(tab==='enemies')$('intel-content').innerHTML=`<div class="enemy-codex">${Object.entries(ENEMY_INFO).map(([id,e])=>`<article><span class="codex-art">${icon(e.icon)}</span><h3>${e.name}</h3><p>${e.desc}</p><small>${e.counter}</small></article>`).join('')}</div>`;
      else{const g=game();$('intel-content').innerHTML=`<p class="dialog-intro">同一福利本局只会获得一次，效果可以与设备进化组合。下次领取：${g.wave>=g.maxWaves?'本关已结束':g.pendingPerks.length?'现在可领':`守住第 ${Math.min(g.maxWaves,Math.floor(g.wave/2)*2+2)} 波后`}</p><div class="perk-library">${PERKS.map(p=>`<article class="${g.hasPerk(p.id)?'owned':''}"><span>${icon(p.icon)}</span><div><h3>${p.name}<em>${g.hasPerk(p.id)?'已拥有':p.category}</em></h3><p>${p.desc}</p></div></article>`).join('')}</div>`;}
      show($('intel-dialog'));
    }
    function refresh(){const g=game(),s=`${g.level.id}:${g.perks.join(',')}:${g.pendingPerks.join(',')}:${g.state}`;if(signature===s)return;signature=s;$('owned-perks').innerHTML=g.perks.length?g.perks.map(id=>{const p=PERKS.find(p=>p.id===id);return `<span class="owned-perk" title="${p.desc}">${icon(p.icon)}${p.name}</span>`;}).join(''):'<span class="perk-empty">每守住 2 波，三选一领福利；三级设备还可分支进化。</span>';$('perk-btn').textContent=g.pendingPerks.length?'有福利待领取':'查看福利组合';$('perk-btn').classList.toggle('pending',!!g.pendingPerks.length);}
    function reset(){for(const id of ['perk-dialog','evolve-dialog','intel-dialog'])if($(id).open)$(id).close();signature='';refresh();}
    $('perk-btn').addEventListener('click',offer);$('intel-btn').addEventListener('click',()=>intel('report'));
    for(const [button,dialog]of [['close-perks','perk-dialog'],['close-evolve','evolve-dialog'],['close-intel','intel-dialog']])$(button).addEventListener('click',()=>$(dialog).close());
    document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>intel(b.dataset.tab)));
    return {offer,evolve,intel,refresh,reset};
  }};
})();
