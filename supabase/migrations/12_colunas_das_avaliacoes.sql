-- =============================================================
-- 12_colunas_das_avaliacoes.sql
-- Correção da auditoria de segurança: a leitura pública de "avaliacoes"
-- liberava TODAS as colunas, inclusive cliente_id. Com a chave pública,
-- qualquer visitante conseguia pedir select=cliente_id e ligar todas as
-- avaliações de uma mesma pessoa (identificador pessoal, LGPD).
--
-- Agora a permissão é por coluna:
--   - visitantes e clientes leem só o que a página do produto mostra;
--   - clientes logados leem também pedido_item_id, usado para ligar a
--     avaliação ao item em "Meus pedidos" (a RLS continua valendo);
--   - cliente_id não é lido pela API por ninguém. As políticas RLS e o
--     trigger continuam usando a coluna normalmente.
-- Pode rodar de novo sem erro.
-- =============================================================

revoke select on public.avaliacoes from anon, authenticated;

grant select (id, produto_id, nota, comentario, publicado_em) on public.avaliacoes to anon;
grant select (id, produto_id, pedido_item_id, nota, comentario, publicado_em) on public.avaliacoes to authenticated;

-- Para conferir (deve dar "permission denied for table avaliacoes"):
--   set role anon;
--   select cliente_id from public.avaliacoes limit 1;
--   reset role;
