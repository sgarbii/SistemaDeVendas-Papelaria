-- =============================================================
-- 07_storage.sql
-- Bucket "produtos" para as imagens dos produtos (seção 7).
-- Leitura pública; envio, troca e exclusão só para o admin (RNF15).
--
-- Só PNG, JPEG e WEBP de até 2 MB. SVG e HTML ficam bloqueados porque
-- podem carregar script (XSS). O site dá a cada arquivo um nome UUID.
-- Pode rodar de novo sem erro: o bucket é atualizado.
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "imagens: leitura pública" on storage.objects;
drop policy if exists "imagens: admin envia" on storage.objects;
drop policy if exists "imagens: admin altera" on storage.objects;
drop policy if exists "imagens: admin exclui" on storage.objects;

create policy "imagens: leitura pública"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'produtos');

create policy "imagens: admin envia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'produtos'
    and (select public.eh_admin())
    and lower(storage.extension(name)) in ('png', 'jpg', 'webp')
  );

create policy "imagens: admin altera"
  on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and (select public.eh_admin()))
  with check (
    bucket_id = 'produtos'
    and (select public.eh_admin())
    and lower(storage.extension(name)) in ('png', 'jpg', 'webp')
  );

create policy "imagens: admin exclui"
  on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and (select public.eh_admin()));
