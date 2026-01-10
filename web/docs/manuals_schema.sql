-- Manuals manifest entries (for DB-backed uploads)
create table if not exists public.manuals (
  id text primary key,
  model text not null,
  manual_type text not null, -- engine | chassis | user | wiring
  section text not null,
  title text not null,
  title_ko text,
  language text not null default 'ko',
  doc_code text,
  doc_date text,
  pages jsonb not null,
  source_pdf text,
  file text not null,
  ko_file text,
  updated_at timestamptz default now()
);

create index if not exists manuals_model_idx on public.manuals(model);
create index if not exists manuals_type_idx on public.manuals(manual_type);
create index if not exists manuals_updated_idx on public.manuals(updated_at desc);
