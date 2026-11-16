// Cliente do Supabase usado por todos os outros services.
// supabase-js v2 (versão fixa 2.112.4) copiado para js/vendor/ por
// scripts/gerar-vendor.mjs: o site não carrega script de CDN.
import { createClient } from '../vendor/supabase-js.js';
import { SUPABASE_URL, SUPABASE_CHAVE_PUBLICA } from '../config.js';

export const configurado = !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_CHAVE_PUBLICA.startsWith('COLE-AQUI');

// RNF13: a sessão (token JWT de 1 h) fica salva no navegador e o
// supabase-js a renova sozinho antes de vencer.
export const supabase = createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Erro com mensagem amigável, que as telas mostram direto para o usuário
export class ErroDoSistema extends Error {
  constructor(mensagem, { codigo = null, semSessao = false } = {}) {
    super(mensagem);
    this.codigo = codigo;
    this.semSessao = semSessao; // true = mandar para a tela de login (RNF02)
  }
}

const MENSAGEM_GENERICA = 'Algo deu errado. Tente de novo em instantes.';
const MENSAGEM_VALOR_INVALIDO = 'Algum valor informado não é válido. Confira os campos.';

const ERRO_DE_REDE = /failed to fetch|networkerror|load failed|fetch failed|network request failed/i;
const CODIGOS_SEM_SESSAO = ['28000', 'PGRST301', 'PGRST303'];
const ERRO_DE_TOKEN = /jwt expired|invalid jwt/i;

// Mensagem para cada código do Postgres. Recebe o texto original do banco
// para os casos em que ele foi escrito por nós (raise exception).
const MENSAGENS_POR_CODIGO = {
  P0001: (mensagem) => mensagem || MENSAGEM_GENERICA, // ex.: "Produto indisponível."
  // RLS ou GRANT recusou: a única mensagem 42501 nossa é a do trigger de avaliações
  42501: (mensagem) => (mensagem.startsWith('Só é possível avaliar') ? mensagem : 'Você não tem permissão para fazer isso.'),
  23505: () => 'Este registro já existe.',
  23503: () => 'Não é possível excluir: existem outros registros ligados a este.',
  23514: () => MENSAGEM_VALOR_INVALIDO,
  22001: () => MENSAGEM_VALOR_INVALIDO,
  '22P02': () => MENSAGEM_VALOR_INVALIDO,
};

// Traduz os erros do Supabase/Postgres para mensagens em português.
// Regra: o texto bruto do banco NUNCA aparece para o usuário (pode revelar
// nomes de tabelas e colunas). Só passam as mensagens escritas por nós
// nas funções do banco (raise exception, código P0001).
export function traduzirErro(erro) {
  const mensagem = String(erro?.message ?? '');
  const codigo = erro?.code ?? null;

  if (!configurado) {
    return new ErroDoSistema('O site ainda não foi configurado: preencha js/config.js com os dados do Supabase.');
  }
  if (ERRO_DE_REDE.test(mensagem)) { // FE02
    return new ErroDoSistema('Não foi possível conectar. Verifique sua internet e tente de novo.', { codigo: 'rede' });
  }
  if (CODIGOS_SEM_SESSAO.includes(codigo) || ERRO_DE_TOKEN.test(mensagem)) { // RNF02, RNF13
    return new ErroDoSistema('Sua sessão expirou. Faça login para continuar.', { codigo, semSessao: true });
  }
  const traduzir = MENSAGENS_POR_CODIGO[codigo] ?? (() => MENSAGEM_GENERICA);
  return new ErroDoSistema(traduzir(mensagem), { codigo });
}

// Texto que as telas mostram para qualquer erro: só as nossas mensagens
// amigáveis (ErroDoSistema) passam; erros inesperados viram a mensagem genérica.
export function mensagemDeErro(erro) {
  return erro instanceof ErroDoSistema ? erro.message : MENSAGEM_GENERICA;
}

// Confere a resposta do Supabase: devolve os dados ou lança ErroDoSistema
export function conferir({ data, error }) {
  if (error) throw traduzirErro(error);
  return data;
}

// Para chamadas que podem lançar exceção de rede (fetch rejeitado)
export async function executar(promessa) {
  try {
    return conferir(await promessa);
  } catch (erro) {
    throw erro instanceof ErroDoSistema ? erro : traduzirErro(erro);
  }
}
