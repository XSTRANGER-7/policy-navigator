-- ─────────────────────────────────────────────────────────────────────────────
-- CIVIS AI — Supabase Schema
-- Run this in your Supabase project SQL editor (Dashboard → SQL Editor)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. User Profiles (extends Supabase Auth — stores role)
create table if not exists user_profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  role        text not null default 'citizen'
                check (role in ('citizen', 'agency')),
  full_name   text,
  phone       text,
  organisation text,
  created_at  timestamptz default now()
);

create index if not exists user_profiles_role_idx on user_profiles(role);

-- Auto-create profile row when a user signs up (role passed via user_metadata)
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into user_profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'citizen'),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- 2. Agencies (organisations that review citizen applications)
create table if not exists agencies (
  id              uuid primary key default gen_random_uuid(),
  agency_id       text unique not null,          -- human-readable e.g. AGY-A1B2C3D4
  org_name        text not null,
  org_type        text not null
                    check (org_type in ('Government Body','Ministry','Department','NGO','Municipal Corporation','District Office','Other')),
  state           text not null,
  reg_number      text,
  contact_person  text not null,
  email           text unique not null,
  purpose         text,
  status          text not null default 'active'
                    check (status in ('pending','active','suspended')),
  created_at      timestamptz default now()
);

create index if not exists agencies_email_idx on agencies(email);
create index if not exists agencies_agency_id_idx on agencies(agency_id);

-- RLS for agencies
alter table agencies enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'agencies' and policyname = 'Service: full access agencies') then
    create policy "Service: full access agencies" on agencies for all using (auth.role() = 'service_role');
  end if;
end $$;

-- 3. Government Schemes (sourced from Policy Agent data)
-- Drop and recreate if id column is wrong type (uuid vs text)
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name='schemes' and column_name='id' and data_type='uuid'
  ) then
    drop table if exists applications cascade;
    drop table if exists schemes cascade;
  end if;
end $$;

create table if not exists schemes (
  id              text primary key,
  name            text not null,
  category        text not null default 'general',
  description     text,
  benefits        text,
  eligibility_text text,
  rules           jsonb not null default '{}',
  ministry        text,
  official_url    text,
  source          text default 'builtin',
  state_specific  boolean not null default false,
  scraped_at      timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz default now()
);

-- Add missing columns if the table already existed without them
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='schemes' and column_name='category') then
    alter table schemes add column category text not null default 'general';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='schemes' and column_name='ministry') then
    alter table schemes add column ministry text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='schemes' and column_name='official_url') then
    alter table schemes add column official_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='schemes' and column_name='eligibility_text') then
    alter table schemes add column eligibility_text text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='schemes' and column_name='benefits') then
    alter table schemes add column benefits text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='schemes' and column_name='rules') then
    alter table schemes add column rules jsonb not null default '{}';
  end if;
  -- New columns for scraper
  if not exists (select 1 from information_schema.columns where table_name='schemes' and column_name='source') then
    alter table schemes add column source text default 'builtin';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='schemes' and column_name='state_specific') then
    alter table schemes add column state_specific boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='schemes' and column_name='scraped_at') then
    alter table schemes add column scraped_at timestamptz;
  end if;
end $$;


-- 3. Citizens (form submissions, linked to auth user if logged in)
create table if not exists citizens (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  age         integer,
  income      numeric,
  state       text,
  category    text,
  verified    boolean not null default false,
  verified_at timestamptz,
  created_at  timestamptz default now()
);

-- Add missing columns if table already existed without them
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='citizens' and column_name='user_id') then
    alter table citizens add column user_id uuid references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='citizens' and column_name='email') then
    alter table citizens add column email text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='citizens' and column_name='state') then
    alter table citizens add column state text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='citizens' and column_name='category') then
    alter table citizens add column category text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='citizens' and column_name='verified') then
    alter table citizens add column verified boolean not null default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='citizens' and column_name='verified_at') then
    alter table citizens add column verified_at timestamptz;
  end if;
