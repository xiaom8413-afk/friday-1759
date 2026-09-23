(() => {
  'use strict';
  const {TYPES,COLS,ROWS,ENTRY,key,distance}=FridayEngine;
  const {sprites}=FridayArt;
  const CELL=45,OX=50,OY=65,W=1000,H=650;
  const px=x=>OX+(x+.5)*CELL,py=y=>OY+(y+.5)*CELL;
  class Renderer {
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.effects=[];this.particles=[];this.time=0;this.resize();}
    resize(){const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=W*dpr;this.canvas.height=H*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);}
    rect(x,y,w,h,r,fill,stroke){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
    text(s,x,y,size,color,align='center',weight='400'){const c=this.ctx;c.fillStyle=color;c.font=`${weight} ${size}px Arial,"PingFang SC",sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillText(s,x,y);}
    sprite(name,x,y,size=48,alpha=1){const image=sprites[name];if(!image?.complete||!image.naturalWidth)return;const c=this.ctx;c.save();c.globalAlpha*=alpha;c.drawImage(image,x-size/2,y-size/2,size,size);c.restore();}
    burst(x,y,color,count=10){for(let i=0;i<count&&this.particles.length<250;i++){const a=Math.random()*Math.PI*2,v=25+Math.random()*75;this.particles.push({x:px(x),y:py(y),vx:Math.cos(a)*v,vy:Math.sin(a)*v,age:0,life:.5+Math.random()*.5,color,size:2+Math.random()*3});}}
    float(x,y,text,color='#558768',life=1.2){this.effects.push({type:'text',x:px(x),y:py(y)-18,text,color,age:0,life});}
    event(e){
      if(e.type==='evolve'){this.burst(e.x,e.y,e.color,25);this.float(e.x,e.y,e.name,e.color,1.8);}
      if(e.type==='chain')this.effects.push({type:'chain',x:px(e.x),y:py(e.y),tx:px(e.tx),ty:py(e.ty),age:0,life:.32});
      if(e.type==='heal'){this.float(e.x,e.y,'同事们打起精神！','#83a576');this.effects.push({type:'ring',x:px(e.x),y:py(e.y),radius:103,color:'#91b686',age:0,life:.7});}
      if(e.type==='rally'){this.float(e.x,e.y,'紧急催办！现在就要！','#cf8c6e',1.8);this.effects.push({type:'ring',x:px(e.x),y:py(e.y),radius:135,color:'#d49a79',age:0,life:1});}
      if(e.type==='split')this.float(e.x,e.y,'再追加两个小需求','#b69569');
      if(e.type==='build')this.burst(e.x,e.y,e.color,10);
      if(e.type==='kill'){this.burst(e.x,e.y,e.boss?'#dc9b7f':'#97b586',e.boss?30:8);if(e.boss)this.float(e.x,e.y,'领导已离线','#c88168',1.8);else if(e.reward>7)this.float(e.x,e.y,'收到（不做）','#799069');}
      if(e.type==='income')this.float(e.x,e.y,`带薪 +¥${e.amount}`,'#719454');
      if(e.type==='rage')this.float(e.x,e.y,'急急急！','#c96d58',.9);
      if(e.type==='eat')this.float(e.x,e.y,'就这？','#b98d51');
      if(e.type==='cake'){this.burst(e.x,e.y,'#dfb677',22);this.float(e.x,e.y,'明年给你涨薪','#b68b51',2);}
      if(e.type==='leak')this.float(e.x,e.y,`精神 −${e.amount}`,'#c57262');
      if(e.type==='meeting'){this.float(e.x,e.y,'停一下！开个短会！','#9e85b1',1.8);this.effects.push({type:'ring',x:px(e.x),y:py(e.y),radius:94,color:'#ae96c6',age:0,life:1.2});}
      if(e.type==='freeze'){this.effects.push({type:'freeze',age:0,life:1.4});}
      if(e.type==='impact')this.effects.push({type:'ring',x:px(e.x),y:py(e.y),radius:e.radius*CELL,color:TYPES[e.kind].color,age:0,life:.4,label:e.kind==='reply'?'收到':null});
      if(this.effects.length>140)this.effects.splice(0,this.effects.length-140);
    }
    route(points,color,width=2,dashed=true){if(!points?.length)return;const c=this.ctx;c.save();c.beginPath();c.moveTo(px(points[0].x),py(points[0].y));for(const p of points.slice(1))c.lineTo(px(p.x),py(p.y));c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';if(dashed){c.setLineDash([3,10]);c.lineDashOffset=-this.time*13;}c.stroke();c.restore();}
    board(g,showPath){
      const c=this.ctx;c.fillStyle='#f0f3e8';c.fillRect(0,0,W,H);
      const grad=c.createLinearGradient(0,0,W,H);grad.addColorStop(0,'#fffced80');grad.addColorStop(1,g.level.accent);c.fillStyle=grad;c.fillRect(0,0,W,H);
      this.rect(OX-8,OY-8,COLS*CELL+16,ROWS*CELL+16,10,'#e1e8d3');
      this.rect(OX-4,OY-4,COLS*CELL+8,ROWS*CELL+8,7,'#f7f8ef','#cbd8bb');
      for(let x=0;x<COLS;x++)for(let y=0;y<ROWS;y++){
        c.fillStyle=(x+y)%2?'#f2f4e8':'#f6f7ed';c.fillRect(OX+x*CELL+1,OY+y*CELL+1,CELL-2,CELL-2);
        const zone=g.zones.get(key(x,y));if(zone){const color=zone==='coffee'?'#f4dfac':'#d8e9ec';this.rect(OX+x*CELL+2,OY+y*CELL+2,CELL-4,CELL-4,4,color);c.strokeStyle=zone==='coffee'?'#d3b98466':'#a7c6ce88';c.beginPath();for(let i=0;i<3;i++){c.moveTo(OX+x*CELL+9,OY+y*CELL+11+i*10);c.lineTo(OX+x*CELL+CELL-9,OY+y*CELL+11+i*10);}c.stroke();}
      }
      if(showPath){this.route(g.route,'#d9e7ca',13,false);this.route(g.route,'#9db88d',2.3);if(g.cake)this.route(g.pathFor(ENTRY,{ate:null}),'#cb9f60',2.8);}
      for(let x=0;x<COLS;x++)this.text(String(x+1).padStart(2,'0'),px(x),OY-16,8,'#a9b696');
      for(let y=0;y<ROWS;y++)this.text(String.fromCharCode(65+y),OX-15,py(y),8,'#a9b696');
      for(const [x,y] of g.level.rocks){
        const X=px(x),Y=py(y);
        this.rect(X-18,Y-12,36,33,6,'#dce3ce');
        if(['intern','rooftop'].includes(g.level.id))this.sprite('plant',X,Y-1,42);
        else if(g.level.id==='meeting'){this.rect(X-19,Y-17,38,33,5,'#d8c3ac','#bbac93');this.rect(X-13,Y-11,26,21,3,'#efdfc5');c.fillStyle='#fff9ed';c.fillRect(X-6,Y-8,11,12);c.strokeStyle='#b9baa1';c.beginPath();c.moveTo(X-3,Y-4);c.lineTo(X+3,Y-4);c.stroke();}
        else{this.rect(X-17,Y-20,34,35,5,'#d5dfc9','#9fb197');this.rect(X-12,Y-15,24,9,2,'#eff3e6');for(let i=0;i<3;i++){this.rect(X-12,Y-1+i*5,24,3,1,'#b1c0a2');}this.text('FILE',X,Y+23,6,'#a6b198');}
      }
      // Hand-drawn in-tray and an inviting, open door.
      this.rect(OX-23,py(5)-25,52,55,8,'#e7caae','#b99b7e');this.rect(OX-19,py(5)-29,44,31,6,'#f2dcc3','#b99b7e');
      c.strokeStyle='#be9971';c.lineWidth=2;c.beginPath();c.moveTo(OX-10,py(5)-4);c.lineTo(OX+8,py(5)-4);c.moveTo(OX+2,py(5)-10);c.lineTo(OX+8,py(5)-4);c.lineTo(OX+2,py(5)+2);c.stroke();
      const ex=px(19);this.rect(ex-18,py(5)-35,49,68,7,'#8dbaa0','#668e74');this.rect(ex-10,py(5)-26,33,59,3,'#d8e7ba','#84a382');this.rect(ex-8,py(5)-23,29,12,2,'#fff9db');this.text('EXIT',ex+6,py(5)-17,7,'#718957','center','700');c.beginPath();c.arc(ex-4,py(5)+5,2,0,Math.PI*2);c.fillStyle='#80a074';c.fill();
      if(!g.wave&&!g.towers.length){for(const [x,y] of [[7,5],[10,5],[12,6]])if(!g.blocked.has(key(x,y))){c.save();c.setLineDash([3,5]);this.rect(px(x)-17,py(y)-17,34,34,5,null,'#b7c9a1');c.restore();c.beginPath();c.moveTo(px(x)-5,py(y));c.lineTo(px(x)+5,py(y));c.moveTo(px(x),py(y)-5);c.lineTo(px(x),py(y)+5);c.strokeStyle='#a1b68a';c.stroke();}this.text('用设备，给需求绕个远路。',px(9.5),py(8.7),13,'#a2b191');}
      this.text(g.level.name+' / '+g.level.rule,OX+5,626,8,'#9cae8a','left');this.text('TAKE A BREAK. TAKE YOUR TIME.',946,626,7,'#afba9e','right');
    }
    range(x,y,radius,color){const c=this.ctx;c.save();c.beginPath();c.arc(px(x),py(y),radius*CELL,0,Math.PI*2);c.fillStyle=color+'0c';c.fill();c.strokeStyle=color+'66';c.lineWidth=1.5;c.setLineDash([4,7]);c.stroke();c.restore();}
    tower(t,g,selected,ghost=false){const c=this.ctx,X=px(t.x),Y=py(t.y),color=TYPES[t.type].color;c.save();if(ghost)c.globalAlpha=.48;this.sprite(t.evolution||t.type,X,Y-3,52);if(!ghost){for(let i=0;i<t.level;i++){c.fillStyle=color+'99';c.beginPath();c.arc(X-(t.level-1)*4+i*8,Y+24,1.8,0,Math.PI*2);c.fill();}if(g.statsFor(t).boost>1){c.beginPath();c.arc(X+17,Y-20,4,0,Math.PI*2);c.fillStyle='#e1b060';c.fill();c.strokeStyle='#fff7e3';c.lineWidth=1;c.stroke();}}
      if(t.evolution){c.save();c.translate(X-17,Y-20);c.rotate(Math.PI/4);this.rect(-4,-4,8,8,1,'#e7bf77','#af945c');c.restore();}
      if(selected===t.id){c.lineWidth=1.5;this.rect(X-23,Y-27,46,55,8,null,color+'99');}c.restore();}
    enemy(e,g,paused){
      const c=this.ctx,X=px(e.x),Y=py(e.y),boss=e.type==='boss',size=boss?23:e.mini?9:e.type==='armor'?15:12;
      const bob=paused||e.holdUntil>g.time?0:Math.sin(this.time*12+e.id)*1.3;
      c.save();c.translate(X,Y+bob);c.beginPath();c.ellipse(0,size+5,size*.9,4,0,0,Math.PI*2);c.fillStyle='#5a775521';c.fill();
      if(boss){this.sprite('boss',0,0,61);}
      else{
        const colors={normal:'#fff9e3',fast:'#f1e7ab',armor:'#c8d9da',meeting:'#e1cde9',shield:'#c7e0e9',healer:'#d8e9c6',splitter:'#eddbb8'};
        const fill=e.rage?'#f5c1ad':e.flash>g.time?'#ffffff':colors[e.type];
        if(e.type==='armor'||e.type==='splitter'){this.rect(-size+5,-size-4,size*2,size*2,3,'#9db2b2','#7e9997');this.rect(-size+2,-size-2,size*2,size*2,3,'#b7cace','#7e9997');}
        c.strokeStyle='#76927f';c.lineWidth=1.4;this.rect(-size,-size,size*2,size*2,3,fill,e.rage?'#ba7e68':'#799584');
        c.fillStyle='#c2c9a5';c.fillRect(-size+4,-size+4,size*2-8,2);
        c.fillStyle='#496b59';c.fillRect(-6,-1,2.7,3);c.fillRect(3,-1,2.7,3);
        c.beginPath();c.moveTo(-3,size-5);c.quadraticCurveTo(0,size-3,4,size-5);c.strokeStyle='#73906d';c.stroke();
        const leg=Math.sin(this.time*13+e.id)*2;c.beginPath();c.moveTo(-5,size);c.lineTo(-6-leg,size+5);c.lineTo(-9-leg,size+5);c.moveTo(5,size);c.lineTo(6+leg,size+5);c.lineTo(9+leg,size+5);c.strokeStyle='#74917d';c.lineWidth=1.8;c.stroke();
        if(e.type==='fast'){c.beginPath();c.moveTo(-size-5,-3);c.lineTo(-size-10,-3);c.moveTo(-size-5,3);c.lineTo(-size-8,3);c.strokeStyle='#b8a867';c.stroke();}
        if(e.type==='meeting'){this.rect(size-4,-size-12,20,12,4,'#f6eafb','#baa3c9');this.text('···',size+6,-size-7,9,'#a188b1');}
      }
      if(e.shield>0){c.beginPath();c.arc(0,0,size+5,-Math.PI/2,-Math.PI/2+Math.PI*2*e.shield/e.maxShield);c.strokeStyle='#7aaec7';c.lineWidth=3;c.stroke();}
      if(e.type==='healer'){c.strokeStyle='#82a76d';c.lineWidth=2;c.beginPath();c.moveTo(size+2,-size-5);c.lineTo(size+10,-size-5);c.moveTo(size+6,-size-9);c.lineTo(size+6,-size-1);c.stroke();}
      if(e.vulnerableUntil>g.time){c.save();c.setLineDash([2,4]);c.strokeStyle='#b49ac3';this.rect(-size-5,-size-5,size*2+10,size*2+10,5,null,'#b49ac3');c.restore();}
      if(e.dotUntil>g.time){for(let i=0;i<3;i++){c.beginPath();c.arc(-6+i*6,size+9,1.7,0,Math.PI*2);c.fillStyle='#c8a468';c.fill();}}
      if(e.slowUntil>g.time){c.beginPath();c.arc(0,0,size+6,0,Math.PI*2);c.fillStyle='#addfed30';c.fill();c.strokeStyle='#7cbdcbbb';c.lineWidth=1.5;c.stroke();}
      if(e.rage){c.beginPath();c.moveTo(size+3,-size-1);c.lineTo(size+9,-size-9);c.lineTo(size+6,-size-1);c.lineTo(size+12,-size-3);c.strokeStyle='#d1886c';c.lineWidth=2;c.stroke();}
      if(e.holdUntil>g.time)this.text('稍等…',0,size+16,8,'#a48eae');
      const bar=size*2+4;this.rect(-bar/2,-size-10,bar,3,1.5,'#d4dcc9');this.rect(-bar/2,-size-10,bar*Math.max(0,e.hp/e.maxHp),3,1.5,e.rage?'#df9b81':'#92b682');
      if(boss)this.text(e.name,0,size+18,10,'#b17f66','center','600');c.restore();
    }
    render(g,v,dt){
      const c=this.ctx;if(!v.paused)this.time+=dt;c.clearRect(0,0,W,H);this.board(g,v.showPath);
      const selected=g.towers.find(t=>t.id===v.selected);if(selected){this.range(selected.x,selected.y,g.statsFor(selected).range,TYPES[selected.type].color);if(selected.type==='coffee')for(const t of g.towers)if(t.type!=='coffee'&&distance(t,selected)<=g.statsFor(selected).range)this.route([selected,t],'#c49a55',1.5);}
      if(v.hover&&v.tool&&['build','wave'].includes(g.state)){
        const color=v.hoverCheck?.ok?(v.tool==='cake'?'#c49a5e':TYPES[v.tool].color):'#d6947d';
        this.rect(OX+v.hover.x*CELL+1,OY+v.hover.y*CELL+1,CELL-2,CELL-2,5,color+'20',color+'99');
        if(TYPES[v.tool]&&!g.blocked.has(key(v.hover.x,v.hover.y))){this.range(v.hover.x,v.hover.y,TYPES[v.tool].range,color);this.tower({...v.hover,type:v.tool,level:1},g,null,true);}
        if(v.tool==='cake')this.sprite('cake',px(v.hover.x),py(v.hover.y),43,.65);
      }
      for(const t of g.towers)this.tower(t,g,v.selected);
      if(g.cake){this.range(g.cake.x,g.cake.y,.7,'#c49a5e');this.sprite('cake',px(g.cake.x),py(g.cake.y)-4,50);this.text('明年涨薪',px(g.cake.x),py(g.cake.y)+30,8,'#ba985e');}
      for(const e of [...g.enemies].sort((a,b)=>a.y-b.y))this.enemy(e,g,v.paused);
      for(const p of g.projectiles){c.save();c.translate(px(p.x),py(p.y));c.rotate(p.age*14);if(p.type==='pot'){c.globalAlpha=p.returning?.6:1;c.beginPath();c.arc(0,0,5,0,Math.PI*2);c.fillStyle='#9ac5a7';c.fill();c.strokeStyle='#528568';c.lineWidth=1.5;c.stroke();c.fillStyle='#ae8b61';c.fillRect(4,-1.5,7,3);}else if(p.type==='bubble'){c.beginPath();c.arc(0,0,7,0,Math.PI*2);c.fillStyle='#9cd4df55';c.fill();c.strokeStyle='#72aec2';c.stroke();}else{this.rect(-7,-5,14,10,2,'#ebc498','#bd9c73');}c.restore();}
      const effectDt=v.paused?0:dt;
      for(const p of this.particles){p.age+=effectDt;p.x+=p.vx*effectDt;p.y+=p.vy*effectDt;p.vy+=60*effectDt;c.globalAlpha=Math.max(0,1-p.age/p.life);c.fillStyle=p.color;c.fillRect(p.x,p.y,p.size,p.size);}this.particles=this.particles.filter(p=>p.age<p.life);c.globalAlpha=1;
      for(const e of this.effects){e.age+=effectDt;const f=Math.min(1,e.age/e.life);c.globalAlpha=1-f;if(e.type==='text')this.text(e.text,e.x,e.y-f*36,12,e.color,'center','600');else if(e.type==='chain'){c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.tx,e.ty);c.lineWidth=2;c.strokeStyle='#83ae73';c.setLineDash([4,3]);c.stroke();c.setLineDash([]);}else if(e.type==='freeze'){c.fillStyle='#b5c6eb33';c.fillRect(OX,OY,COLS*CELL,ROWS*CELL);this.text('网络开小差，全员先歇会儿。',500,90,14,'#8b99bd');}else{c.beginPath();c.arc(e.x,e.y,e.radius*(.3+.7*f),0,Math.PI*2);c.lineWidth=2*(1-f);c.strokeStyle=e.color;c.fillStyle=e.color+'0b';c.fill();c.stroke();if(e.label){c.save();c.translate(e.x,e.y);c.rotate(-.2);this.rect(-21,-11,42,22,3,'#fff8e788',e.color);this.text(e.label,0,0,13,e.color,'center','bold');c.restore();}}}c.globalAlpha=1;this.effects=this.effects.filter(e=>e.age<e.life);
      if(v.paused&&g.state==='wave'){this.rect(373,17,254,40,8,'#fffdf2ed','#d3e0bc');this.text('正在带薪暂停 · 点击继续',500,37,12,'#769565');}
    }
  }
  window.FridayRenderer={Renderer,CELL,OX,OY,W,H};
})();
