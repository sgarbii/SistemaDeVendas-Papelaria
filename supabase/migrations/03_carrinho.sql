-- =============================================================
-- 03_carrinho.sql
-- Carrinho com reserva de estoque (RF01, RN02, Cenário 01).
-- O cliente não grava direto em carrinho_itens: tudo passa por estas
-- funções, para que nenhum item entre no carrinho sem reservar estoque
-- e ninguém consiga forjar a quantidade ou o reservado_ate.
-- As funções recebem só ids e quantidades; o resto vem do banco.
--
-- Convenção: produtos.estoque é o disponível. Reservar = tirar do estoque;
-- devolver = somar de volta. Um item com reservado_ate preenchido está
-- segurando estoque; com reservado_ate nulo, não está.
--
-- Concorrência: todas as funções travam primeiro a linha do produto
-- (select ... for update) e só depois mexem no carrinho. Assim dois
-- clientes não reservam a última unidade ao mesmo tempo.
-- =============================================================

-- Adiciona p_quantidade de um produto ao carrinho e devolve quantas
-- unidades foram de fato adicionadas (pode ser menos que o pedido: FA02).
create or replace function public.adicionar_ao_carrinho(p_produto_id bigint, p_quantidade integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente    uuid := auth.uid();
  v_estoque    integer;
  v_ativo      boolean;
  v_item       public.carrinho_itens%rowtype;
  v_qtd_antiga integer := 0;
  v_adicionada integer;
begin
  -- verificarLogin() do diagrama de sequência
  if v_cliente is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  if p_produto_id is null or p_quantidade is null or p_quantidade not between 1 and 99 then
    raise exception 'Quantidade inválida: escolha de 1 a 99 unidades.';
  end if;

  -- trava o produto: dois clientes não reservam a última unidade ao mesmo tempo
  select estoque, ativo into v_estoque, v_ativo
    from public.produtos where id = p_produto_id
     for update;
  if not found or not v_ativo then
    raise exception 'Produto não encontrado.';
  end if;

  select * into v_item
    from public.carrinho_itens
   where cliente_id = v_cliente and produto_id = p_produto_id;

  if found then
    if v_item.reservado_ate is not null then
      v_qtd_antiga := v_item.quantidade;          -- já está reservado
    else
      -- a reserva tinha vencido: reserva de novo a quantidade antiga, se der
      v_qtd_antiga := least(v_item.quantidade, v_estoque);
      v_estoque := v_estoque - v_qtd_antiga;
    end if;
  end if;

  -- FE01: produto esgotado
  if v_estoque = 0 then
    raise exception 'Produto indisponível.';
  end if;
  if v_qtd_antiga >= 99 then
    raise exception 'Limite de 99 unidades por produto no carrinho.';
  end if;

  -- FA02: limita ao disponível (e ao máximo de 99 por item)
  v_adicionada := least(p_quantidade, v_estoque, 99 - v_qtd_antiga);

  -- reservarEstoque(qtd)
  update public.produtos set estoque = v_estoque - v_adicionada where id = p_produto_id;

  -- RN02: reserva de 15 min (adicionar renova o prazo do item inteiro)
  insert into public.carrinho_itens (cliente_id, produto_id, quantidade, reservado_ate)
  values (v_cliente, p_produto_id, v_qtd_antiga + v_adicionada, now() + interval '15 minutes')
  on conflict (cliente_id, produto_id) do update
     set quantidade    = excluded.quantidade,
         reservado_ate = excluded.reservado_ate;

  return v_adicionada;
end;
$$;

-- Troca a quantidade de um item e devolve a nova quantidade
-- (limitada ao disponível, como no FA02). Também renova o prazo de 15 min,
-- como a auto-transição "alterar quantidade" do diagrama de estados.
create or replace function public.alterar_quantidade_carrinho(p_produto_id bigint, p_quantidade integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente    uuid := auth.uid();
  v_estoque    integer;
  v_ativo      boolean;
  v_item       public.carrinho_itens%rowtype;
  v_disponivel integer;
  v_nova       integer;
begin
  if v_cliente is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  if p_produto_id is null or p_quantidade is null or p_quantidade not between 1 and 99 then
    raise exception 'Quantidade inválida: escolha de 1 a 99 unidades.';
  end if;

  select estoque, ativo into v_estoque, v_ativo
    from public.produtos where id = p_produto_id
     for update;

  select * into v_item
    from public.carrinho_itens
   where cliente_id = v_cliente and produto_id = p_produto_id;
  if not found then
    raise exception 'Este item não está no seu carrinho.';
  end if;
  if not v_ativo then
    raise exception 'Este produto não está mais à venda. Remova-o do carrinho.';
  end if;

  -- o que o cliente já reservou conta como disponível para ele mesmo
  v_disponivel := v_estoque;
  if v_item.reservado_ate is not null then
    v_disponivel := v_disponivel + v_item.quantidade;
  end if;

  if v_disponivel = 0 then
    raise exception 'Produto indisponível.';
  end if;

  v_nova := least(p_quantidade, v_disponivel);

  update public.produtos set estoque = v_disponivel - v_nova where id = p_produto_id;

  update public.carrinho_itens
     set quantidade = v_nova,
         reservado_ate = now() + interval '15 minutes'   -- RN02
   where id = v_item.id;

  return v_nova;
end;
$$;

-- Remove um item do carrinho e devolve a reserva ao estoque.
create or replace function public.remover_do_carrinho(p_produto_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid := auth.uid();
  v_item    public.carrinho_itens%rowtype;
begin
  if v_cliente is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  if p_produto_id is null then
    raise exception 'Produto inválido.';
  end if;

  perform 1 from public.produtos where id = p_produto_id for update;

  delete from public.carrinho_itens
   where cliente_id = v_cliente and produto_id = p_produto_id
  returning * into v_item;

  -- devolverEstoque(qtd), só se o item ainda segurava estoque
  if found and v_item.reservado_ate is not null then
    update public.produtos set estoque = estoque + v_item.quantidade where id = p_produto_id;
  end if;
end;
$$;

-- RN02: devolve ao estoque as reservas vencidas. Executada a cada minuto
-- pelo pg_cron (08_pg_cron.sql). Função interna: ninguém pode chamar pela API.
-- O item continua no carrinho, sem reserva, e é conferido de novo em
-- finalizar_pedido (RN04).
create or replace function public.liberar_reservas_vencidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_liberados integer;
begin
  -- trava primeiro os produtos envolvidos (mesma ordem das outras funções)
  perform 1 from public.produtos
   where id in (select produto_id from public.carrinho_itens where reservado_ate < now())
   order by id
     for update;

  with vencidos as (
    update public.carrinho_itens
       set reservado_ate = null
     where reservado_ate < now()
    returning produto_id, quantidade
  ), por_produto as (
    select produto_id, sum(quantidade) as total
      from vencidos
     group by produto_id
  )
  update public.produtos p
     set estoque = p.estoque + pp.total
    from por_produto pp
   where p.id = pp.produto_id;

  get diagnostics v_liberados = row_count;
  return v_liberados;   -- quantos produtos tiveram estoque devolvido
end;
$$;
