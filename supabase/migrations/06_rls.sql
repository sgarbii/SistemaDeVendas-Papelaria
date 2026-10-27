-- =============================================================
-- 06_rls.sql
-- Permissões: RLS em todas as tabelas (RNF14, RNF15, RN01, RNF07).
--
-- Padrão: NEGAR TUDO. Só é permitido o que está escrito aqui.
-- São duas camadas:
--   1. GRANT/REVOKE: quais colunas cada papel do Postgres pode ler ou alterar.
--      anon = visitante sem login; authenticated = qualquer usuário logado.
--   2. Políticas RLS: quais LINHAS cada usuário enxerga ou altera, uma
--      política por operação (SELECT, INSERT, UPDATE, DELETE).
-- O papel 'admin' da loja é a coluna perfis.papel, conferida por eh_admin().
--
-- (select auth.uid()) entre parênteses faz o Postgres calcular o valor uma
-- vez por consulta, e não uma vez por linha (recomendação do Supabase).
-- =============================================================

alter table public.perfis         enable row level security;
alter table public.categorias     enable row level security;
alter table public.produtos       enable row level security;
alter table public.carrinho_itens enable row level security;
alter table public.pedidos        enable row level security;
alter table public.pedido_itens   enable row level security;
alter table public.avaliacoes     enable row level security;

-- -------------------------------------------------------------
-- 1. Privilégios
-- O Supabase dá todos os privilégios para anon e authenticated por padrão;
-- aqui tiramos tudo e devolvemos só o necessário.
-- -------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- perfis: o cliente NÃO pode mudar o próprio papel (escalada de privilégio)
-- nem a data do aceite. Virar admin só por SQL no painel do Supabase.
grant select on public.perfis to authenticated;
grant update (nome, telefone, cep, endereco, numero_complemento) on public.perfis to authenticated;

-- catálogo: leitura pública; escrita filtrada pelas políticas (só admin)
grant select on public.categorias, public.produtos to anon, authenticated;
grant insert (nome), update (nome), delete on public.categorias to authenticated;
grant insert (nome, descricao, preco, imagem_url, estoque, categoria_id, ativo) on public.produtos to authenticated;
grant update (nome, descricao, preco, imagem_url, estoque, categoria_id, ativo) on public.produtos to authenticated;
grant delete on public.produtos to authenticated;
-- nota_media e total_vendido só mudam pelas funções do banco

-- carrinho, pedidos e itens: o cliente só LÊ. Gravar, só pelas funções
-- (adicionar_ao_carrinho, finalizar_pedido...), então ninguém forja
-- reservado_ate, preco_unitario, valor_total ou status.
grant select on public.carrinho_itens, public.pedidos, public.pedido_itens to authenticated;
grant update (status) on public.pedidos to authenticated;   -- a política deixa só o admin

-- avaliações: leitura pública; produto, autor e data vêm do trigger
grant select on public.avaliacoes to anon, authenticated;
grant insert (pedido_item_id, nota, comentario) on public.avaliacoes to authenticated;
grant update (nota, comentario) on public.avaliacoes to authenticated;

-- -------------------------------------------------------------
-- Funções: só usuários logados chamam as funções de negócio.
-- liberar_reservas_vencidas e as funções de trigger não têm GRANT:
-- ninguém consegue chamá-las pela API.
-- -------------------------------------------------------------
grant execute on function
  public.eh_admin(),
  public.excluir_minha_conta(),
  public.adicionar_ao_carrinho(bigint, integer),
  public.alterar_quantidade_carrinho(bigint, integer),
  public.remover_do_carrinho(bigint),
  public.finalizar_pedido(text, text)
  to authenticated;

-- -------------------------------------------------------------
-- 2. Políticas RLS
-- -------------------------------------------------------------

-- perfis (RNF14): cada um vê e altera só o próprio; o admin vê todos
create policy "perfis: dono ou admin lê"
  on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select public.eh_admin()));

create policy "perfis: dono altera"
  on public.perfis for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- categorias (RNF15)
create policy "categorias: leitura pública"
  on public.categorias for select to anon, authenticated
  using (true);

create policy "categorias: admin cria"
  on public.categorias for insert to authenticated
  with check ((select public.eh_admin()));

create policy "categorias: admin altera"
  on public.categorias for update to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

create policy "categorias: admin exclui"
  on public.categorias for delete to authenticated
  using ((select public.eh_admin()));

-- produtos (RNF15). Produtos inativos continuam legíveis para que
-- "Meus pedidos" mostre o nome; a loja filtra por ativo = true.
create policy "produtos: leitura pública"
  on public.produtos for select to anon, authenticated
  using (true);

create policy "produtos: admin cria"
  on public.produtos for insert to authenticated
  with check ((select public.eh_admin()));

create policy "produtos: admin altera"
  on public.produtos for update to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

create policy "produtos: admin exclui"
  on public.produtos for delete to authenticated
  using ((select public.eh_admin()));

-- carrinho_itens (RNF14): cada cliente só vê o próprio carrinho.
-- Sem políticas de INSERT/UPDATE/DELETE: só as funções gravam.
create policy "carrinho: dono lê"
  on public.carrinho_itens for select to authenticated
  using (cliente_id = (select auth.uid()));

-- pedidos (RNF14): o cliente vê os seus; o admin vê todos e muda o status.
-- Sem política de INSERT: só finalizar_pedido cria pedidos.
create policy "pedidos: dono ou admin lê"
  on public.pedidos for select to authenticated
  using (cliente_id = (select auth.uid()) or (select public.eh_admin()));

create policy "pedidos: admin altera o status"
  on public.pedidos for update to authenticated
  using ((select public.eh_admin()))
  with check ((select public.eh_admin()));

create policy "pedido_itens: dono do pedido ou admin lê"
  on public.pedido_itens for select to authenticated
  using (
    exists (
      select 1 from public.pedidos p
       where p.id = pedido_itens.pedido_id
         and (p.cliente_id = (select auth.uid()) or (select public.eh_admin()))
    )
  );

-- avaliacoes
create policy "avaliacoes: leitura pública"
  on public.avaliacoes for select to anon, authenticated
  using (true);

-- RNF07: só avalia quem comprou, e só depois do pagamento
create policy "avaliacoes: cliente avalia o que comprou"
  on public.avaliacoes for insert to authenticated
  with check (
    cliente_id = (select auth.uid())
    and exists (
      select 1
        from public.pedido_itens i
        join public.pedidos p on p.id = i.pedido_id
       where i.id = avaliacoes.pedido_item_id
         and p.cliente_id = (select auth.uid())
         and p.status in ('PAGO', 'ENVIADO', 'ENTREGUE')
    )
  );

-- RN01: o autor edita até 7 dias depois de publicar; o admin edita sempre
create policy "avaliacoes: autor edita em 7 dias ou admin"
  on public.avaliacoes for update to authenticated
  using (
    (cliente_id = (select auth.uid()) and publicado_em > now() - interval '7 days')
    or (select public.eh_admin())
  )
  with check (
    (cliente_id = (select auth.uid()) and publicado_em > now() - interval '7 days')
    or (select public.eh_admin())
  );
