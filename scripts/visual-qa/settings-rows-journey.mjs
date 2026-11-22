// Real Settings route; all service traffic is fulfilled from isolated fixtures.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
process.env.FAKE_NOW=String(Date.parse('2026-11-22T18:00:00Z'));
const { handleAuth,handleRest,SESSION }=await import('./mock.mjs');
const { tables,ME,COURT }=await import('./fixtures.mjs');
const [base,out]=process.argv.slice(2); assert.ok(base&&out);
const strict=process.env.EXPECT_SETTINGS==='1';
const original=structuredClone(tables),results=[];
const qr=execFileSync('curl',['-fsSL','https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js']);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {
 for(const width of (process.env.WIDTHS||'320,375,393,430').split(',').map(Number)) {
  for(const variant of ['normal','long']) {
   if(variant==='long'&&![320,393].includes(width))continue;
   for(const key of Object.keys(original))tables[key]=structuredClone(original[key]);
   const profile=tables.profiles.find(p=>p.id===ME);profile.account_tag='TEST';
   if(variant==='long'){
    profile.username='longplayername123456789012';
    for(const key of ['courts','courts_with_stats'])Object.assign(tables[key].find(c=>c.id===COURT),{name:'Rancho Cienega Sports Complex',short_name:null});
   }
   const context=await browser.newContext({viewport:{width,height:width===375?667:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
   await context.clock.setFixedTime(new Date(Number(process.env.FAKE_NOW)));
   await context.addInitScript(s=>localStorage.setItem('sb-qkrnmyexzvaxiqfxwwfb-auth-token',JSON.stringify(s)),SESSION);
   await context.routeWebSocket(/.*/,s=>s.close());
   const writes=[];
   await context.route('**/*',async route=>{
    const req=route.request(),url=req.url();if(url.startsWith(base))return route.continue();
    if(url.includes('cdn.jsdelivr.net/npm/jsqr'))return route.fulfill({contentType:'application/javascript',body:qr});
    let response;
    if(url.includes('/rest/v1/rpc/set_push_notifications_enabled')){
     writes.push(req.postDataJSON());profile.push_notifications_enabled=false;response={status:200,body:'false'};
    }else if(url.includes('/rest/v1/'))response=handleRest(req.method(),url,req.headers());
    else if(url.includes('/auth/v1/'))response=handleAuth(url);
    else return route.abort();
    return route.fulfill({status:response.status,body:response.body,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-expose-headers':'content-range',...response.headers}});
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(`${base}/settings`,{waitUntil:'networkidle'});
   await page.getByText('PREFERENCES',{exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
   const align=async title=>{
    await page.getByText(title,{exact:true}).evaluate(el=>{
     let p=el.parentElement;while(p){const css=getComputedStyle(p);if(/auto|scroll/.test(css.overflowY)&&p.scrollHeight>p.clientHeight){p.scrollTop+=el.getBoundingClientRect().top-p.getBoundingClientRect().top-12;break;}p=p.parentElement;}
    });await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(150);
   };
   const capture=async state=>{
    const metrics=await page.evaluate(()=>{
     const rows=[...document.querySelectorAll('[data-testid^="settings-row-"]')].filter(e=>e.dataset.testid!=='settings-row-icon'&&e.dataset.testid!=='settings-row-copy'&&e.dataset.testid!=='settings-row-label'&&e.dataset.testid!=='settings-row-detail'&&e.dataset.testid!=='settings-row-value'&&e.dataset.testid!=='settings-row-accessory');
     return rows.map(row=>{const r=row.getBoundingClientRect(),a=row.querySelector('[data-testid="settings-row-accessory"]').getBoundingClientRect(),label=row.querySelector('[data-testid="settings-row-label"]'),detail=row.querySelector('[data-testid="settings-row-detail"]');
      return {label:label.textContent,width:r.width,height:r.height,rightInset:r.right-a.right,centerError:a.y+a.height/2-r.y-r.height/2,labelSize:parseFloat(getComputedStyle(label).fontSize),detailSize:detail?parseFloat(getComputedStyle(detail).fontSize):null,overflow:[...row.querySelectorAll('[data-testid="settings-row-label"],[data-testid="settings-row-value"],[data-testid="settings-row-detail"]')].some(el=>el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)};});
    });
    const name=`settings-${state}-${width}-${variant}`;await page.screenshot({path:`${out}/${name}.png`});results.push({name,width,variant,metrics});
    if(strict)assert.equal(await page.getByRole('switch',{name:'PUSH NOTIFICATIONS',exact:true}).evaluate(el=>getComputedStyle(el.previousElementSibling).backgroundColor),'rgb(255, 255, 255)','white switch thumb on and off');
    if(strict){assert.ok(metrics.length>10,'shared row owns every main Settings row');for(const r of metrics){assert.ok(!r.overflow,`${name}: ${r.label} fits`);assert.ok(Math.abs(r.rightInset-16)<=1,`${name}: ${r.label} trailing inset`);assert.ok(Math.abs(r.centerError)<=1,`${name}: ${r.label} centered accessory`);assert.equal(r.labelSize,14);if(r.detailSize!==null)assert.equal(r.detailSize,12);}}
   };
   if(variant==='normal')await capture('top');
   await align('PREFERENCES');await capture('preferences');
   await align('ALERTS');await capture('alerts');
   await align('ACCOUNT DETAILS');await capture('account');
   if(width===375&&variant==='normal'){
    await align('ALERTS');const toggle=page.getByRole('switch',{name:'PUSH NOTIFICATIONS',exact:true});
    assert.equal(await toggle.isChecked(),true);await toggle.click();
    await page.waitForFunction(()=>document.querySelector('[role="switch"][aria-label="PUSH NOTIFICATIONS"]')?.checked===false);
    await page.waitForTimeout(250);await capture('push-off');assert.equal(writes.length,1,'one isolated preference write');
    await page.getByText('NOTIFICATION INBOX',{exact:true}).click();await page.waitForURL('**/notifications');
   }
   assert.deepEqual(errors,[]);await context.close();
  }
 }
}finally{writeFileSync(`${out}/measurements.json`,JSON.stringify({source:base,strict,fixtureIsolation:true,results},null,2));await browser.close();}
console.log(`${results.length} Settings captures; strict=${strict}`);
