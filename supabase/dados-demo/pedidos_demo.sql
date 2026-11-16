-- =============================================================
-- pedidos_demo.sql  (OPCIONAL — não é uma migration)
-- Cria ~180 pedidos de demonstração espalhados pelos últimos 90 dias,
-- para o painel de vendas do administrador ter gráficos para mostrar
-- na apresentação. Rode no SQL Editor do Supabase depois da 11.
--
-- Os pedidos ficam sem cliente (cliente_id = null), do mesmo jeito que
-- ficam os pedidos de quem excluiu a conta (RE01). Por isso não aparecem
-- em "Meus pedidos" de ninguém e não permitem avaliações.
-- O estoque e o total_vendido dos produtos NÃO são alterados.
--
-- Para apagar só estes pedidos depois:
--   delete from public.pedidos where endereco_entrega like '[demo]%';
-- =============================================================

do $$
declare
  v_pedido   bigint;
  v_data     timestamptz;
  v_total    numeric(10, 2);
  v_status   public.status_pedido;
  v_dia      integer;
  v_sorteio  double precision;
  v_produto  record;
begin
  for i in 1..180 loop
    -- mais pedidos nos dias recentes (o painel mostra crescimento)
    v_dia := floor(power(random(), 1.6) * 90)::integer;
    v_data := date_trunc('day', now()) - make_interval(days => v_dia)
              + make_interval(hours => 8 + floor(random() * 14)::integer, mins => floor(random() * 60)::integer);
    if v_data > now() then
      v_data := now() - interval '5 minutes';
    end if;

    -- pedidos antigos já foram entregues; os recentes ainda estão no caminho
    v_sorteio := random();
    v_status := case
      when v_sorteio < 0.06 then 'CANCELADO'
      when v_dia > 10 then 'ENTREGUE'
      when v_dia > 3 then (case when v_sorteio < 0.5 then 'ENVIADO' else 'ENTREGUE' end)::public.status_pedido
      when v_sorteio < 0.15 then 'AGUARDANDO_PAGAMENTO'
      else (case when v_sorteio < 0.6 then 'PAGO' else 'ENVIADO' end)::public.status_pedido
    end;

    insert into public.pedidos (cliente_id, data, valor_total, endereco_entrega, forma_pagamento, status)
    values (null, v_data, 0, '[demo] Rua Exemplo, 100 - Centro, Itajubá - MG',
            (array['PIX', 'CARTAO', 'BOLETO'])[1 + floor(random() * 3)::integer], v_status)
    returning id into v_pedido;

    v_total := 0;
    -- de 1 a 4 produtos diferentes por pedido; os mais populares saem mais
    for v_produto in
      select id, preco
        from public.produtos
       where ativo
       order by random() * (1 + total_vendido / 100.0) desc
       limit 1 + floor(random() * 4)::integer
    loop
      insert into public.pedido_itens (pedido_id, produto_id, quantidade, preco_unitario)
      values (v_pedido, v_produto.id, 1 + floor(power(random(), 3) * 4)::integer, v_produto.preco)
      returning v_total + quantidade * preco_unitario into v_total;
    end loop;

    update public.pedidos set valor_total = v_total where id = v_pedido;
  end loop;
end $$;
