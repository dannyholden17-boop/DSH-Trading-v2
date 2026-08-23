-- ============================================================
-- Fluxi memory — per-user learning store
-- Lets Fluxi's memory (facts you teach it, self-derived lessons, its call
-- journal + hit-rate) follow a signed-in user across devices. Without this
-- table Fluxi still learns — it just keeps memory locally in the browser.
--
-- Paste into the Supabase SQL editor and Run:
--   https://supabase.com/dashboard/project/pyzcwddyagodmtjuvwdn/sql/new
-- Safe to re-run.
-- ============================================================

create table if not exists public.fluxi_memory (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.fluxi_memory enable row level security;

-- each user reads/writes only their own memory
drop policy if exists fluxi_mem_rw on public.fluxi_memory;
create policy fluxi_mem_rw on public.fluxi_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.fluxi_memory to authenticated;
