// Avaliações (RF02, RN01, RNF06, RNF07).
// Quem pode avaliar e editar é decidido pelas políticas RLS do banco.
import { supabase, executar, ErroDoSistema } from './supabase.js';

// Só as colunas que o banco libera para leitura (12_colunas_das_avaliacoes.sql):
// pedir todas com select() daria erro de permissão por causa do cliente_id.
const CAMPOS_AVALIACAO = 'id, nota, comentario, publicado_em';

// Avaliacao.publicar(): produto, autor e data são preenchidos pelo banco
export async function publicarAvaliacao(pedidoItemId, nota, comentario) {
  try {
    return await executar(
      supabase
        .from('avaliacoes')
        .insert({ pedido_item_id: pedidoItemId, nota, comentario: comentario.trim() })
        .select(CAMPOS_AVALIACAO)
        .single()
    );
  } catch (erro) {
    // RNF06 / FE01: o UNIQUE de pedido_item_id recusa a segunda avaliação
    if (erro.codigo === '23505') {
      throw new ErroDoSistema('Você já avaliou este produto.', { codigo: '23505' });
    }
    throw erro;
  }
}

// Avaliacao.editar(): se a política RLS recusar (passou de 7 dias, RN01),
// o banco não dá erro, apenas não altera nenhuma linha. Por isso conferimos.
export async function editarAvaliacao(id, nota, comentario) {
  const linhas = await executar(
    supabase
      .from('avaliacoes')
      .update({ nota, comentario: comentario.trim() })
      .eq('id', id)
      .select(CAMPOS_AVALIACAO)
  );
  if (linhas.length === 0) {
    throw new ErroDoSistema('O prazo de 7 dias para editar esta avaliação terminou.');
  }
  return linhas[0];
}
