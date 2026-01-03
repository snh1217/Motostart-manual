-- Login codes (user/admin access)
create table if not exists public.login_codes (
  id text primary key,
  role text not null default 'user', -- user | admin
  name text not null,
  code text not null,
  memo text,
  active boolean default true,
  updated_at timestamptz default now()
);

create unique index if not exists login_codes_code_uidx on public.login_codes(code);
create index if not exists login_codes_role_idx on public.login_codes(role);
create index if not exists login_codes_active_idx on public.login_codes(active);
create index if not exists login_codes_updated_idx on public.login_codes(updated_at desc);
