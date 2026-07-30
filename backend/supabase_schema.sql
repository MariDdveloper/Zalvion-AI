-- ==========================================================================
-- Zalvion AI — Supabase schema (esegui una sola volta nello SQL Editor)
-- Dashboard Supabase -> SQL Editor -> New query -> incolla tutto -> Run
-- ==========================================================================

create table if not exists users (
  user_id text primary key,
  email text unique not null,
  name text,
  picture text,
  plan text default 'free',
  subscription_id text,
  plan_type text,
  created_at timestamptz default now()
);

create table if not exists user_sessions (
  id bigint generated always as identity primary key,
  user_id text not null,
  session_token text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
create index if not exists idx_user_sessions_token on user_sessions(session_token);

create table if not exists otps (
  id bigint generated always as identity primary key,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
create index if not exists idx_otps_email on otps(email);

create table if not exists usage (
  id bigint generated always as identity primary key,
  user_id text not null,
  date date not null,
  count int default 0,
  unique(user_id, date)
);

create table if not exists chats (
  id bigint generated always as identity primary key,
  chat_id text unique not null,
  user_id text not null,
  folder_id text,
  title text,
  messages jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_chats_user on chats(user_id);

create table if not exists folders (
  id bigint generated always as identity primary key,
  folder_id text unique not null,
  user_id text not null,
  name text,
  created_at timestamptz default now()
);

create table if not exists app_config (
  key text primary key,
  mode text,
  product_id text,
  monthly_plan_id text,
  yearly_plan_id text
);
