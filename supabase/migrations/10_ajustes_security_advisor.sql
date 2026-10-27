-- =============================================================
-- 10_ajustes_security_advisor.sql
-- Correções apontadas pelo Security Advisor do Supabase.
-- (Migrations já aplicadas não são editadas: as mudanças vêm numa nova.)
-- Pode rodar de novo sem erro.
-- =============================================================

-- -------------------------------------------------------------
-- 1. "Public Bucket Allows Listing"
-- A política de SELECT em storage.objects deixava qualquer pessoa LISTAR
-- todos os arquivos do bucket. Ela não é necessária: o bucket é público,
-- então cada imagem continua abrindo pela URL pública
-- (/storage/v1/object/public/produtos/...), que não passa pelo RLS.
-- O upload do admin usa só INSERT (sem upsert), que tem política própria.
-- -------------------------------------------------------------
drop policy if exists "imagens: leitura pública" on storage.objects;

-- -------------------------------------------------------------
-- 2. "Signed-In Users Can Execute SECURITY DEFINER Function" em eh_admin()
-- eh_admin() só é usada DENTRO das políticas RLS; o site nunca a chama.
-- Ela vai para o schema "interno", que a API REST não publica: continua
-- funcionando nas políticas (que guardam a função pelo id, não pelo nome),
-- mas deixa de ser um endpoint /rest/v1/rpc/eh_admin.
-- -------------------------------------------------------------
create schema if not exists interno;
revoke all on schema interno from public, anon;
grant usage on schema interno to authenticated;  -- necessário para as políticas rodarem

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'eh_admin') then
    alter function public.eh_admin() set schema interno;
  end if;
end;
$$;

revoke execute on function interno.eh_admin() from public, anon;
grant execute on function interno.eh_admin() to authenticated;

-- -------------------------------------------------------------
-- 3. As outras funções SECURITY DEFINER continuam chamáveis por usuários
-- logados DE PROPÓSITO (aviso aceito, ver docs/SEGURANCA.md):
--   adicionar_ao_carrinho, alterar_quantidade_carrinho, remover_do_carrinho,
--   finalizar_pedido e excluir_minha_conta
-- Elas são a ÚNICA forma de gravar no carrinho e nos pedidos (o cliente não
-- tem permissão de escrita nessas tabelas). Cada uma confere auth.uid(),
-- valida as entradas, usa search_path = '' e não aceita preço nem total.
-- Visitantes (anon) não podem chamá-las.
-- -------------------------------------------------------------
