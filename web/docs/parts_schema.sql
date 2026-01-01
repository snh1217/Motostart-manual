-- Parts (components & disassembly steps)
create table if not exists public.parts (
  id text primary key,
  model text not null,
  system text not null, -- engine | chassis | electrical | other
  name text not null,
  summary text,
  tags text[],
  photos jsonb, -- [{id,url,label,desc,tags}]
  steps jsonb,  -- [{order,title,desc,tools,torque,note,photoIds:[]}]
  updated_at timestamptz default now()
);

create index if not exists parts_model_idx on public.parts(model);
create index if not exists parts_system_idx on public.parts(system);
create index if not exists parts_updated_idx on public.parts(updated_at desc);
