/* Optional offline UI integration test. Uses an isolated HEADLESS Chrome profile,
   Node's native WebSocket/CDP, and no browser UI or third-party packages. */
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const {Game}=require('../engine.js');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=process.env.FRIDAY_CHROME_BINARY||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'friday-v3-headless-'));
 const child=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--mute-audio','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let log='',ws,id=0;const pending=new Map(),errors=[],external=[];child.stderr.on('data',b=>{log=(log+b).slice(-3000);});
 child.on('error',e=>{log=e.message;});
 let call;
 try{
  let port;
  for(let i=0;i<120;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch(_){await delay(100);}}
  assert.ok(port,`Headless Chrome startup failed: ${log}`);
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const entry=pending.get(msg.id);if(entry){clearTimeout(entry.timer);pending.delete(msg.id);msg.error?entry.reject(new Error(JSON.stringify(msg.error))):entry.resolve(msg.result);}}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);else if(msg.method==='Network.requestWillBeSent'&&/^https?:/.test(msg.params.request.url))external.push(msg.params.request.url);});
  ws.addEventListener('close',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Headless target closed'));}pending.clear();});
  call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(new Error(`CDP timeout: ${method}`));},15000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const waitFor=async(expression,timeout=10000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await delay(80);}throw new Error(`UI timeout: ${expression}`);};
  const click=async selector=>{await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await delay(40);};
  const cell=async(x,y)=>{const pos=await evaluate(`(()=>{const r=document.getElementById('game').getBoundingClientRect();return {x:r.x+(50+(${x}+.5)*45)/1000*r.width,y:r.y+(65+(${y}+.5)*45)/650*r.height};})()`);await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos});await delay(60);};
  const screenshot=async name=>{const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(os.tmpdir(),name),Buffer.from(r.data,'base64'));};
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
  const file=path.resolve(__dirname,'..',process.argv[2]||'index.html');
  await call('Page.navigate',{url:pathToFileURL(file).href});
  await waitFor(`document.readyState==='complete'&&document.querySelectorAll('.tower-card').length===4`);
  assert.equal(await evaluate(`document.querySelectorAll('.chapter-chip').length`),6);
  assert.equal(await evaluate(`Object.values(FridayArt.sprites).every(img=>img.complete&&img.naturalWidth>0)`),true);
  await screenshot('friday-v3-main.png');

  // A late-wave fixture isolates the new controls without modifying user data.
  const fixture=new Game('intern',{seed:88});fixture.money=800;
  const tower=fixture.build(6,5,'pot').tower;fixture.upgrade(tower.id);fixture.upgrade(tower.id);fixture.build(10,5,'pot');fixture.build(8,6,'bubble');
  fixture.wave=2;fixture.offerPerks();const snap=fixture.snapshot();
  await evaluate(`localStorage.setItem('friday1759-checkpoint-v2',${JSON.stringify(JSON.stringify(snap))})`);
  await call('Page.reload');await waitFor(`document.readyState==='complete'&&document.getElementById('resume-btn')`);await click('#resume-btn');
  await waitFor(`document.getElementById('perk-dialog').open`);assert.equal(await evaluate(`document.querySelectorAll('.perk-choice').length`),3);
  await screenshot('friday-v3-perks.png');await click('.perk-choice');await waitFor(`!document.getElementById('perk-dialog').open`);
  assert.equal(await evaluate(`document.querySelectorAll('.owned-perk').length`),1);
  await click('#focus-btn');await cell(6,5);await waitFor(`!!document.getElementById('evolve-btn')`);
  await click('#evolve-btn');await screenshot('friday-v3-evolution.png');await click('[data-branch="ricochet"]');
  await waitFor(`document.querySelector('.selection-title').textContent.includes('甩锅接力')`);
  await evaluate(`document.getElementById('target-mode').value='strong';document.getElementById('target-mode').dispatchEvent(new Event('change',{bubbles:true}))`);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('friday1759-checkpoint-v2')).towers[0].targetMode`),'strong');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('friday1759-checkpoint-v2')).towers[0].evolution`),'ricochet');
  await click('#wave-btn');await click('#speed-btn');await click('#speed-btn');await delay(2500);await click('#pause-btn');
  assert.ok((await evaluate(`document.getElementById('tower-live-metrics').textContent`)).includes('伤害'));
  await click('#perk-btn');await waitFor(`document.getElementById('intel-dialog').open`);await click('[data-tab="report"]');
  assert.equal(await evaluate(`document.querySelectorAll('.damage-row').length`),4);await screenshot('friday-v3-report.png');
  await click('[data-tab="enemies"]');assert.equal(await evaluate(`document.querySelectorAll('.enemy-codex article').length`),8);
  await click('[data-tab="perks"]');assert.equal(await evaluate(`document.querySelectorAll('.perk-library article').length`),12);await click('#close-intel');
  await call('Page.reload');await waitFor(`document.readyState==='complete'&&document.getElementById('resume-btn')`);await click('#resume-btn');
  await cell(6,5);assert.ok((await evaluate(`document.querySelector('.selection-title').textContent`)).includes('甩锅接力'));
  const automatic={...snap,wave:1,pendingPerks:[],perks:[]};
  await evaluate(`localStorage.setItem('friday1759-checkpoint-v2',${JSON.stringify(JSON.stringify(automatic))})`);
  await call('Page.reload');await waitFor(`document.readyState==='complete'&&document.getElementById('resume-btn')`);await click('#resume-btn');
  await click('#speed-btn');await click('#speed-btn');await click('#wave-btn');
  await waitFor(`document.getElementById('perk-dialog').open`,30000);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('friday1759-checkpoint-v2')).wave`),2);
  await click('.perk-choice');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('friday1759-checkpoint-v2')).perks.length`),1);
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await delay(200);
  assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),'mobile must not overflow');
  await screenshot('friday-v3-mobile.png');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(JSON.stringify({file:path.basename(file),mode:'isolated headless',maps:6,equipment:4,perkChoices:3,codexEntries:8,perkLibrary:12,evolution:'ricochet',targeting:'strong',checkpoint:'restored',automaticWaveReward:'passed',mobile:'no overflow',pageErrors:errors,externalRequests:external},null,2));
 }finally{
  if(call&&ws?.readyState===WebSocket.OPEN)await call('Browser.close').catch(()=>{});
  if(ws&&ws.readyState!==WebSocket.CLOSED)ws.close();
  if(child.exitCode===null){child.kill('SIGTERM');await delay(300);}
  await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
