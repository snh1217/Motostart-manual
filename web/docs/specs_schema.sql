-- Specs (torque/oil/clearance/consumable)
create table if not exists public.specs (
  id text primary key,
  model text not null,
  category text not null, -- torque | oil | clearance | consumable
  item text not null,
  value text not null,
  note text,
  updated_at timestamptz default now()
);

create index if not exists specs_model_idx on public.specs(model);
create index if not exists specs_category_idx on public.specs(category);
create index if not exists specs_updated_idx on public.specs(updated_at desc);
