create schema auth;
create schema private;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public, private, auth to authenticated, anon;
create table public.courts(id uuid primary key, name text not null, short_name text, is_archived boolean not null default false, is_test boolean not null default false, added_by uuid, verification_status text default 'verified');
create table public.profiles(id uuid primary key, local_court_id uuid references courts(id), is_pro boolean not null default false, account_tag text, visibility text default 'public');
create table public.check_ins(id uuid primary key default gen_random_uuid(),user_id uuid,court_id uuid,checked_out_at timestamptz,source text);
create table private.auto_check_in_arrivals(user_id uuid primary key,court_id uuid,arrived_at timestamptz default now());
create function private.send_invalidation(text,text,text) returns void language sql as $$ select $$;
create function private.viewer_sees_test_data() returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles where id=auth.uid() and account_tag in ('TEST','REVIEWER','FOUNDER'))$$;
insert into courts(id,name) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Court '||n from generate_series(1,8)n;
insert into courts(id,name,is_test) values ('00000000-0000-4000-8000-000000000009','Hidden court',true);
insert into profiles(id,is_pro,local_court_id) values
 ('11111111-1111-4111-8111-111111111111',true,'00000000-0000-4000-8000-000000000001'),
 ('22222222-2222-4222-8222-222222222222',false,'00000000-0000-4000-8000-000000000001'),
 ('33333333-3333-4333-8333-333333333333',true,'00000000-0000-4000-8000-000000000001');
alter table profiles add column display_name text, add column username text, add column share_auto_check_ins boolean default false;
alter table check_ins add column visibility text, add column checked_in_at timestamptz default now();
alter table public.courts enable row level security;
grant select on public.courts to authenticated;
create policy courts_visible on public.courts for select to authenticated using (
  not is_archived and (verification_status <> 'needs_review' or added_by=auth.uid())
  and (not is_test or added_by=auth.uid() or private.viewer_sees_test_data())
);
