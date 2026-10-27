// Cadastro, login e perfil (RF04, RF05, RE01).
import { supabase, executar, ErroDoSistema, traduzirErro } from './supabase.js';

// Mensagens do Supabase Auth em português
function erroDeLogin(erro) {
  switch (erro?.code) {
    case 'invalid_credentials':
      return new ErroDoSistema('E-mail ou senha incorretos.');
    case 'user_already_exists':
    case 'email_exists':
      return new ErroDoSistema('Já existe uma conta com este e-mail. Tente entrar.');
    case 'weak_password':
      return new ErroDoSistema('Senha fraca: use pelo menos 8 caracteres.');
    case 'email_not_confirmed':
      return new ErroDoSistema('Confirme seu e-mail pelo link que enviamos antes de entrar.');
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new ErroDoSistema('Muitas tentativas seguidas. Aguarde um pouco e tente de novo.');
    case 'unexpected_failure':
      // o trigger do banco recusou o cadastro (ex.: termo não aceito, RE01)
      return new ErroDoSistema('Não foi possível criar a conta. Confira se aceitou o termo de uso de dados.');
    default:
      return traduzirErro(erro);
  }
}

export async function obterSessao() {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}

// RF04: cadastro com nome, e-mail, senha e aceite do termo.
// O nome e o aceite vão nos metadados; o trigger do banco cria o perfil
// (sempre com papel 'cliente'). Com a confirmação de e-mail ligada, o link
// do e-mail traz o cliente de volta para a tela de login deste site.
export async function cadastrar({ nome, email, senha, aceitouTermo }) {
  let resposta;
  try {
    resposta = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome, aceitou_termo: aceitouTermo === true },
        emailRedirectTo: `${location.origin}/login.html`,
      },
    });
  } catch (erro) {
    throw traduzirErro(erro);
  }
  if (resposta.error) throw erroDeLogin(resposta.error);
  return resposta.data; // data.session vem nula se a confirmação de e-mail estiver ligada
}

export async function entrar(email, senha) {
  let resposta;
  try {
    resposta = await supabase.auth.signInWithPassword({ email, password: senha });
  } catch (erro) {
    throw traduzirErro(erro);
  }
  if (resposta.error) throw erroDeLogin(resposta.error);
  return resposta.data.session;
}

// Logout: encerra a sessão no Supabase e apaga o token guardado no navegador.
// Quem chama recarrega a página (location.href), o que limpa o estado da tela.
export async function sair() {
  try {
    await supabase.auth.signOut();
  } catch {
    // sem internet o token local é apagado do mesmo jeito
    await supabase.auth.signOut({ scope: 'local' });
  }
}

// Leva para a tela de login e, depois, de volta para a página atual (FA01)
export function irParaLogin(voltarPara = location.pathname + location.search) {
  location.href = '/login.html?voltar=' + encodeURIComponent(voltarPara);
}

// Páginas que só funcionam com login (carrinho, pedidos, perfil): RNF02
export async function exigirLogin() {
  const sessao = await obterSessao();
  if (!sessao) {
    irParaLogin();
    return null;
  }
  return sessao;
}

export async function obterPerfil() {
  const sessao = await obterSessao();
  if (!sessao) return null;
  return executar(
    supabase.from('perfis').select('*').eq('id', sessao.user.id).single()
  );
}

// RF05: o cliente altera só nome, telefone e endereço (GRANT por coluna no banco)
export async function atualizarPerfil(id, { nome, telefone, cep, endereco, numero_complemento }) {
  return executar(
    supabase.from('perfis')
      .update({ nome, telefone, cep, endereco, numero_complemento })
      .eq('id', id)
      .select()
      .single()
  );
}

// RE01: apaga a conta e os dados pessoais (função excluir_minha_conta no banco)
export async function excluirConta() {
  await executar(supabase.rpc('excluir_minha_conta'));
  // o usuário já não existe no Auth; limpa a sessão guardada no navegador
  await supabase.auth.signOut({ scope: 'local' });
}

export function aoMudarSessao(callback) {
  supabase.auth.onAuthStateChange((_evento, sessao) => callback(sessao));
}
