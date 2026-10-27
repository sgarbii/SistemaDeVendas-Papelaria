-- =============================================================
-- 05_avaliacoes.sql
-- Avaliações (RF02): preenchimento automático e nota média.
-- As regras de quem pode avaliar e editar estão nas políticas RLS (06_rls.sql).
-- =============================================================

-- Antes de gravar uma avaliação nova, o banco preenche sozinho o produto,
-- o autor e a data. Assim o cliente não consegue informar outro produto,
-- outro autor ou uma data falsa (que burlaria os 7 dias da RN01).
-- NÃO é SECURITY DEFINER: roda com as permissões do cliente, então só
-- enxerga os itens de pedido dele (RLS de pedido_itens).
create or replace function public.preencher_avaliacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cliente_id   := auth.uid();
  new.publicado_em := now();

  select produto_id into new.produto_id
    from public.pedido_itens
   where id = new.pedido_item_id;

  if new.produto_id is null then
    -- RNF07: quem não comprou não avalia
    raise exception 'Só é possível avaliar produtos que você comprou.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger antes_de_inserir_avaliacao
  before insert on public.avaliacoes
  for each row execute function public.preencher_avaliacao();

-- calcularNotaMedia(): recalcula produtos.nota_media sempre que as avaliações mudam.
-- É SECURITY DEFINER porque o cliente não tem permissão de alterar produtos.
create or replace function public.atualizar_nota_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produto_id bigint := coalesce(new.produto_id, old.produto_id);
begin
  update public.produtos
     set nota_media = coalesce(
           (select round(avg(nota), 1) from public.avaliacoes where produto_id = v_produto_id),
           0)
   where id = v_produto_id;
  return null;
end;
$$;

create trigger depois_de_mudar_avaliacao
  after insert or update or delete on public.avaliacoes
  for each row execute function public.atualizar_nota_media();