end $$;

create index if not exists citizens_user_id_idx on citizens(user_id);
create index if not exists citizens_email_idx   on citizens(email);


-- 4. Applications (citizen → scheme application with status tracking)
create table if not exists applications (
  id              uuid default gen_random_uuid() primary key,
  citizen_id      uuid references citizens(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,
  scheme_id       text,  -- references schemes(id) — stored as text key e.g. 'pm_kisan'
  scheme_name     text not null,
  status          text not null default 'started'
                    check (status in (
                      'started',
                      'documents_submitted',
                      'under_review',
                      'approved',
                      'rejected'
                    )),
  docs            jsonb not null default '{}',
  notes           text,
  submitted_at    timestamptz default now(),
  reviewed_at     timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists applications_user_id_idx    on applications(user_id);
create index if not exists applications_citizen_id_idx on applications(citizen_id);
create index if not exists applications_scheme_id_idx  on applications(scheme_id);
create index if not exists applications_status_idx     on applications(status);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now(); return new;
end;
$$;
drop trigger if exists applications_updated_at on applications;
create trigger applications_updated_at
  before update on applications
  for each row execute procedure update_updated_at();

-- Add missing columns to applications if table already existed
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='applications' and column_name='user_id') then
    alter table applications add column user_id uuid references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='applications' and column_name='citizen_id') then
    alter table applications add column citizen_id uuid references citizens(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='applications' and column_name='docs') then
    alter table applications add column docs jsonb not null default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='applications' and column_name='notes') then
    alter table applications add column notes text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='applications' and column_name='reviewed_at') then
    alter table applications add column reviewed_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='applications' and column_name='updated_at') then
    alter table applications add column updated_at timestamptz default now();
  end if;
end $$;


-- 5. Credentials (VC issued after eligibility pipeline)
create table if not exists credentials (
  id              uuid default gen_random_uuid() primary key,
  citizen_id      uuid references citizens(id) on delete set null,
  citizen_did     text,
  vc_json         jsonb not null,
  schemes         jsonb not null default '[]',
  total_eligible  integer default 0,
  issued_at       timestamptz default now(),
  expires_at      timestamptz,
  created_at      timestamptz default now()
);

create index if not exists credentials_citizen_id_idx on credentials(citizen_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table user_profiles enable row level security;
alter table schemes        enable row level security;
alter table citizens       enable row level security;
alter table applications   enable row level security;
alter table credentials    enable row level security;

-- Drop existing policies before recreating (safe re-run)
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
    where tablename in ('schemes','user_profiles','citizens','applications','credentials')
  loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- Schemes: anyone can read, only service role writes
create policy "Public: read active schemes"
  on schemes for select using (is_active = true);
create policy "Service: write schemes"
  on schemes for all using (auth.role() = 'service_role');

-- User Profiles: own row only
create policy "Users: read own profile"
  on user_profiles for select using (auth.uid() = id);
create policy "Users: update own profile"
  on user_profiles for update using (auth.uid() = id);
create policy "Service: full access profiles"
  on user_profiles for all using (auth.role() = 'service_role');

-- Citizens: own row + service role
create policy "Users: read own citizen"
  on citizens for select using (user_id = auth.uid());
create policy "Users: insert own citizen"
  on citizens for insert with check (user_id = auth.uid() or user_id is null);
create policy "Service: full access citizens"
  on citizens for all using (auth.role() = 'service_role');

-- Applications: own rows + service role
create policy "Users: read own applications"
  on applications for select using (user_id = auth.uid());
create policy "Users: insert own applications"
  on applications for insert with check (user_id = auth.uid() or user_id is null);
create policy "Service: full access applications"
  on applications for all using (auth.role() = 'service_role');

-- Credentials: readable by anyone (public VC lookup), writable only by service role
create policy "Public: read credentials"
  on credentials for select using (true);
create policy "Service: full access credentials"
  on credentials for all using (auth.role() = 'service_role');
