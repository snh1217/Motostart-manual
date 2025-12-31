create extension if not exists vector;

create table if not exists public.manual_chunks (
  id text primary key,
  entry_id text not null,
  model text not null,
  manual_type text not null,
  title text,
  file text,
  page_start int,
  page_end int,
  chunk_index int,
  text text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

create index if not exists manual_chunks_entry_idx on public.manual_chunks (entry_id);
create index if not exists manual_chunks_model_idx on public.manual_chunks (model);
-- vector index (requires embedding filled)
create index if not exists manual_chunks_embedding_idx
  on public.manual_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
