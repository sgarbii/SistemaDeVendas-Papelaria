// Painel do administrador (RF07, RN01 e dashboard de vendas).
// Estas chamadas só funcionam para quem tem papel = 'admin':
// o banco recusa as escritas de qualquer outro usuário (RNF15).
import { supabase, executar, ErroDoSistema } from './supabase.js';

const BUCKET_IMAGENS = 'produtos';

// ---------- produtos ----------
export async function listarTodosProdutos() {
  return executar(
    supabase
      .from('produtos')
      .select('id, nome, descricao, preco, imagem_url, estoque, ativo, categoria_id, categorias(nome)')
      .order('nome')
  );
}

// Administrador.cadastrarProduto() / editarProduto()
export async function salvarProduto(produto) {
  const dados = {
    nome: produto.nome,
    descricao: produto.descricao,
    preco: produto.preco,
    estoque: produto.estoque,
    categoria_id: produto.categoria_id,
    imagem_url: produto.imagem_url,
    ativo: produto.ativo,
  };
  const consulta = produto.id
    ? supabase.from('produtos').update(dados).eq('id', produto.id)
    : supabase.from('produtos').insert(dados);
  return executar(consulta.select().single());
}

// Administrador.removerProduto(): só desativa, para não apagar o histórico de pedidos
export async function definirProdutoAtivo(id, ativo) {
  return executar(supabase.from('produtos').update({ ativo }).eq('id', id).select().single());
}

// Tipos aceitos (SVG e HTML ficam de fora: podem carregar script).
// O bucket e as políticas do Storage repetem esta regra (07_storage.sql).
export const TIPOS_IMAGEM = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const TAMANHO_MAXIMO_IMAGEM = 2 * 1024 * 1024; // 2 MB

// Envia a imagem para o Storage e devolve o endereço público dela.
// O nome do arquivo é um UUID novo: o nome original enviado é ignorado.
export async function enviarImagem(arquivo) {
  const extensao = TIPOS_IMAGEM[arquivo.type];
  if (!extensao) throw new ErroDoSistema('Envie uma imagem PNG, JPG ou WEBP.');
  if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) throw new ErroDoSistema('A imagem pode ter no máximo 2 MB.');

  const caminho = `${crypto.randomUUID()}.${extensao}`;
  await executar(
    supabase.storage.from(BUCKET_IMAGENS).upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
  );
  const { data } = supabase.storage.from(BUCKET_IMAGENS).getPublicUrl(caminho);
  return data.publicUrl;
}

// ---------- categorias ----------
export async function listarCategoriasComTotal() {
  return executar(
    supabase.from('categorias').select('id, nome, produtos(count)').order('nome')
  );
}

export async function salvarCategoria(id, nome) {
  const consulta = id
    ? supabase.from('categorias').update({ nome }).eq('id', id)
    : supabase.from('categorias').insert({ nome });
  return executar(consulta.select().single());
}

export async function excluirCategoria(id) {
  return executar(supabase.from('categorias').delete().eq('id', id));
}

// ---------- pedidos ----------
export async function listarTodosPedidos() {
  return executar(
    supabase
      .from('pedidos')
      .select(`
        id, data, valor_total, endereco_entrega, forma_pagamento, status,
        perfis ( nome ),
        pedido_itens ( id, quantidade, preco_unitario, produtos ( nome ) )`)
      .order('data', { ascending: false })
  );
}

export async function mudarStatusPedido(id, status) {
  return executar(supabase.from('pedidos').update({ status }).eq('id', id).select().single());
}

// ---------- avaliações ----------
export async function listarTodasAvaliacoes() {
  return executar(
    supabase
      .from('avaliacoes')
      .select('id, nota, comentario, publicado_em, produtos ( id, nome )')
      .order('publicado_em', { ascending: false })
  );
}

// ---------- dashboard de vendas ----------
export const LIMITE_ESTOQUE_BAIXO = 5;

// Pedidos a partir de uma data, com os itens, os produtos e as categorias.
// As contas (faturamento, gráficos) ficam em utils/painel.js.
export async function listarPedidosDesde(inicio) {
  return executar(
    supabase
      .from('pedidos')
      .select(`
        id, data, valor_total, status, forma_pagamento,
        pedido_itens ( quantidade, preco_unitario, produto_id,
                       produtos ( nome, imagem_url, categorias ( nome ) ) )`)
      .gte('data', inicio.toISOString())
      .order('data', { ascending: false })
  );
}

// Estoque mostrado é o disponível, já sem o que está reservado em carrinhos
export async function listarEstoqueBaixo() {
  return executar(
    supabase
      .from('produtos')
      .select('id, nome, estoque, imagem_url')
      .eq('ativo', true)
      .lte('estoque', LIMITE_ESTOQUE_BAIXO)
      .order('estoque')
  );
}

// Supabase Realtime: avisa quando um pedido é criado ou muda de situação.
// O Realtime respeita o RLS, então só o admin recebe os pedidos de todos
// (11_fotos_e_tempo_real.sql). Devolve a função que encerra a escuta.
export function acompanharPedidos({ aoMudar, aoMudarConexao }) {
  const canal = supabase
    .channel('painel-pedidos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, aoMudar)
    .subscribe((estado) => aoMudarConexao(estado === 'SUBSCRIBED'));
  return () => supabase.removeChannel(canal);
}
