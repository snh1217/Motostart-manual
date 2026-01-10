-- Supabase Storage: manuals bucket + public read policies
insert into storage.buckets (id, name, public)
values ('manuals', 'manuals', true)
on conflict (id) do update set public = true;

-- Allow public read access to files in the manuals bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_manuals_read'
  ) then
    create policy public_manuals_read
      on storage.objects
      for select
      using (bucket_id = 'manuals');
  end if;
end $$;

-- Allow authenticated uploads/updates to the manuals bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'auth_manuals_write'
  ) then
    create policy auth_manuals_write
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'manuals');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'auth_manuals_update'
  ) then
    create policy auth_manuals_update
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'manuals')
      with check (bucket_id = 'manuals');
  end if;
end $$;
