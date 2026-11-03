/* Run with Node 24 and a Chromium CDP endpoint at localhost:9222.
   Start the static game server at localhost:8000 first. No npm install. */
import assert from 'node:assert/strict';
const target = await (await fetch('http://127.0.0.1:9222/json/new?about:blank', {method:'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, {once:true}));
let seq=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},180000);pending.set(id,m=>{clearTimeout(timer);resolve(m);});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.error||r.result?.exceptionDetails)throw Error(JSON.stringify(r));return r.result?.result?.value;};
async function wait(expression,timeout=45000){const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,200));}throw Error('wait failed: '+expression);}
async function navigate(path=''){await send('Page.navigate',{url:'http://127.0.0.1:8000/'+path});await wait("typeof Py !== 'undefined' && document.querySelector('#title')?.classList.contains('active')",90000);}
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
try {
 await send('Page.enable');
 await navigate();
 await evaluate("localStorage.removeItem(SAVE_KEY); G.save=blankSave('Alex'); SFX.on=false;");
 await test('new game, continue, map, home unlocks and save code round trip',async()=>{
  const v=await evaluate(`(async()=>{ $('#heroName').value='Alex';await $('#btnNew').onclick();const fresh=G.mode==='map'&&chapterOpen(CHAPTERS[0])&&!chapterOpen(CHAPTERS[1]);G.save.progress[1]=mainCount(CHAPTERS[0]);G.save.progress[2]=mainCount(CHAPTERS[1]);persist();const code=makeSaveCode(),p=parseSaveCode(code),restored=applySaveCode(p.c,p.m,'Alex');renderTitle();$('#btnContinue').onclick();return {fresh,mode:G.mode,code,p,restored,open3:chapterOpen(CHAPTERS[2]),extension:chapterOpen(CHAPTERS[5])};})()`);
  assert(v.fresh);assert.equal(v.mode,'map');assert(v.open3);assert(v.extension);assert.equal(v.restored.progress[2],3);
 });
 await test('all 23 main/bonus reference programs pass real Pyodide checks',async()=>{
  const results=await evaluate(`(async()=>{const original=InputUI.open;let current='';InputUI.open=(prompt,done)=>{const values={c3m1:'Alex',c3m2:'5',c3m3:'30',c3b1:'10',c4b1:'10',c5m2:'25',c5m3:'25',c5m4:'25',c5m5:'25'};setTimeout(()=>done(values[current]||'5'),5);};const results=[];try{for(const ch of CHAPTERS.filter(x=>!x.extension)){for(const m of ch.missions){current=m.id;const code=answerOf(m),r=await Py.run(code,WATCH,knownNames(m));const fail=r.ok?await runChecks(m,r,code):r.error;results.push({id:m.id,ok:r.ok,fail,output:r.output});}}}finally{InputUI.open=original;}return results;})()`);
  assert.equal(results.length,23);assert.deepEqual(results.filter(x=>!x.ok||x.fail),[]);
 });
 await test('functions extension remains executable and is not required for finale',async()=>{
  const v=await evaluate(`(async()=>{const m=CHAPTERS[5].missions.find(x=>(answerOf(x)||'').includes('return'));const r=await Py.run(answerOf(m));G.save=blankSave('Alex');for(const ch of CHAPTERS.slice(0,5))G.save.progress[ch.id]=mainCount(ch);return {ok:r.ok,finished:gameFinished(),extensionProgress:prog(6),finalNoDef:CHAPTERS.slice(0,5).every(ch=>ch.missions.every(m=>!/^\\s*(def |return )/m.test(answerOf(m))))};})()`);
  assert(v.ok);assert(v.finished);assert.equal(v.extensionProgress,0);assert(v.finalNoDef);
 });
 await test('concept checks reject hardcoded answers, strings and comments',async()=>{
  const v=await evaluate(`(async()=>{const m=findMission('c1m4').m,r=await Py.run('monster_hp = 20\\nprint(monster_hp)\\n# monster_hp = monster_hp - attack');return await runChecks(m,r,'monster_hp = 20\\nprint(monster_hp)');})()`);assert(v);
 });
 await test('real input pauses once, waits beyond watchdog, Enter submits, multiple inputs resume',async()=>{
  await evaluate(`window.inputTest=Py.run('counter = 0\\ncounter = counter + 1\\na = input("First: ")\\nb = int(input("Second: "))\\nprint(a, b, counter)'); true`);
  await wait("!$('#pythonInput').classList.contains('hidden')");
  assert.equal(await evaluate("$('#pythonPrompt').textContent"),'First: ');
  await new Promise(r=>setTimeout(r,8500)); // human waits must not trigger eight-second watchdog
  assert.equal(await evaluate("$('#pythonInput').classList.contains('hidden')"),false);
  await evaluate("$('#pythonValue').value='Hero'; $('#pythonInputForm').requestSubmit(); true");
  await wait("$('#pythonPrompt').textContent === 'Second: ' && !$('#pythonInput').classList.contains('hidden')");
  await evaluate("$('#pythonValue').value='5'; $('#pythonValue').focus(); true");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  const v=await evaluate('window.inputTest');assert(v.ok,JSON.stringify(v));assert.equal(v.output,'Hero 5 1\n');
 });
 await test('input TypeError, conversion ValueError, cancellation and line number',async()=>{
  const v=await evaluate(`(async()=>{const original=InputUI.open;try{InputUI.open=(p,d)=>setTimeout(()=>d('5'),1);const type=await Py.run('damage=input("Damage: ")\\nmonster_hp=30-damage');InputUI.open=(p,d)=>setTimeout(()=>d('abc'),1);const value=await Py.run('damage=int(input("Damage: "))');InputUI.open=(p,d)=>setTimeout(()=>d(null),1);const cancel=await Py.run('a=input()');return {type,value,cancel};}finally{InputUI.open=original;}})()`);
  assert.equal(v.type.error.type,'TypeError');assert.equal(v.type.error.line,2);assert.equal(v.value.error.type,'ValueError');assert.equal(v.cancel.error.type,'EOFError');
 });
 await test('infinite loop/output caps and recovery keep main page responsive',async()=>{
  const v=await evaluate(`(async()=>{const start=Date.now();const loop=await Py.run('monster_hp=30\\nwhile monster_hp>0:\\n    pass');const output=await Py.run('while True:\\n    print("Attack!")');const recovery=await Py.run('print(7)');return {loop,output,recovery,elapsed:Date.now()-start};})()`);
  assert.equal(v.loop.error.type,'Timeout');assert.equal(v.output.error.type,'TooMuchOutput');assert(v.recovery.ok);assert(v.elapsed<15000);
 });
 await test('mission navigation and prediction UI enforce predict before run',async()=>{
  const v=await evaluate(`(async()=>{G.save=blankSave('Alex');G.save.progress[1]=5;G.ch=CHAPTERS[0];showScreen('game');await startMission(2,true);ed.value=answerOf(curMission());await castSpell();const blocked=$('#feedback').textContent.includes('先選擇');const radio=document.querySelector('[name="prediction"][value="20"]');radio.click();return {blocked,prediction:G.prediction,mode:G.mode};})()`);assert(v.blocked);assert.equal(v.prediction,'20');assert.equal(v.mode,'mission');
 });
 await test('visual replay and skip leave static steps and no blocking overlay',async()=>{
  const v=await evaluate(`(()=>{Concept.render(findMission('c1m4').m.visual,$('#missionVisual'));const n=$('#missionVisual').querySelectorAll('li').length;$('#missionVisual [data-skip]').click();const skipped=$('#missionVisual').dataset.playing;$('#missionVisual [data-replay]').click();return {n,skipped,replay:$('#missionVisual').dataset.playing};})()`);assert.equal(v.n,3);assert.equal(v.skipped,'false');assert.equal(v.replay,'true');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate("$('#missionVisual [data-replay]').click(); $('#missionVisual').dataset.playing"),'false');
  await send('Emulation.setEmulatedMedia',{features:[]});
 });
 await test('actual home cast awards XP, stores code and opens the next mission',async()=>{
  await evaluate(`(async()=>{G.save=blankSave('Alex');G.teacher=false;G.ch=CHAPTERS[0];showScreen('game');await startMission(0,true);ed.value=answerOf(curMission());window.dialogueDrain=setInterval(()=>{if(Dlg.open()){Dlg.finish();Dlg.next();}},20);window.castResult=castSpell();return true;})()`);
  await wait("!$('#modalBack').classList.contains('hidden') && $('#modalBody').textContent.includes('任務完成')");
  const v=await evaluate("({xp:G.save.xp,done:missionDone('c1m1'),code:G.save.codes.c1m1})");assert.equal(v.xp,30);assert(v.done);assert.equal(v.code,'print("Hello")');
  await evaluate("$('#modalBtns button').click(); true");await wait("G.mi===1 && G.mode==='mission'");await evaluate('clearInterval(window.dialogueDrain); goMap(); true');
 });
 await test('home save and legacy save survive classroom selection',async()=>{
  const v=await evaluate(`(()=>{G.save=blankSave('Alex');G.save.progress[4]=3;persist();Store.set(LEGACY_SAVE_KEY,{name:'OldHero',progress:{4:8}});window.homeBefore=localStorage.getItem(SAVE_KEY);window.legacyBefore=localStorage.getItem(LEGACY_SAVE_KEY);Classroom.requested=true;Classroom.session=Classroom.validate({success:true,active:true,lesson:2,title:'測試',required:['c2m1','c2m2'],bonus:['c2b1']},'TEST28');Classroom.active=true;G.save=blankSave('Hero');G.save.completed=[];persist();return {homeUnchanged:localStorage.getItem(SAVE_KEY)===homeBefore,legacyUnchanged:localStorage.getItem(LEGACY_SAVE_KEY)===legacyBefore,done:missionDone('c2m1'),next:Classroom.nextRequired()};})()`);assert(v.homeUnchanged);assert(v.legacyUnchanged);assert.equal(v.done,false);assert.equal(v.next,'c2m1');
 });
 await test('classroom gates exact IDs at map, entry and mission navigation; teacher cannot bypass',async()=>{
  const v=await evaluate(`(async()=>{G.teacher=true;const allowed=canPlay(CHAPTERS[1],0),excluded=canPlay(CHAPTERS[1],2),future=chapterOpen(CHAPTERS[2]),extension=chapterOpen(CHAPTERS[5]);G.ch=CHAPTERS[1];await startMission(0,true);const old=G.mi;await startMission(2,true);const stayed=G.mi===old;enterChapter(CHAPTERS[2]);return {allowed,excluded,future,extension,stayed,ch:G.ch.id,bonus:canPlay(CHAPTERS[1],3)};})()`);assert(v.allowed);assert.equal(v.excluded,false);assert.equal(v.future,false);assert.equal(v.extension,false);assert(v.stayed);assert.equal(v.ch,2);assert(v.bonus);
 });
 await test('classroom completion shows exit question, replay, bonus and no next lesson',async()=>{
  await evaluate("G.save.completed=['c2m1','c2m2']; window.completion=Classroom.completion(); true");
  const v=await evaluate("({text:$('#modalBody').textContent,buttons:$('#modalBtns').textContent,homeUnchanged:localStorage.getItem(SAVE_KEY)===homeBefore})");assert(v.text.includes('今日任務完成'));assert(v.text.includes('離堂一問'));assert(v.text.includes('下一課'));assert(v.buttons.includes('重玩'));assert(v.buttons.includes('額外挑戰'));assert(!v.buttons.includes('下一個'));assert(v.homeUnchanged);
  await evaluate("closeModal('bonus'); true");await wait("G.mi===3 && G.mode==='mission'",2000).catch(async()=>{await evaluate('Dlg.close(true)');await wait("G.mi===3 && G.mode==='mission'");});
 });
 await test('actual classroom cast records exact completion and keeps home save unchanged',async()=>{
  await evaluate(`(async()=>{G.teacher=false;G.save.completed=['c2m1'];G.ch=CHAPTERS[1];showScreen('game');await startMission(1,true);ed.value=answerOf(curMission());document.querySelector('[name=\"prediction\"][value=\"str\"]').click();window.dialogueDrain=setInterval(()=>{if(Dlg.open()){Dlg.finish();Dlg.next();}if(InputUI.done)InputUI.submit('5');},20);window.classCast=castSpell();return true;})()`);
  await wait("!$('#modalBack').classList.contains('hidden') && $('#modalBody').textContent.includes('今日任務完成')");
  const v=await evaluate("({done:missionDone('c2m2'),home:localStorage.getItem(SAVE_KEY)===homeBefore,keys:Store.get(Classroom.key()).completed,future:chapterOpen(CHAPTERS[2])})");assert(v.done);assert(v.home);assert(v.keys.includes('c2m2'));assert.equal(v.future,false);
  await evaluate("clearInterval(window.dialogueDrain); closeModal('map'); true");await wait("G.mode==='map'");
 });
 await test('session validation rejects inactive, bad IDs, duplicates and cross-lesson IDs',async()=>{
  const v=await evaluate(`(()=>{let rejected=0;for(const x of [{success:true,active:false,lesson:2,required:['c2m1']},{success:true,active:true,lesson:2,required:['c3m1']},{success:true,active:true,lesson:2,required:['c2m1'],bonus:['c2m1']},{success:true,active:true,lesson:9,required:['c2m1']}]){try{Classroom.validate(x,'BAD28')}catch{rejected++}}return rejected;})()`);assert.equal(v,4);
 });
 await test('invalid or missing production session fails closed on page load',async()=>{
  await send('Page.navigate',{url:'http://127.0.0.1:8000/?mode=class&session=INVALID28'});await wait("document.querySelector('#classHome')",90000);
  assert.equal(await evaluate('Classroom.active'),false);assert((await evaluate("$('#title').textContent")).includes('未啟用'));
  await send('Page.navigate',{url:'http://127.0.0.1:8000/?mode=class'});await wait("document.querySelector('#classHome')",90000);assert.equal(await evaluate('Classroom.active'),false);
 });
 // Exercise the real initial URL loader with a deterministic backend double.
 const injection = await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const configure=setInterval(()=>{if(typeof TEACHER_CONFIG==='undefined')return;TEACHER_CONFIG.appsScriptUrl='https://script.google.com/macros/s/TEST/exec';clearInterval(configure);},0);const nativeFetch=window.fetch.bind(window);window.fetch=(url,options)=>String(url).startsWith('https://script.google.com/macros/s/TEST/exec')?Promise.resolve(new Response(JSON.stringify({success:true,active:new URL(location.href).searchParams.get('session')!=='INACTIVE28',lesson:2,title:'測試課堂',required:['c2m1','c2m2'],bonus:['c2b1']}),{headers:{'Content-Type':'application/json'}})):nativeFetch(url,options);})();`});
 await test('valid session URL loader opens classroom map and mission focus (mock backend)',async()=>{
  await send('Page.navigate',{url:'http://127.0.0.1:8000/?mode=class&session=VALID28'});await wait("typeof Classroom !== 'undefined' && Classroom.active && G.mode==='map'",90000);
  const v=await evaluate("({banner:$('#classBanner').textContent,future:chapterOpen(CHAPTERS[2]),home:Store.get(SAVE_KEY).progress[4]})");assert(v.banner.includes('課堂模式'));assert.equal(v.future,false);assert.equal(v.home,3);
  await evaluate("document.querySelector('[data-ch=\"2\"]').click(); true");await wait("$('#modalBody').textContent.includes('今日任務')");assert((await evaluate("$('#modalBody').textContent")).includes('哪些是文字'));await evaluate("closeModal(false); true");
 });
 await test('inactive session URL is blocked safely (mock backend)',async()=>{
  await send('Page.navigate',{url:'http://127.0.0.1:8000/?mode=class&session=INACTIVE28'});await wait("document.querySelector('#classHome')",90000);assert.equal(await evaluate('Classroom.active'),false);
 });
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.result.identifier});
 console.log(`PASS ${passed} browser integration groups`);
} finally { await send('Page.close').catch(()=>{}); ws.close(); }
