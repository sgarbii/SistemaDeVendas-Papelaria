// Catálogo: produtos, categorias e avaliações públicas (RF03, RF02).
// Leitura pública: funciona sem login (RU08).
import { supabase, executar } from './supabase.js';
import { SUPABASE_URL } from '../config.js';
import { prepararTermoBusca, escaparCuringasLike } from '../utils/formatacao.js';
import { imagemPermitida } from '../utils/validacao.js';
import { ordenarPorPopularidade } from '../utils/calculos.js';

const CAMPOS_PRODUTO =
  'id, nome, descricao, preco, imagem_url, estoque, nota_media, total_vendido, ativo, categoria_id, categorias(id, nome)';

// Cenário 03, passo 4: ordenados por popularidade e avaliação
function vitrine() {
  return supabase
    .from('produtos')
    .select(CAMPOS_PRODUTO)
    .eq('ativo', true)
    .order('total_vendido', { ascending: false })
    .order('nota_media', { ascending: false });
}

// Página inicial: mais populares e bem avaliados
export async function listarPopulares(limite = 12) {
  return executar(vitrine().limit(limite));
}

export async function listarPorCategoria(categoriaId) {
  return executar(vitrine().eq('categoria_id', categoriaId));
}

// RF03: a busca procura pelo nome e pela categoria.
// RNF10: tudo pelo query builder do supabase-js (nada de montar texto de
// consulta); o termo tem no máximo 100 caracteres e os curingas % e _ são
// escapados, para valerem como letras comuns.
export async function buscarProdutos(termo) {
  const texto = prepararTermoBusca(termo);
  if (!texto) return [];
  const padrao = `%${escaparCuringasLike(texto)}%`;

  // 1) produtos com o termo no nome
  const porNome = await executar(vitrine().ilike('nome', padrao));

  // 2) produtos das categorias cujo nome tem o termo
  const categorias = await executar(supabase.from('categorias').select('id').ilike('nome', padrao));
  const ids = categorias.map((c) => c.id);
  const porCategoria = ids.length > 0 ? await executar(vitrine().in('categoria_id', ids)) : [];

  // junta as duas listas sem repetir e mantém a ordem da vitrine
  const unicos = new Map([...porNome, ...porCategoria].map((p) => [p.id, p]));
  return ordenarPorPopularidade([...unicos.values()]);
}

export async function obterProduto(id) {
  return executar(
    supabase.from('produtos').select(CAMPOS_PRODUTO).eq('id', id).maybeSingle()
  );
}

export async function listarCategorias() {
  return executar(
    supabase.from('categorias').select('id, nome').order('nome')
  );
}

export async function obterCategoria(id) {
  return executar(
    supabase.from('categorias').select('id, nome').eq('id', id).maybeSingle()
  );
}

// Avaliações mostradas na página do produto (sem o nome do autor)
export async function listarAvaliacoes(produtoId) {
  return executar(
    supabase
      .from('avaliacoes')
      .select('id, nota, comentario, publicado_em')
      .eq('produto_id', produtoId)
      .order('publicado_em', { ascending: false })
  );
}

// Endereço da imagem: as do seed ficam no site; as do painel, no Storage
// do próprio projeto. Qualquer outro endereço vira a imagem padrão.
export function urlImagem(produto) {
  return imagemPermitida(produto?.imagem_url, SUPABASE_URL) ? produto.imagem_url : '/img/sem-imagem.svg';
}
