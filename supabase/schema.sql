-- Daily Jeopardy starter schema for Supabase.
-- Run this in Supabase Dashboard > SQL Editor.
-- NOTE: This starter prioritizes easy setup for a small private friend group.
-- For a public launch, harden policies and move answer checking/score awarding into
-- SECURITY DEFINER RPC functions so players cannot inspect answer_keys or alter scores.

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null default 'FRIENDS TRIVIA',
  day_key text not null,
  status text not null default 'lobby',
  host_player_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  is_host boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, name)
);

alter table public.rooms drop constraint if exists rooms_host_player_id_fkey;
alter table public.rooms add constraint rooms_host_player_id_fkey
  foreign key (host_player_id) references public.players(id) on delete set null;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  category text not null,
  value integer not null check (value > 0),
  prompt text not null,
  board_order integer not null default 0,
  day_key text not null,
  status text not null default 'open' check (status in ('open','revealed')),
  created_at timestamptz not null default now(),
  unique (room_id, category, value, day_key)
);

create table if not exists public.answer_keys (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.questions(id) on delete cascade,
  answer text not null,
  accepted_answers text[] not null default '{}'
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  answer text not null,
  is_correct boolean not null default false,
  points_awarded integer not null default 0,
  submitted_at timestamptz not null default now(),
  unique (question_id, player_id)
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  daily_score integer not null default 0,
  total_score integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (room_id, player_id)
);

create index if not exists players_room_idx on public.players(room_id);
create index if not exists questions_room_idx on public.questions(room_id);
create index if not exists submissions_room_question_idx on public.submissions(room_id, question_id);
create index if not exists scores_room_idx on public.scores(room_id);

-- Enable RLS. Policies below are intentionally broad for a room-code prototype.
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.questions enable row level security;
alter table public.answer_keys enable row level security;
alter table public.submissions enable row level security;
alter table public.scores enable row level security;

drop policy if exists "room code access" on public.rooms;
create policy "room code access" on public.rooms for all to anon, authenticated using (true) with check (true);
drop policy if exists "players room access" on public.players;
create policy "players room access" on public.players for all to anon, authenticated using (true) with check (true);
drop policy if exists "questions room access" on public.questions;
create policy "questions room access" on public.questions for all to anon, authenticated using (true) with check (true);
drop policy if exists "answer key access" on public.answer_keys;
create policy "answer key access" on public.answer_keys for all to anon, authenticated using (true) with check (true);
drop policy if exists "submissions room access" on public.submissions;
create policy "submissions room access" on public.submissions for all to anon, authenticated using (true) with check (true);
drop policy if exists "scores room access" on public.scores;
create policy "scores room access" on public.scores for all to anon, authenticated using (true) with check (true);

-- Enable realtime updates for the tables used by the live board.
do $$ begin
  alter publication supabase_realtime add table public.players;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.questions;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.submissions;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.scores;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null; when others then null; end $$;
