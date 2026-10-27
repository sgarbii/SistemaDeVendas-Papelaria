// Carrinho (RF01). Os itens ficam no banco (RNF03): nada se perde ao
// recarregar a página ou trocar de dispositivo.
// Adicionar, alterar e remover passam pelas funções do banco, que
// reservam e devolvem o estoque (RN02).
import { supabase, executar } from './supabase.js';
import { obterSessao } from './auth.js';
import { contarUnidades } from '../utils/calculos.js';

// Avisa o cabeçalho para atualizar o contador na hora (RNF04)
function avisarMudanca() {
  window.dispatchEvent(new CustomEvent('carrinho-mudou'));
}

export async function listarItens() {
  return executar(
    supabase
      .from('carrinho_itens')
      .select('id, produto_id, quantidade, reservado_ate, produtos(id, nome, preco, imagem_url, estoque, ativo)')
      .order('id')
  );
}

// Devolve quantas unidades foram de fato reservadas (FA02: pode ser menos)
export async function adicionarAoCarrinho(produtoId, quantidade) {
  const adicionada = await executar(
    supabase.rpc('adicionar_ao_carrinho', { p_produto_id: produtoId, p_quantidade: quantidade })
  );
  avisarMudanca();
  return adicionada;
}

// Devolve a nova quantidade (limitada ao estoque disponível)
export async function alterarQuantidade(produtoId, quantidade) {
  const nova = await executar(
    supabase.rpc('alterar_quantidade_carrinho', { p_produto_id: produtoId, p_quantidade: quantidade })
  );
  avisarMudanca();
  return nova;
}

export async function removerDoCarrinho(produtoId) {
  await executar(supabase.rpc('remover_do_carrinho', { p_produto_id: produtoId }));
  avisarMudanca();
}

// Total de unidades para o contador do cabeçalho
export async function contarItensDoCarrinho() {
  if (!(await obterSessao())) return 0;
  const itens = await executar(supabase.from('carrinho_itens').select('quantidade'));
  return contarUnidades(itens);
}

export { avisarMudanca };
