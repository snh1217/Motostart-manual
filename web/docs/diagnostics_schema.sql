create table if not exists public.diagnostics (
  id text primary key,
  model text not null,
  title text not null,
  section text,
  image text not null,
  video_url text,
  lines jsonb not null,
  note text,
  updated_at date default current_date
);

create index if not exists diagnostics_model_idx on public.diagnostics (model);
