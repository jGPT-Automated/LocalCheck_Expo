// Actual Expo routes; every service request is intercepted before navigation.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
process.env.FAKE_NOW = String(Date.parse('2026-11-14T20:00:00Z'));
process.env.TZ = 'America/Chicago';
const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, ME, COURT } = await import('./fixtures.mjs');
let [base='http://127.0.0.1:8102', out='/tmp/locallist-home', mode='after'] = process.argv.slice(2);
let server;
if(!base.startsWith('http')) {
 const dist=resolve(base);
 const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.svg':'image/svg+xml','.json':'application/json'};
 server=createServer((req,res)=>{
  let file=join(dist,decodeURIComponent(new URL(req.url,'http://preview').pathname));
  if(!existsSync(file)||statSync(file).isDirectory())file=join(dist,'index.html');
  res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 base=`http://127.0.0.1:${server.address().port}`;
}
const original = structuredClone(tables);
const qrScript = execFileSync('curl',['-fsSL','https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
const now = Number(process.env.FAKE_NOW);
const types = ['friend_request','friend_accepted','run_invite','match_review','match_confirmed','match_rejected','challenge','friend_check_in','auto_check_in','auto_check_out','manual_check_in','manual_check_out'];
const bodies = ['Marcus R. wants to connect.','Marcus R. accepted your friend request.','Marcus R. invited you to a game at Kasmiersky Park.','Marcus R. logged 15–8. Confirm the final score.','Your game finished 15–8.','Marcus R. disputed the final score.','Marcus R. challenged you at Kasmiersky Park.','Marcus R. is at Kasmiersky Park.',"You’re at Kasmiersky Park.",'You left Kasmiersky Park.',"You’re at Kasmiersky Park.",'You left Kasmiersky Park.'];
const headings = ['FRIEND REQUEST','FRIEND ACCEPTED','RUN INVITE','CONFIRM FINAL SCORE','MATCH CONFIRMED','MATCH REJECTED','NEW CHALLENGE','A friend just checked in','Check-in posted','Auto checked out','Checked in','Checked out'];
const audit = readFileSync(new URL('./audit.js',import.meta.url),'utf8');
mkdirSync(out,{recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try {
for (const [width,height] of [[375,667],[393,852],[430,932]]) {
 if(process.env.JOURNEY_WIDTH && Number(process.env.JOURNEY_WIDTH)!==width)continue;
 for(const key of Object.keys(original))tables[key]=structuredClone(original[key]);
 for(const table of ['courts','courts_with_stats'])for(const court of tables[table]??[])if(court.sport_type==='basketball')court.market='Conroe';
 const me=tables.profiles.find(p=>p.id===ME);me.is_pro=true;me.account_tag='TEST';me.push_notifications_enabled=false;
 tables.notifications=Array.from({length:43},(_,i)=>({id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(100-i).padStart(12,'0')}`,user_id:ME,type:types[i%types.length],actor_id:null,friendship_id:null,run_id:null,match_id:null,title:headings[i%types.length],body:bodies[i%types.length],data:{path:`/court/${COURT}`,source:types[i%types.length].startsWith('manual_')?'manual':types[i%types.length].startsWith('auto_')?'auto':null,visibility:['private','friends','public'][i%3]},read_at:null,created_at:i<22?'2026-11-14T19:44:17.036159Z':new Date(now-(i+20)*60000).toISOString()}));
 let pending=null;
 const serviceCalls=[];
 const errors=[];
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'America/Chicago',reducedMotion:'reduce'});
 await context.addInitScript(session=>localStorage.setItem('sb-qkrnmyexzvaxiqfxwwfb-auth-token',JSON.stringify(session)),SESSION);
 await context.clock.setFixedTime(new Date(now));
 await context.routeWebSocket(/.*/,socket=>socket.close());
 await context.route('**/*',async route=>{
  const req=route.request(),url=req.url();
  if(url.startsWith(base))return route.continue();
  if(url.includes('cdn.jsdelivr.net/npm/jsqr'))return route.fulfill({contentType:'application/javascript',body:qrScript});
  let response;
  if(url.includes('/rest/v1/rpc/my_pending_auto_check_in'))response={status:200,body:JSON.stringify(pending)};
  else if(url.includes('/rest/v1/rpc/undo_auto_check_in')){pending=null;response={status:200,body:'true'};serviceCalls.push('cancel');}
  else if(url.includes('/rest/v1/rpc/check_in')){
   const p=req.postDataJSON();
   for(const row of tables.check_ins)if(row.user_id===ME&&!row.checked_out_at)row.checked_out_at=new Date(now).toISOString();
   tables.check_ins.push({id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',user_id:ME,court_id:p.p_court_id,checked_in_at:new Date(now).toISOString(),checked_out_at:null,source:'manual',visibility:p.p_visibility,note:null});
   response={status:200,body:'{}'};serviceCalls.push('check_in');
  }else if(url.includes('/rest/v1/rpc/check_out')){
   for(const row of tables.check_ins)if(row.user_id===ME&&!row.checked_out_at)row.checked_out_at=new Date(now).toISOString();
   response={status:200,body:'{}'};serviceCalls.push('check_out');
  }else if(url.includes('/rest/v1/rpc/mark_all_notifications_read')){for(const row of tables.notifications)row.read_at=new Date(now).toISOString();response={status:200,body:'true'};}
  else if(url.includes('/rest/v1/'))response=handleRest(req.method(),url,req.headers(),req.postDataJSON() ?? {});
  else if(url.includes('/auth/v1/'))response=handleAuth(url);
  else return route.abort();
  return route.fulfill({status:response.status,body:response.body,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-expose-headers':'content-range',...response.headers}});
 });
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(String(e)));
 const open=async path=>{await page.goto(base+path,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);};
 const stateAudits={};
 const capture=async name=>{await page.screenshot({path:`${out}/${name}-${width}.png`});const found=await page.evaluate(`(${audit})()`);stateAudits[name]=found;return found;};
 const box=loc=>loc.evaluate(e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,height:b.height,width:b.width};});
 const clickTab=async name=>{
  await page.getByText(new RegExp('^'+name+'$','i')).last().click();
  await page.waitForTimeout(350);
 };
 await open('/');
 if(process.env.JOURNEY_MANUAL_ONLY) {
  await page.getByTestId('check-in-btn').click();
  await page.getByText('Checked in',{exact:true}).waitFor();
  await open('/'); // Restore the posted session from its stored timestamp, without the transient success toast.
  const found=await capture('home-manual-active');
  assert.deepEqual(found.fail,[]);
  assert.equal(await page.getByTestId('home-session-clock').innerText(),'0:00');
  results.push({width,height,checks:['manual check-in elapsed survives reload'],pageErrors:errors});
  writeFileSync(`${out}/manual-results.json`,JSON.stringify(results,null,2));
  await context.close();continue;
 }
 const homeAudit=await capture('home');
 const checks=[];
 if(mode==='after') {
  const header=page.getByTestId('screen-header'),hero=page.getByTestId('home-court-hero');
  assert.ok(Math.abs((await box(header)).bottom-(await box(hero)).top)<1,'header and hero are flush');
  assert.equal(await header.getByRole('button').count(),0,'header is informational');
  assert.equal(await page.getByRole('button',{name:'Choose court'}).count(),1);
  const before=await box(hero);
  await page.evaluate(()=>{for(const e of document.querySelectorAll('*'))if(e.scrollHeight>e.clientHeight+30&&e.clientHeight>100&&getComputedStyle(e).overflowY==='scroll')e.scrollTop+=200;});
  assert.equal((await box(hero)).top,before.top,'hero stays fixed');
  await capture('home-scrolled');checks.push('fixed flush informational header');
 }
 await open('/settings');
 await page.getByText(mode==='after'?'LOCALLIST':'LOCAL COURT',{exact:true}).click();await page.waitForTimeout(500);
 await capture('settings-courts');
 if(mode==='after'){
  const search=page.getByRole('textbox',{name:'Search for a court'});
  const list=page.getByTestId('local-list-cards');
  assert.ok((await box(search)).bottom<(await box(list)).top,'search appears before court cards');
  checks.push('Settings search first');
 }
 await open('/explore');await capture('explore');
 if(mode==='after'){
  const other=tables.courts.find(c=>c.id!==COURT && c.sport_type==='basketball');
  await page.getByTestId(`court-${other.id}`).click();
  await page.getByRole('button',{name:`Open ${other.short_name||other.name}`,exact:true}).last().click();
  await page.waitForURL(`**/court/${other.id}`);
  await capture('court-add');
  await page.getByRole('button',{name:'Add to LocalList',exact:true}).click();
  // The page's original back control returns to the existing Explore screen.
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.waitForTimeout(300);
  const list=page.getByTestId('local-list-cards');
  assert.equal(await list.getByTestId(`local-list-${other.id}`).count(),1,'added court appears in Explore LocalList');
  await capture('explore-added');
  await clickTab('Home');
  assert.equal(await page.getByRole('tab',{name:`Show ${other.name}`}).count(),1,'carousel indicator for each list member');
  await page.getByRole('button',{name:'Choose court'}).first().click();
  await page.getByTestId('home-court-picker').waitFor();
  await page.waitForTimeout(300);
  await capture('home-picker');
  await page.getByTestId('home-court-picker').getByRole('button',{name:`Open ${other.name}`,exact:true}).click();
  await page.getByTestId('home-court-picker').waitFor({state:'hidden'});
  await page.waitForTimeout(500);await capture('home-selected');
  assert.equal(await page.getByRole('tab',{name:`Show ${other.name}`}).getAttribute('aria-selected'),'true');
  await capture('home-selected');
  assert.equal(tables.profiles.find(p=>p.id===ME).local_court_id,COURT,'page view leaves server default alone');
  const pager=page.getByTestId('home-court-carousel');
  await pager.evaluate(e=>{e.scrollLeft=0;e.dispatchEvent(new Event('scroll'));});
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole('tab',{name:`Show ${tables.courts.find(c=>c.id===COURT).name}`}).getAttribute('aria-selected'),'true','swipe/scroll updates selected court');
  await clickTab('Me');
  // Use the existing profile Settings action to preserve the in-memory list.
  const settings=page.getByRole('button',{name:/settings/i});
  await settings.first().click();await page.getByText(mode==='after'?'LOCALLIST':'LOCAL COURT',{exact:true}).click();
  await page.getByRole('button',{name:`Make ${other.name} default`,exact:true}).click();
  await capture('settings-list-default');
  await page.waitForTimeout(400);
  await page.getByRole('button',{name:'Bottom sheet backdrop',exact:true}).last().click({position:{x:5,y:5}});
  await page.waitForTimeout(500);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await clickTab('Home');
  assert.equal(await page.getByRole('tab',{name:`Show ${other.name}`}).getAttribute('aria-selected'),'true','Settings default becomes Home default');
  await clickTab('Schedule');
  await page.getByTestId('schedule-court-selector').click();
  await page.getByText('Pick a court',{exact:true}).waitFor();
  await page.waitForTimeout(400);await capture('schedule-list-picker');
  await page.getByRole('button',{name:`Open ${tables.courts.find(c=>c.id===COURT).name}`,exact:true}).click();
  await page.waitForTimeout(400);await capture('schedule-selected');
  await clickTab('Home');
  assert.equal(await page.getByRole('tab',{name:`Show ${other.name}`}).getAttribute('aria-selected'),'true','Schedule selection does not change Home/default');
  checks.push('plus → Explore list → Home dropdown/scroll → Settings default');
 }
 await open('/notifications');
 const inboxAudit=await capture('notifications');
 if(mode==='after'){
  for(const row of tables.notifications.slice(0,12))await page.getByTestId(`notification-${row.id}`).waitFor();
  assert.equal(await page.getByText('Turn on phone alerts',{exact:true}).count(),1,'push off leaves inbox populated');
  await page.getByRole('button',{name:'Load 20 more notifications'}).click();
  await page.getByRole('button',{name:'Load 20 more notifications'}).click();
  await page.getByTestId(`notification-${tables.notifications[42].id}`).waitFor();
  await page.getByRole('button',{name:'Read all',exact:true}).click();
  await page.getByRole('button',{name:'Read all',exact:true}).waitFor({state:'hidden'});
  checks.push('all 12 row types, push-off, 43 records and read-all');
  pending={court_id:COURT,posts_at:new Date(now+300000).toISOString()};
  await open('/');
  await page.getByText('Posts in',{exact:true}).waitFor();
  assert.equal(await page.getByTestId('screen-header').getByRole('button').count(),0);
  await capture('home-pending');
  await page.getByRole('button',{name:'Cancel pending check-in'}).click();
  await page.getByTestId('home-session-status').waitFor({state:'hidden'});
  await page.getByTestId('check-in-btn').click();
  await page.getByText('Checked in',{exact:true}).waitFor();
  await open('/');
  await capture('home-manual-active');
  assert.equal(serviceCalls.filter(x=>x==='check_in').length,1);
  for(const row of tables.check_ins)if(row.user_id===ME&&!row.checked_out_at)row.checked_out_at=new Date(now).toISOString();
  pending={court_id:COURT,posts_at:new Date(now+300000).toISOString()};
  await open('/');assert.equal(await page.getByRole('button',{name:'Post check-in now'}).isDisabled(),true,'Post is staged pending the separate backend action');
  pending=null;tables.check_ins.push({id:'ffffffff-ffff-4fff-8fff-ffffffffffff',user_id:ME,court_id:COURT,checked_in_at:new Date(now-600000).toISOString(),checked_out_at:null,source:'auto',visibility:'friends',note:null});
  await open('/');await page.getByText('Checked in',{exact:true}).waitFor();
  assert.equal(await page.getByTestId('home-session-clock').innerText(),'10:00');
  await capture('home-auto-active');
  const clockBox=await box(page.getByTestId('home-session-clock'));
  assert.ok(clockBox.right<=width-19 && clockBox.left>width/2,'elapsed timer stays inside its header gutter');
  checks.push('pending Cancel, immediate manual, staged Post and automatic elapsed');
 }
 assert.deepEqual(errors,[]);
 if(mode==='after')for(const [state,found] of Object.entries(stateAudits))assert.deepEqual(found.fail,[],`${width}px ${state}: no clipped, overlapping or off-screen text`);
 results.push({width,height,checks,pageErrors:errors,homeAudit,inboxAudit,stateAudits,serviceCalls});
 writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
 await context.close();
}
}finally{await browser.close();server?.close();}
console.log(JSON.stringify(results.map(({homeAudit,inboxAudit,stateAudits,...r})=>r),null,2));
