-- =============================================================
-- 02_perfis_e_admin.sql
-- Criação do perfil no cadastro (RF04, RE01), função eh_admin()
-- e exclusão da conta pelo próprio cliente (RF05, RE01).
--
-- Regras para as funções SECURITY DEFINER (rodam com permissão de dono):
--   - search_path = '' e nomes completos (public.tabela), para ninguém
--     "trocar" uma tabela por outra de mesmo nome em outro schema;
--   - conferem auth.uid() logo no início;
--   - validam todas as entradas;
--   - EXECUTE só para quem precisa (ver 06_rls.sql).
-- =============================================================

-- Diz se o usuário logado é administrador. Usada nas políticas RLS (RNF15).
-- É SECURITY DEFINER para ler perfis sem cair de novo nas políticas de perfis.
create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis where id = (select auth.uid()) and papel = 'admin'
  );
$$;

-- Cria o perfil quando alguém se cadastra no Supabase Auth.
-- O site envia nome e aceitou_termo em options.data do signUp.
-- O papel é sempre 'cliente': virar admin só por SQL no painel (escalada de privilégio).
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- RE01: o cadastro só é aceito com o aceite do termo de uso de dados
  if coalesce(new.raw_user_meta_data ->> 'aceitou_termo', 'false') <> 'true' then
    raise exception 'É preciso aceitar o termo de uso de dados para se cadastrar.';
  end if;

  insert into public.perfis (id, nome, termo_aceito_em)
  values (
    new.id,
    coalesce(nullif(left(trim(new.raw_user_meta_data ->> 'nome'), 100), ''), 'Cliente'),
    now()
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- RE01: o cliente apaga a conta e os dados pessoais.
-- Pedidos e avaliações continuam guardados, sem identificar o cliente.
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid := auth.uid();
begin
  if v_cliente is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;

  -- trava os produtos do carrinho (mesma ordem das outras funções)
  perform 1 from public.produtos
   where id in (select produto_id from public.carrinho_itens where cliente_id = v_cliente)
   order by id
     for update;

  -- RN02: o que ainda estava reservado no carrinho volta para o estoque
  update public.produtos p
     set estoque = p.estoque + c.quantidade
    from public.carrinho_itens c
   where c.cliente_id = v_cliente
     and c.produto_id = p.id
     and c.reservado_ate is not null;

  -- o endereço de entrega identifica o cliente, então também é apagado
  update public.pedidos
     set endereco_entrega = 'Removido a pedido do titular (LGPD)'
   where cliente_id = v_cliente;

  -- Apagar o usuário do Auth apaga em cascata o perfil e o carrinho.
  -- Pedidos e avaliações ficam com cliente_id nulo (on delete set null).
  delete from auth.users where id = v_cliente;
end;
$$;
