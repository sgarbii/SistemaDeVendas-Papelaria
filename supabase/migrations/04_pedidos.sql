-- =============================================================
-- 04_pedidos.sql
-- Finalizar compra (RF06) com conferência de estoque (RN04).
-- =============================================================

-- Tudo roda numa única transação, com as linhas dos produtos travadas.
-- O navegador manda só o endereço e a forma de pagamento: preço, total
-- e status são sempre calculados aqui (ninguém consegue forjar o valor).
--
-- Devolve um JSON:
--   { "ok": true,  "pedido_id": 12 }                       pedido criado e pago
--   { "ok": false, "avisos": [ {produto, mensagem}, ... ] } carrinho ajustado (RN04)
--
-- No segundo caso o pedido NÃO é criado: os ajustes do carrinho ficam
-- gravados e o cliente confirma de novo. Por isso a função devolve os
-- avisos em vez de lançar uma exceção (a exceção desfaria os ajustes).
create or replace function public.finalizar_pedido(p_endereco text, p_forma_pagamento text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente   uuid := auth.uid();
  v_item      record;
  v_reservar  integer;
  v_avisos    jsonb := '[]'::jsonb;
  v_total     numeric(10, 2);
  v_pedido_id bigint;
begin
  if v_cliente is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  if trim(coalesce(p_endereco, '')) = '' or char_length(p_endereco) > 400 then
    raise exception 'Informe o endereço de entrega (até 400 caracteres).';
  end if;
  if p_forma_pagamento is null or p_forma_pagamento not in ('PIX', 'CARTAO', 'BOLETO') then
    raise exception 'Escolha a forma de pagamento.';
  end if;
  if not exists (select 1 from public.carrinho_itens where cliente_id = v_cliente) then
    raise exception 'Seu carrinho está vazio.';
  end if;

  -- trava os produtos do carrinho (em ordem de id, para não haver travamento)
  perform 1 from public.produtos
   where id in (select produto_id from public.carrinho_itens where cliente_id = v_cliente)
   order by id
     for update;

  -- RN04: confere de novo cada item
  for v_item in
    select c.id, c.produto_id, c.quantidade, c.reservado_ate,
           p.nome, p.estoque, p.ativo
      from public.carrinho_itens c
      join public.produtos p on p.id = c.produto_id
     where c.cliente_id = v_cliente
     order by p.id
  loop
    if not v_item.ativo then
      -- produto saiu de venda: retira do carrinho e devolve a reserva, se houver
      if v_item.reservado_ate is not null then
        update public.produtos set estoque = estoque + v_item.quantidade where id = v_item.produto_id;
      end if;
      delete from public.carrinho_itens where id = v_item.id;
      v_avisos := v_avisos || jsonb_build_object(
        'produto', v_item.nome,
        'mensagem', 'não está mais à venda e foi retirado do carrinho');

    elsif v_item.reservado_ate is null then
      -- a reserva venceu (RN02): tenta reservar de novo
      v_reservar := least(v_item.quantidade, v_item.estoque);

      if v_reservar = 0 then
        delete from public.carrinho_itens where id = v_item.id;
        v_avisos := v_avisos || jsonb_build_object(
          'produto', v_item.nome,
          'mensagem', 'esgotou e foi retirado do carrinho');
      else
        update public.produtos set estoque = estoque - v_reservar where id = v_item.produto_id;
        update public.carrinho_itens
           set quantidade = v_reservar,
               reservado_ate = now() + interval '15 minutes'
         where id = v_item.id;

        if v_reservar < v_item.quantidade then
          v_avisos := v_avisos || jsonb_build_object(
            'produto', v_item.nome,
            'mensagem', format('só havia %s unidade(s); a quantidade foi ajustada', v_reservar));
        end if;
      end if;
    end if;
  end loop;

  -- RN04: se algo mudou, o cliente é avisado antes de confirmar
  if jsonb_array_length(v_avisos) > 0 then
    return jsonb_build_object('ok', false, 'avisos', v_avisos);
  end if;

  -- tudo certo: cria o pedido com o preço atual de cada produto
  select sum(c.quantidade * p.preco) into v_total
    from public.carrinho_itens c
    join public.produtos p on p.id = c.produto_id
   where c.cliente_id = v_cliente;

  insert into public.pedidos (cliente_id, valor_total, endereco_entrega, forma_pagamento, status)
  values (v_cliente, v_total, trim(p_endereco), p_forma_pagamento, 'AGUARDANDO_PAGAMENTO')
  returning id into v_pedido_id;

  insert into public.pedido_itens (pedido_id, produto_id, quantidade, preco_unitario)
  select v_pedido_id, c.produto_id, c.quantidade, p.preco
    from public.carrinho_itens c
    join public.produtos p on p.id = c.produto_id
   where c.cliente_id = v_cliente;

  -- confirmarPagamento(): no MVP o pagamento é simulado e aprovado na hora (9.4)
  update public.pedidos set status = 'PAGO' where id = v_pedido_id;

  -- usado para mostrar os "mais populares" na página inicial (RF03)
  update public.produtos p
     set total_vendido = p.total_vendido + c.quantidade
    from public.carrinho_itens c
   where c.cliente_id = v_cliente and c.produto_id = p.id;

  -- O estoque já foi descontado na reserva; os itens vendidos saem do carrinho.
  delete from public.carrinho_itens where cliente_id = v_cliente;

  return jsonb_build_object('ok', true, 'pedido_id', v_pedido_id);
end;
$$;
