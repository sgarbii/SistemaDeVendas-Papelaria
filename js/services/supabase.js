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
  // FE02: falha de conexão
  if (/failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(mensagem)) {
    return new ErroDoSistema('Não foi possível conectar. Verifique sua internet e tente de novo.', { codigo: 'rede' });
  }
  // sessão ausente ou vencida (RNF02, RNF13)
  if (codigo === '28000' || codigo === 'PGRST301' || codigo === 'PGRST303' || /jwt expired|invalid jwt/i.test(mensagem)) {
    return new ErroDoSistema('Sua sessão expirou. Faça login para continuar.', { codigo, semSessao: true });
  }
  switch (codigo) {
    case 'P0001': // mensagens das nossas funções (ex.: "Produto indisponível.")
      return new ErroDoSistema(mensagem || MENSAGEM_GENERICA, { codigo });
    case '42501': // RLS ou GRANT recusou
      // a única mensagem 42501 escrita por nós é a do trigger de avaliações
      return new ErroDoSistema(
        mensagem.startsWith('Só é possível avaliar') ? mensagem : 'Você não tem permissão para fazer isso.',
        { codigo });
    case '23505':
      return new ErroDoSistema('Este registro já existe.', { codigo });
    case '23503':
      return new ErroDoSistema('Não é possível excluir: existem outros registros ligados a este.', { codigo });
    case '23514':
    case '22001':
    case '22P02':
      return new ErroDoSistema('Algum valor informado não é válido. Confira os campos.', { codigo });
    default:
      return new ErroDoSistema(MENSAGEM_GENERICA, { codigo });
  }
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
