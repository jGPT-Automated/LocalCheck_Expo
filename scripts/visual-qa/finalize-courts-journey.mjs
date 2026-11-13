// Regression journey against the actual Expo export; remote traffic is isolated.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
process.env.FAKE_NOW = String(Date.parse(process.env.JOURNEY_NOW || '2026-11-13T20:30:00Z'));
process.env.TZ = 'America/Chicago';
const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, COURT, ME } = await import('./fixtures.mjs');
const [base='http://127.0.0.1:8090', out='/tmp/localcheck-finalize-proof', mode='check'] = process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const qrScript=execFileSync('curl',['-fsSL','https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
const original=structuredClone(tables), results=[];
try {
for(const [width,height] of [[375,667],[393,852],[430,932]]) {
 if(process.env.JOURNEY_WIDTH && Number(process.env.JOURNEY_WIDTH)!==width)continue;
 for(const k of Object.keys(tables))tables[k]=structuredClone(original[k]);
 tables.notifications=Array.from({length:43},(_,i)=>({id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(100-i).padStart(12,'0')}`,user_id:ME,type:'friend_check_in',actor_id:null,friendship_id:null,run_id:null,match_id:null,title:'A friend just checked in',body:`Player ${i} is at the court.`,data:{path:`/court/${COURT}`},read_at:null,created_at:new Date(Number(process.env.FAKE_NOW)-i*60000).toISOString()}));
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,timezoneId:'America/Chicago',reducedMotion:'reduce'});
 await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
 await context.addInitScript(s=>localStorage.setItem('sb-qkrnmyexzvaxiqfxwwfb-auth-token',JSON.stringify(s)),SESSION);
 await context.routeWebSocket(/.*/,ws=>ws.close());
 const errors=[],requests=[];
 const savedIds = new Set([COURT]);
 await context.route('**/*',async route=>{
  const req=route.request(),url=req.url();if(url.startsWith(base))return route.continue();
  if(url.includes('cdn.jsdelivr.net/npm/jsqr'))return route.fulfill({contentType:'application/javascript',body:qrScript});
  let response;
  if(url.includes('/rest/v1/')) {
   requests.push({method:req.method(),path:new URL(url).pathname});
   if(url.includes('/rpc/my_saved_courts')) response={status:200,body:JSON.stringify([...savedIds].map(court_id=>({court_id})))};
   else if(url.includes('/rpc/set_court_saved')) {const {p_court_id,p_saved}=req.postDataJSON();if(p_saved)savedIds.add(p_court_id);else savedIds.delete(p_court_id);response={status:200,body:'null'};}
   else if(url.includes('/planned_visits')&&req.method()==='POST'){
    const row=req.postDataJSON();tables.activity_events.push({id:'99999999-9999-4999-8999-999999999999',event_type:'planned_visit_created',actor_id:ME,court_id:COURT,visibility:'public',payload:{planned_at:row.planned_at},occurred_at:new Date(Number(process.env.FAKE_NOW)).toISOString()});tables.planned_visits.push({...row,id:'99999999-9999-4999-8999-999999999999',created_at:new Date(Number(process.env.FAKE_NOW)).toISOString()});response={status:201,body:''};
   }else if(url.includes('/planned_visits')&&req.method()==='DELETE'){
    const id=new URL(url).searchParams.get('id')?.replace('eq.','');tables.planned_visits=tables.planned_visits.filter(v=>v.id!==id);response={status:204,body:''};
   }else response=handleRest(req.method(),url,req.headers());
  }else if(url.includes('/auth/v1/'))response=handleAuth(url);
  else return route.abort();
  return route.fulfill({status:response.status,body:response.body,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-expose-headers':'content-range',...response.headers}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 const open=async path=>{await page.goto(base+path,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);};
 const scrollAll=()=>page.evaluate(()=>{for(const el of document.querySelectorAll('*')){const s=getComputedStyle(el);if(['auto','scroll'].includes(s.overflowY)&&el.scrollHeight>el.clientHeight+30)el.scrollTop+=250;}});
 const geometry=locator=>locator.evaluate(el=>{const b=el.getBoundingClientRect();return {y:b.y,bottom:b.bottom,height:b.height};});
 await open('/');
 const name=page.getByText('KASMIERSKY PARK',{exact:true}).first();
 // Fixture naming is intentionally read from the existing data, not invented.
 const courtName=tables.courts.find(c=>c.id===COURT).short_name||tables.courts.find(c=>c.id===COURT).name;
 const title=page.getByText(courtName,{exact:true}).first();await title.waitFor();
 const before=await geometry(title);await scrollAll();await page.waitForTimeout(300);const after=await geometry(title);
 await page.screenshot({path:`${out}/home-scrolled-${width}.png`});
 if(mode!=='capture')assert.equal(after.y,before.y,'Home court header stays fixed');
 await open(`/court/${COURT}`);await page.getByTestId('court-activity-scroll').waitFor();
 const chart=page.getByTestId('court-time-chart'), chartBefore=await geometry(chart);
 const nowHour=new Date(Number(process.env.FAKE_NOW)).getHours();
 const firstHour=Math.min(6,nowHour),lastHour=Math.max(22,nowHour);
 const nowRow=page.getByTestId(`activity-hour-${nowHour}`);const nowBefore=mode==='capture' && !(await nowRow.count()) ? null : await geometry(nowRow);
 await page.screenshot({path:`${out}/feed-open-${width}.png`});
 const list=page.getByTestId('court-activity-scroll');await list.evaluate(e=>e.scrollTop+=250);await page.waitForTimeout(300);
 const chartAfter=await geometry(chart);if(mode!=='capture')assert.equal(chartAfter.y,chartBefore.y,'Feed chart stays fixed');
 if(mode!=='capture')assert.ok(nowBefore.y>=chartBefore.bottom&&nowBefore.y<height-44,`Feed opens at Now: ${JSON.stringify({nowBefore,chartBefore,height})}`);
 await page.getByRole('button',{name:'Next day',exact:true}).click();
 const b=await chart.boundingBox();await page.mouse.click(b.x+(18-firstHour+.5)/(lastHour-firstHour+1)*b.width,b.y+20);await page.waitForTimeout(350);
 const row=page.getByTestId('activity-hour-18');await row.getByRole('button',{name:"I'm going",exact:true}).click();
 await row.getByRole('button',{name:"I'm not coming",exact:true}).waitFor();
 await page.screenshot({path:`${out}/feed-going-${width}.png`});
 await open(`/court/${COURT}`);if(mode!=='capture')await page.getByText('is going',{exact:false}).first().waitFor();
 await page.getByRole('button',{name:'Next day',exact:true}).click();
 const b2=await chart.boundingBox();await page.mouse.click(b2.x+(18-firstHour+.5)/(lastHour-firstHour+1)*b2.width,b2.y+20);await page.waitForTimeout(350);
 await row.getByRole('button',{name:"I'm not coming",exact:true}).waitFor();
 await open('/notifications');const header=page.getByText('NOTIFICATIONS',{exact:true});await header.waitFor();const notifBefore=await geometry(header);
 await scrollAll();await page.waitForTimeout(300);const notifAfter=await geometry(header);
 await page.screenshot({path:`${out}/notifications-scrolled-${width}.png`});
 if(mode!=='capture')assert.equal(notifAfter.y,notifBefore.y,'Notifications header stays fixed');
 if(mode!=='capture') {
   tables.profiles.find(row=>row.id===ME).is_pro=true;
   const other=tables.courts.find(row=>row.id!==COURT);
   await open(`/court/${other.id}`);
   await page.getByRole('button',{name:'Save court',exact:true}).click();
   await page.getByRole('button',{name:'Remove saved court',exact:true}).waitFor();
   await page.reload({waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Remove saved court',exact:true}).waitFor();
   await open('/');await page.getByRole('button',{name:'Choose court',exact:true}).click();
   await page.getByRole('button',{name:`Pick ${other.name}`,exact:true}).click();
   await page.getByText(other.short_name||other.name,{exact:true}).first().waitFor();
   await page.getByText("PICK A COURT",{exact:true}).waitFor({state:"hidden"});
   await page.screenshot({path:`${out}/home-saved-court-${width}.png`});
   assert.equal(tables.profiles.find(row=>row.id===ME).local_court_id,COURT,'viewing a saved court preserves the default');
   await open('/schedule');
   await page.getByTestId('schedule-court-selector').click();
   await page.getByText(other.name.toUpperCase(),{exact:true}).click();
   assert.match(await page.getByTestId('schedule-court-selector').innerText(),new RegExp(other.short_name||other.name,"i"));
   await page.screenshot({path:`${out}/schedule-saved-court-${width}.png`});

   await open(`/court/${other.id}`);
   await page.getByRole('button',{name:'Remove saved court',exact:true}).click();
   await page.getByRole('button',{name:'Save court',exact:true}).waitFor();
   assert.deepEqual(errors,[], 'no application errors');
 }

 results.push({width,home:{before,after},feed:{chartBefore,chartAfter,nowBefore},notifications:{before:notifBefore,after:notifAfter},errors,requests});
 await context.close();
}
}finally{await browser.close();writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results.map(({requests,...r})=>r),null,2));
