-- =============================================================
-- 11_fotos_e_tempo_real.sql
-- 1. Troca as imagens do seed: os desenhos SVG viram fotos WEBP
--    (img/produtos/*.webp, no próprio site).
-- 2. Liga o Supabase Realtime na tabela de pedidos, para o painel
--    do administrador avisar na hora quando chega um pedido novo.
--
-- Rode depois da 10, no SQL Editor do Supabase.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Fotos dos produtos
-- A regra do CHECK passa a aceitar só .webp para as imagens locais.
-- As do Storage (upload do admin) continuam iguais.
-- -------------------------------------------------------------
alter table public.produtos drop constraint if exists produtos_imagem_url_check;

update public.produtos
   set imagem_url = regexp_replace(imagem_url, '\.svg$', '.webp')
 where imagem_url ~ '^/img/produtos/[a-z0-9-]+\.svg$';

alter table public.produtos add constraint produtos_imagem_url_check check (
  imagem_url ~ '^/img/produtos/[a-z0-9-]+\.webp$'
  or imagem_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/produtos/[a-f0-9-]+\.(png|jpg|webp)$'
);

-- -------------------------------------------------------------
-- 2. Tempo real no painel
-- O Realtime respeita o RLS: cada usuário só recebe os eventos das
-- linhas que ele já pode ler. Pela política "pedidos: dono ou admin lê"
-- (06_rls.sql), só o admin recebe os pedidos de todos os clientes.
-- -------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;
