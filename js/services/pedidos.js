// Finalizar compra e "Meus pedidos" (RF06, RN04).
import { supabase, executar } from './supabase.js';
import { avisarMudanca } from './carrinho.js';

// Chama finalizar_pedido no banco. Resposta:
//   { ok: true, pedido_id }  ou  { ok: false, avisos: [{ produto, mensagem }] }  (RN04)
export async function finalizarPedido(endereco, formaPagamento) {
  const resultado = await executar(
    supabase.rpc('finalizar_pedido', { p_endereco: endereco, p_forma_pagamento: formaPagamento })
  );
  avisarMudanca();
  return resultado;
}

export async function listarMeusPedidos(clienteId) {
  return executar(
    supabase
      .from('pedidos')
      .select(`
        id, data, valor_total, endereco_entrega, forma_pagamento, status,
        pedido_itens (
          id, produto_id, quantidade, preco_unitario,
          produtos ( nome, imagem_url ),
          avaliacoes ( id, nota, comentario, publicado_em )
        )`)
      .eq('cliente_id', clienteId)
      .order('data', { ascending: false })
  );
}

// A avaliação de um item vem como objeto (relação 1 para 1) ou lista
export function avaliacaoDoItem(item) {
  const avaliacao = item.avaliacoes;
  return Array.isArray(avaliacao) ? avaliacao[0] ?? null : avaliacao ?? null;
}
