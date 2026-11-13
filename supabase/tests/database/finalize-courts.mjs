// Disposable PostgreSQL engine. Never connects to a deployed database.
// PGLITE_MODULE_PATH=/tmp/localcheck-db-test/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/database/finalize-courts.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
const db = new PGlite();
const root = new URL('../../..', import.meta.url);
const file = path => readFileSync(new URL(path, root), 'utf8');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const paid=id(1),free=id(2),friend=id(3),blocked=id(4),court=id(10);
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
const asUser = async (user, sql) => {
 await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
 try { return await db.query(sql); } finally { await db.exec('reset role'); }
};
const denied = async (user,sql) => { let error; try {await asUser(user,sql);}catch(e){error=e;}assert.ok(error,`must deny: ${sql}`); };
try {
await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;
 create table profiles(id uuid primary key,local_court_id uuid,is_pro boolean default false,account_tag text,display_name text,username text,share_auto_check_ins boolean default true,notify_friend_check_ins boolean default true);
 create table courts(id uuid primary key,name text,short_name text,is_archived boolean default false);
 create table friendships(requester_id uuid,addressee_id uuid,status text);
 create table check_ins(id uuid primary key default gen_random_uuid(),user_id uuid,court_id uuid,source text default 'manual',visibility text default 'public',checked_in_at timestamptz default now(),checked_out_at timestamptz);
 create table notifications(id uuid primary key default gen_random_uuid(),user_id uuid,type text,actor_id uuid,title text,body text,data jsonb,dedupe_key text unique,push_status text default 'pending',created_at timestamptz default now(),constraint notifications_type_check check(type is not null));
 create table private.timers(id uuid primary key default gen_random_uuid(),kind text,ref_id uuid,run_at timestamptz,fired_at timestamptz,result text,constraint timers_kind_check check(kind is not null),unique(kind,ref_id,run_at));
 create function private.is_test_court(uuid) returns boolean language sql as $$select false$$;
 create function private.viewer_sees_test_data() returns boolean language sql as $$select false$$;
 create function private.is_hidden_account(uuid) returns boolean language sql as $$select false$$;
 create function private.users_are_blocked(a uuid,b uuid) returns boolean language sql as $$select b='${blocked}'::uuid$$;
 create function private.send_invalidation(text,text,text) returns void language plpgsql as $$begin end$$;
 create function private.schedule_timer(k text,r uuid,t timestamptz) returns uuid language plpgsql as $$declare v uuid;begin insert into private.timers(kind,ref_id,run_at) values(k,r,t) on conflict(kind,ref_id,run_at) do update set run_at=excluded.run_at returning id into v;return v;end$$;
 create function private.create_notification(u uuid,t text,a uuid,f uuid,r uuid,m uuid,title text,body text,data jsonb,d text) returns void language sql as $$insert into public.notifications(user_id,type,actor_id,title,body,data,dedupe_key) values(u,t,a,title,body,data,d) on conflict(dedupe_key) do nothing$$;
 grant select on profiles,courts to authenticated;
 insert into courts(id,name,short_name) select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'Court '||i,null from generate_series(10,16)i;
 insert into profiles(id,local_court_id,is_pro,display_name) values('${paid}','${court}',true,'Paid'),('${free}','${court}',false,'Free'),('${friend}','${court}',false,'Friend'),('${blocked}','${court}',false,'Blocked');
 insert into friendships values('${paid}','${friend}','accepted'),('${paid}','${blocked}','accepted');
`);
for(const name of ['expire_challenge','remind_challenge','post_auto_check_in','settle_due_match'])await db.exec(`create function private.${name}(uuid) returns text language sql as $$select 'stub'::text$$;`);
await db.exec(file('supabase/tests/database/fixtures/20261113-notification-functions.sql'));
await db.exec(file('supabase/migrations/20261113100000_saved_courts.sql'));
await db.exec(file('supabase/migrations/20261113110000_complete_check_in_notifications.sql'));

for(let i=11;i<=14;i++)await asUser(paid,`select set_court_saved('${id(i)}',true)`);
assert.equal((await asUser(paid,'select * from my_saved_courts()')).rows.length,5);
assert.equal((await asUser(paid,'select * from my_saved_courts()')).rows[0].court_id,court,'local stays first');
await denied(paid,`select set_court_saved('${id(15)}',true)`);
await asUser(paid,`select set_court_saved('${id(11)}',true)`); // idempotent
await denied(free,`select set_court_saved('${id(11)}',true)`);
assert.equal((await asUser(free,'select * from saved_courts')).rows.length,0,'RLS hides another owner');
await denied(paid,`insert into saved_courts values('${free}','${id(16)}',now())`);
await asUser(paid,`select set_court_saved('${id(11)}',false)`);
assert.equal((await asUser(paid,'select * from my_saved_courts()')).rows.length,4);
assert.equal(await scalar(`select local_court_id::text from profiles where id='${paid}'`),court,'saving never replaces local court');
await db.exec(`update profiles set is_pro=false where id='${paid}'`);
assert.equal((await asUser(paid,'select * from my_saved_courts()')).rows.length,1,'downgrade exposes local only without deleting saves');
await db.exec(`update profiles set is_pro=true where id='${paid}'`);

const visit=id(30);
await db.exec(`insert into check_ins(id,user_id,court_id,checked_in_at) values('${visit}','${paid}','${court}',now()-interval '2 minutes')`);
assert.equal(await scalar(`select count(*)::int from notifications where user_id='${paid}' and type='auto_check_in'`),1);
assert.equal(await scalar(`select push_status from notifications where type='auto_check_in'`),'skipped','own log does not send redundant push');
assert.equal(await scalar(`select count(*)::int from private.timers where kind='manual_check_in_notice'`),1);
const timer=await scalar(`select id from private.timers where kind='manual_check_in_notice'`);
await db.query(`select private.run_timer('${timer}')`);
assert.equal(await scalar(`select count(*)::int from notifications where type='friend_check_in' and user_id='${friend}'`),1);
assert.equal(await scalar(`select count(*)::int from notifications where type='friend_check_in' and user_id='${blocked}'`),0);
await db.query(`select private.run_timer('${timer}')`);
assert.equal(await scalar(`select count(*)::int from notifications where type='friend_check_in'`),1,'timer retry never duplicates notices');
await db.exec(`update check_ins set visibility='private',checked_out_at=now() where id='${visit}'`);
assert.equal(await scalar(`select data->>'visibility' from notifications where type='auto_check_in'`),'public','historical audience does not change');
assert.equal(await scalar(`select count(*)::int from notifications where type='auto_check_out'`),1);
for(const [n,visibility,sharing,receive,ended] of [[31,'private',true,true,false],[32,'public',false,true,false],[33,'friends',true,false,false],[34,'public',true,true,true]]){
 await db.exec(`delete from notifications where type='friend_check_in';update profiles set share_auto_check_ins=${sharing} where id='${paid}';update profiles set notify_friend_check_ins=${receive} where id='${friend}';insert into check_ins(id,user_id,court_id,visibility,checked_in_at) values('${id(n)}','${paid}','${court}','${visibility}',now()-interval '2 minutes');${ended?`update check_ins set checked_out_at=now() where id='${id(n)}';`:''}`);
 await db.query(`select private.notify_manual_check_in('${id(n)}')`);
 assert.equal(await scalar(`select count(*)::int from notifications where type='friend_check_in'`),0,`privacy/preference/checkout case ${n}`);
}
await db.exec(`insert into check_ins(id,user_id,court_id,checked_in_at) values('${id(40)}','${paid}','${court}',now()-interval '46 minutes')`);
await db.query(`select private.end_check_in('${id(40)}')`);
assert.equal(await scalar(`select count(*)::int from notifications where dedupe_key='own_check_out:${id(40)}'`),0,'timer retains its one actionable checkout notice');
assert.equal(await scalar(`select data->>'visibility' from notifications where dedupe_key='auto_check_out:${id(40)}'`),'public');
console.log('PASS: saved-court cap/idempotency/ownership/free/downgrade/default and notification delay/privacy/preferences/blocking/snapshot/retry/checkout');
} finally {await db.close();}
