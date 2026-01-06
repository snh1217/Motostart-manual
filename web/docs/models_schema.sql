-- Models metadata (including per-model parts list PDFs)
create table if not exists public.models (
  id text primary key,
  name text not null,
  parts_engine_url text,
  parts_chassis_url text,
  updated_at timestamptz default now()
);

create index if not exists models_updated_idx on public.models(updated_at desc);
