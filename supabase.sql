-- Run this once in Supabase Dashboard > SQL Editor.
create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 18),
  best_score integer not null default 0 check (best_score >= 0),
  updated_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

drop policy if exists "leaderboard readable by everyone" on public.leaderboard;
create policy "leaderboard readable by everyone" on public.leaderboard for select using (true);

drop policy if exists "users insert own score" on public.leaderboard;
create policy "users insert own score" on public.leaderboard for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update own score" on public.leaderboard;
create policy "users update own score" on public.leaderboard for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists leaderboard_best_score_idx on public.leaderboard(best_score desc);
