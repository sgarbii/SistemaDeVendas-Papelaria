// Validações dos formulários. A validação de verdade acontece no banco
// (CHECKs, RLS e funções); estas servem para avisar o usuário antes de enviar.

import { apenasDigitos } from './formatacao.js';

export const SENHA_MINIMA = 8; // RNF13

export function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email ?? '').trim());
}

export function validarSenha(senha) {
  return typeof senha === 'string' && senha.length >= SENHA_MINIMA;
}

export function validarNome(nome) {
  return String(nome ?? '').trim().length >= 2;
}

// RNF08: comentário obrigatório (só espaços não vale)
export function validarComentario(comentario) {
  return String(comentario ?? '').trim().length > 0;
}

export function validarNota(nota) {
  return Number.isInteger(nota) && nota >= 1 && nota <= 5;
}

export function validarCep(cep) {
  return apenasDigitos(cep).length === 8;
}

// Telefone é opcional; se vier, precisa ter DDD + número (10 ou 11 dígitos)
export function validarTelefone(telefone) {
  const digitos = apenasDigitos(telefone);
  return digitos.length === 0 || digitos.length === 10 || digitos.length === 11;
}

// Cenário 03, FE01: busca só com espaços é ignorada
export function termoDeBuscaValido(termo) {
  return String(termo ?? '').trim().length > 0;
}

// Formulário de produto do painel (RF07). Devolve { campo: mensagem } só com
// os campos inválidos; objeto vazio = tudo certo. O banco repete as regras (CHECKs).
export function validarProduto({ nome, preco, estoque, categoriaId }) {
  const erros = {};
  if (!String(nome ?? '').trim()) erros.nome = 'Informe o nome.';
  if (!(preco > 0)) erros.preco = 'O preço precisa ser maior que zero.';
  if (!Number.isInteger(estoque) || estoque < 0) erros.estoque = 'Informe um número inteiro, zero ou maior.';
  if (!categoriaId) erros.categoria = 'Escolha a categoria.';
  return erros;
}

// imagem_url só pode ser (a) uma foto WEBP do seed, que fica no próprio site,
// ou (b) um arquivo do bucket "produtos" do NOSSO projeto Supabase, com nome
// UUID. Qualquer outra coisa (outro site, "javascript:", SVG enviado) é recusada.
// O banco tem a mesma regra num CHECK (11_fotos_e_tempo_real.sql).
export function imagemPermitida(url, supabaseUrl) {
  const texto = String(url ?? '');
  if (/^\/img\/produtos\/[a-z0-9-]+\.webp$/.test(texto)) return true;

  const prefixo = `${supabaseUrl}/storage/v1/object/public/produtos/`;
  return supabaseUrl?.startsWith('https://') === true
    && texto.startsWith(prefixo)
    && /^[a-f0-9-]+\.(png|jpg|webp)$/.test(texto.slice(prefixo.length));
}

// Página para onde voltar depois do login (FA01 do cenário 01).
// Só aceita páginas do próprio site, para ninguém usar o link de login
// para mandar o usuário a um site falso.
export function destinoSeguro(destino) {
  const texto = String(destino ?? '');
  const valido = /^\/(admin\/)?[a-z-]+\.html(\?[\w=&%.+-]*)?$/i.test(texto);
  return valido ? texto : '/index.html';
}
