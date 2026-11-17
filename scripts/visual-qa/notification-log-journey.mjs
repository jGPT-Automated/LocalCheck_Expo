// Real Expo route, isolated HTTP fixtures, no live backend writes.
// node scripts/visual-qa/notification-log-journey.mjs <url> <output directory> [before]
import assert from 'node:assert/strict';
import { existsSync, statSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { join, extname, resolve } from 'node:path';
process.env.FAKE_NOW = String(Date.parse('2026-11-09T03:00:00Z'));
const { handleAuth, handleRest, SESSION } = await import('./mock.mjs');
const { tables, ME, COURT } = await import('./fixtures.mjs');
let [base, out, mode] = process.argv.slice(2);
assert.ok(base && out);
let server;
if (!base.startsWith('http')) {
 const dist=resolve(base);
 const types={'.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.html':'text/html','.json':'application/json'};
 server=createServer((req,res)=>{
  let file=join(dist,decodeURIComponent(new URL(req.url,'http://local').pathname));
  if(!existsSync(file)||statSync(file).isDirectory())file=join(dist,'index.html');
  res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream'});res.end(readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 base=`http://127.0.0.1:${server.address().port}`;
}
mkdirSync(out, { recursive: true });
const audit = readFileSync(new URL('./audit.js', import.meta.url), 'utf8');
const samples = [
 ['auto_check_in', 'Check-in posted', "You're at River Overlook Courts.", { kind:'manual_check_in', source:'manual', visibility:'private', path:`/court/${COURT}` }],
 ['friend_check_in', 'A friend just checked in', 'Marcus is at Candy Cane.', { path:`/court/${COURT}` }],
 ['match_confirmed', 'MATCH CONFIRMED', 'You beat Marcus, 15–8. ELO now 1129 (+21).', {}],
 ['auto_check_in', 'Check-in posted', "You're at Candy Cane.", { source:'auto', visibility:'friends' }],
 ['auto_check_out', 'Auto checked out', "Still at River Overlook Courts? Tap I'm still here.", { source:'auto', visibility:'public' }],
 ['challenge', 'NEW CHALLENGE', 'Marcus challenged you to a casual 1v1 at Kasmiersky Park.', {}],
 ['match_review', 'CONFIRM FINAL SCORE', 'Kofi logged 15–5.', {}],
 ['friend_request', 'FRIEND REQUEST', 'Dwayne wants to connect.', {}],
];
tables.notifications = Array.from({ length:43 }, (_,i) => {
 const s=samples[i%samples.length];
 return { id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(100-i).padStart(12,'0')}`,user_id:ME,type:s[0],actor_id:null,
 friendship_id:null,run_id:null,match_id:null,title:s[1],body:s[2],data:s[3],read_at:i%4===3?'2026-11-09T03:00:00Z':null,
 // A page boundary crosses a timestamp tie; id is the secondary cursor.
 created_at:i<22?'2026-11-09T02:44:17.036159Z':new Date(Date.parse('2026-11-09T02:40:00Z')-(i-22)*60000).toISOString() };
});
const results=[];
let browser;
try {
 for(const [width,height] of [[375,667],[393,852],[430,932]]) {
  if(process.env.NOTIFICATION_WIDTH && Number(process.env.NOTIFICATION_WIDTH)!==width)continue;
  browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,timezoneId:'America/Chicago',reducedMotion:'reduce'});
  await context.addInitScript(session=>{for(const id of ['qkrnmyexzvaxiqfxwwfb','ci-placeholder'])localStorage.setItem(`sb-${id}-auth-token`,JSON.stringify(session));},SESSION);
  await context.routeWebSocket(/.*/,ws=>ws.close());
  await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
  let failNext=false, readAll=false;
  const pages=[];
  await context.route('**/*',async route=>{
   const req=route.request(),url=req.url();
   if(url.startsWith(base))return route.continue();
   if(url.includes('/rest/v1/notifications')&&req.method()==='GET'){
    if(failNext&&new URL(url).searchParams.has('or')){return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Deliberate page failure'})});}
    const response=handleRest(req.method(),url,req.headers());
    const rows=JSON.parse(response.body);pages.push(rows.map(r=>r.id));
    if(readAll)for(const row of rows)row.read_at='2026-11-09T03:00:00Z';
    return route.fulfill({status:200,body:JSON.stringify(rows),headers:{'content-type':'application/json','access-control-allow-origin':'*'}});
   }
   if(url.includes('/rpc/mark_all_notifications_read')){readAll=true;return route.fulfill({status:200,contentType:'application/json',body:'true'});}
   let response;
   if(url.includes('/rest/v1/'))response=handleRest(req.method(),url,req.headers());
   else if(url.includes('/auth/v1/'))response=handleAuth(url);
   else return route.abort();
   return route.fulfill({status:response.status,body:response.body,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-expose-headers':'content-range',...response.headers}});
  });
  const page=await context.newPage();
  await page.goto(`${base}/notifications`,{waitUntil:'networkidle'});
  await page.getByText(mode==='before'?'Check-in posted':'Checked in',{exact:true}).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.getByText('NOTIFICATIONS',{exact:true}).waitFor();
  await page.waitForTimeout(1500);
  if(process.env.DEBUG_HEADER)console.log(await page.getByText('NOTIFICATIONS',{exact:true}).evaluate(el=>{let a=[];for(let e=el;e&&a.length<5;e=e.parentElement){const b=e.getBoundingClientRect(),s=getComputedStyle(e);a.push({tag:e.tagName,text:e.textContent?.slice(0,50),x:b.x,y:b.y,w:b.width,h:b.height,opacity:s.opacity,display:s.display,overflow:s.overflow});}return a;}));
  await page.screenshot({path:`${out}/inbox-${width}.png`});
  if(mode!=='before'){
   assert.equal(pages[0].length,21,'20 rows plus one lookahead');
   const auditResult=await page.evaluate(`(${audit})()`);
   assert.deepEqual(auditResult.fail,[],`${width}: layout failures`);
   await page.getByText('Private · Only you',{exact:true}).first().waitFor();
   assert.equal(await page.getByText('MATCH CONFIRMED',{exact:true}).count(),0);
   const geometry=await page.getByTestId(`notification-${tables.notifications[0].id}`).evaluate(el=>{
    const t=[...el.querySelectorAll('div')].filter(x=>['Checked in',"You're at River Overlook Courts."].includes(x.textContent));
    return t.map(x=>({text:x.textContent,left:x.getBoundingClientRect().left}));
   });
   const title=geometry.find(x=>x.text==='Checked in'),body=geometry.find(x=>x.text==="You're at River Overlook Courts.");
   assert.equal(title.left,body.left,'title and body share a left edge');
   failNext=true;
   await page.getByRole('button',{name:'Load 20 more notifications'}).click();
   await page.getByText("Couldn't load notifications.",{exact:true}).waitFor();
   failNext=false;
   await page.getByRole('button',{name:'Try again',exact:true}).click();
   await page.getByRole('button',{name:'Load 20 more notifications'}).waitFor();
   await page.getByRole('button',{name:'Load 20 more notifications'}).click();
   await page.getByTestId(`notification-${tables.notifications[42].id}`).waitFor();
   const delivered=pages.flatMap(ids=>ids.slice(0,20));
   assert.equal(new Set(delivered).size,43,'all events survive the equal-time cursor boundary');
   assert.equal(delivered.length,43,'no duplicate events');
   assert.equal(await page.getByRole('button',{name:'Load 20 more notifications'}).count(),0);
   await page.getByRole('button',{name:'Read all',exact:true}).click();
   await page.getByRole('button',{name:'Read all',exact:true}).waitFor({state:'hidden'});
   results.push({width,events:43,alignedLeft:title.left,layoutFailures:auditResult.fail,checks:['20-row paging','timestamp tie','no duplicates','failure/retry','read all','privacy examples','sentence case'],audit:auditResult});
  }else results.push({width,baseline:true});
  await context.close();
  await browser.close();
 }
}finally{await browser?.close();server?.close();}
writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({audit,...r})=>r),null,2));
