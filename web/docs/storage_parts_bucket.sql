-- Supabase Storage: parts bucket + public read policies
insert into storage.buckets (id, name, public)
values ('parts', 'parts', true)
on conflict (id) do update set public = true;

-- Allow public read access to files in the parts bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_parts_read'
  ) then
    create policy public_parts_read
      on storage.objects
      for select
      using (bucket_id = 'parts');
  end if;
end $$;

-- Allow authenticated uploads to the parts bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'auth_parts_write'
  ) then
    create policy auth_parts_write
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'parts');
  end if;
end $$;
