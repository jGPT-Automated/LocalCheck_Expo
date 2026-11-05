// Home-only visual measurement. HTTP fixtures and WebSocket blocking are installed before navigation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
process.env.FAKE_NOW = String(Date.parse('2026-10-17T23:30:00Z'));
process.env.TZ = 'America/Chicago';
const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, COURT, ME, RUN5V5 } = await import('./fixtures.mjs');
const base = process.argv[2] || 'http://127.0.0.1:8117';
const out = process.env.PICKLE_HOME_OUT || '/tmp/pickle-home-card'; mkdirSync(out,{recursive:true});
const qr = execFileSync('curl',['-fsSL','https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
const audit = readFileSync(new URL('./audit.js', import.meta.url),'utf8');
const original = structuredClone(tables);
const selectedCourt = tables.courts.find(c=>c.short_name==='Candy Cane')?.id;
const viewer = tables.profiles.find(p=>p.id===ME);
const source = tables.runs.find(r=>r.court_id===COURT&&r.max_players===10&&r.start_time==='2026-10-18T01:00:00.000Z');
assert.ok(selectedCourt&&viewer&&source);
viewer.local_court_id=selectedCourt; viewer.preferred_sport='pickleball';
const present=tables.check_ins.filter(r=>r.court_id===COURT&&!r.checked_out_at).slice(0,3); assert.equal(present.length,3);
for(const row of present){row.court_id=selectedCourt;const p=tables.profiles.find(x=>x.id===row.user_id);p.local_court_id=selectedCourt;p.preferred_sport='pickleball';}
for(const list of [tables.courts,tables.courts_with_stats]){list.find(c=>c.id===selectedCourt).active_check_in_count=3;list.find(c=>c.id===COURT).active_check_in_count=1;}
const id='dddddddd-5555-4555-8555-555555555555'; tables.runs.push({...structuredClone(source),id,court_id:selectedCourt,title:'Pickleball game',max_players:4,sport:'PICKLEBALL'});
tables.planned_visits = [];
const players=tables.run_participants.filter(p=>p.run_id===source.id).slice(0,2); assert.equal(players.length,2); players.forEach((p,i)=>tables.run_participants.push({...structuredClone(p),id:`${id}-p${i}`,run_id:id}));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
const sizes=[[375,667],[393,852],[430,932]].filter(([w,h])=>!process.env.PICKLE_HOME_SIZES||process.env.PICKLE_HOME_SIZES.split(',').includes(`${w}x${h}`));
try { for(const [width,height] of sizes){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,timezoneId:'America/Chicago',reducedMotion:'reduce'});
 const websocket=[]; await ctx.routeWebSocket(/.*/,ws=>{websocket.push('closed');ws.close();}); await ctx.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
 await ctx.addInitScript(s=>{for(const id of ['sb-qkrnmyexzvaxiqfxwwfb-auth-token','sb-ci-placeholder-auth-token'])localStorage.setItem(id,JSON.stringify(s));},SESSION);
 const remote=[],writes=[],errors=[];
 await ctx.route('**/*',async route=>{const req=route.request(),url=req.url();if(url.startsWith(base))return route.continue();if(url.includes('cdn.jsdelivr.net/npm/jsqr')){remote.push('fulfilled-jsqr');return route.fulfill({contentType:'application/javascript',body:qr});}let result;if(url.includes('/rest/v1/')){if(!['GET','HEAD'].includes(req.method())&&!url.includes('/rpc/'))writes.push({method:req.method(),url});result=handleRest(req.method(),url,req.headers());}else if(url.includes('/auth/v1/'))result=handleAuth(url);else if(url.includes('/functions/v1/')||url.includes('/storage/v1/'))result={status:200,body:'{}'};else{remote.push('aborted');return route.abort();}remote.push(`fulfilled-${result.status}`);return route.fulfill({status:result.status,body:result.body,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-expose-headers':'content-range',...result.headers}});});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(7000);await page.goto(base+'/',{waitUntil:'networkidle'});await page.waitForTimeout(2600);await page.getByTestId('court-day-planner').waitFor();
 await page.evaluate(()=>{for(const e of document.querySelectorAll('*'))if(e.scrollHeight>e.clientHeight+50&&e.clientHeight>200)e.scrollTop=e.scrollHeight;});
 const chart=page.getByTestId('court-time-chart'),b=await chart.boundingBox();assert.ok(b);const x=b.x+(20-6+.5)/17*b.width;await page.mouse.click(x,b.y+20);await page.waitForTimeout(450);
 const card=page.getByTestId('court-day-planner'),selected=page.getByTestId('selected-court-hour');await selected.waitFor();
 const geom=async()=>page.evaluate(()=>{const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};const el=s=>document.querySelector(s);const card=el('[data-testid="court-day-planner"]'), selected=el('[data-testid="selected-court-hour"]'), heading=el('[data-testid="court-day-heading"]'), chart=el('[data-testid="court-time-chart"]');const roster=el('[data-testid^="game-roster-"]');const slots=roster?[...roster.querySelectorAll('[data-testid="game-open-spot"]')]:[];const cells=roster?[...roster.querySelectorAll('.rosterCell')]:[];const center=e=>{const r=e.getBoundingClientRect();return{x:+(r.x+r.width/2).toFixed(1),y:+(r.y+r.height/2).toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}};return{viewport:{width:innerWidth,height:innerHeight},card:box(card),selected:box(selected),heading:box(heading),chart:box(chart),headingText:heading.innerText, selectedText:selected.innerText, avatars:[...selected.querySelectorAll('[accessibilitylabel]')].slice(0,0),openSpots:slots.map(center),rosterCells:cells.map(center),labels:roster?[...roster.querySelectorAll('.rosterName')].map(e=>({text:e.innerText,...center(e)})):[],cta:[...selected.querySelectorAll('button')].map(e=>({label:e.getAttribute('aria-label'),target:center(e),visual:center(e.firstElementChild||e)})),bg:getComputedStyle(card).backgroundColor,greenOpen:slots.map(e=>({border:getComputedStyle(e.firstElementChild).borderColor,bg:getComputedStyle(e.firstElementChild).backgroundColor}))}});
 const closed=await geom();await page.screenshot({path:`${out}/closed-${width}.png`});await selected.getByRole('button',{name:'Expand PICKLEBALL GAME',exact:true}).click();await page.waitForTimeout(300);const roster=selected.locator('[data-testid^="game-roster-"]');await roster.waitFor();await roster.evaluate(e=>{const b=e.getBoundingClientRect();let p=e.parentElement;while(p&&!(p.scrollHeight>p.clientHeight+10&&p.clientHeight>100))p=p.parentElement;if(p)p.scrollTop+=Math.max(0,b.bottom-(innerHeight-96));});await page.waitForTimeout(200);const floorTop=height-88;const ownerState=await roster.evaluate((e,floorTop)=>{const card=document.querySelector('[data-testid=\"court-day-planner\"]');let p=e.parentElement;while(p&&!(p.scrollHeight>p.clientHeight+10&&p.clientHeight>100))p=p.parentElement;const before={scrollTop:p?.scrollTop??null,maxScroll:p?p.scrollHeight-p.clientHeight:null,cardBottom:card?.getBoundingClientRect().bottom??null,floorTop};if(p&&card){const delta=Math.max(0,card.getBoundingClientRect().bottom-floorTop+8);p.scrollTop+=Math.min(delta,p.scrollHeight-p.clientHeight-p.scrollTop);}return{...before,afterScrollTop:p?.scrollTop??null,afterCardBottom:card?.getBoundingClientRect().bottom??null};},floorTop);await page.waitForTimeout(150);const expanded=await geom();expanded.scrollOwner=ownerState;await page.screenshot({path:`${out}/expanded-${width}.png`});const a=await page.evaluate(`(${audit})()`);assert.deepEqual(a.fail,[]);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);assert.ok(remote.every(x=>x.startsWith('fulfilled')||x==='aborted'));assert.ok(websocket.every(x=>x==='closed'));
 results.push({width,height,closed,expanded,audit:a,remote:remote.length,writes,errors,websocket:websocket.length});await ctx.close();
 }} finally {await browser.close();}
writeFileSync(`${out}/measurements.json`,JSON.stringify({source:process.env.QA_APP_SOURCE || 'unrecorded',base,out,results},null,2));console.log(JSON.stringify({out,results:results.map(r=>({width:r.width,closed:r.closed.card,expanded:r.expanded, audit:r.audit.fail}))},null,2));
