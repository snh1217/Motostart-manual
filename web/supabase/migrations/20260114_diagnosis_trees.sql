-- Diagnosis trees (JSONB nodes, single row per tree_id)
create extension if not exists pgcrypto;

create table if not exists public.diagnosis_trees (
  id uuid primary key default gen_random_uuid(),
  tree_id text unique not null,
  title_ko text,
  title_en text,
  category text,
  supported_models text[] default '{}'::text[],
  start_node_id text not null,
  nodes jsonb not null,
  version int not null default 1,
  is_active boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by text
);

create index if not exists diagnosis_trees_active_idx on public.diagnosis_trees (is_active);

alter table public.diagnosis_trees enable row level security;

-- Read policy (public or authenticated, adjust to project rules)
create policy diagnosis_trees_read on public.diagnosis_trees
  for select
  using (true);

-- Write policy (admin only: adjust to your auth model)
create policy diagnosis_trees_write on public.diagnosis_trees
  for all
  using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');
