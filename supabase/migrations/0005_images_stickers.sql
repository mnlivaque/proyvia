-- Proyvia · 0005 · Imágenes en las tareas (Supabase Storage) y stickers

-- Stickers (como en Trello) y portada de la tarjeta
alter table public.cards add column if not exists stickers text[] not null default '{}';
alter table public.cards add column if not exists cover_path text;
alter table public.cards drop constraint if exists cards_stickers_max;
alter table public.cards add constraint cards_stickers_max check (coalesce(array_length(stickers, 1), 0) <= 8);

-- Las imágenes se guardan como adjuntos de tipo 'image', con su ruta en Storage
alter table public.attachments add column if not exists storage_path text;
alter table public.attachments drop constraint if exists attachments_kind_check;
alter table public.attachments add constraint attachments_kind_check check (kind in ('reference', 'deliverable', 'image'));
alter table public.attachments drop constraint if exists attachments_source_check;
alter table public.attachments add constraint attachments_source_check check (source in ('drive', 'url', 'storage'));

-- Bucket privado: ruta = <project_id>/<card_id>/<archivo>. Máx. 10 MB, solo imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', false, 10485760, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_project(p_name text)
returns uuid language sql immutable as $$
  select case when (storage.foldername(p_name))[1] ~ '^[0-9a-f-]{36}$'
              then ((storage.foldername(p_name))[1])::uuid end;
$$;

drop policy if exists "imagenes: miembros ven" on storage.objects;
drop policy if exists "imagenes: editores suben" on storage.objects;
drop policy if exists "imagenes: editores borran" on storage.objects;
create policy "imagenes: miembros ven" on storage.objects for select to authenticated
  using (bucket_id = 'card-images' and public.is_member(public.storage_project(name)));
create policy "imagenes: editores suben" on storage.objects for insert to authenticated
  with check (bucket_id = 'card-images' and public.can_edit(public.storage_project(name)));
create policy "imagenes: editores borran" on storage.objects for delete to authenticated
  using (bucket_id = 'card-images' and public.can_edit(public.storage_project(name)));

-- Búsqueda rápida en títulos, descripciones y comentarios
create extension if not exists pg_trgm;
create index if not exists cards_title_trgm on public.cards using gin (title gin_trgm_ops);
create index if not exists comments_body_trgm on public.comments using gin (body gin_trgm_ops);
