// Formatação de valores para mostrar na tela.
// Funções puras (sem rede e sem DOM), testadas no Vitest.

const formatadorPreco = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// 19.9 -> "R$ 19,90"
export function formatarPreco(valor) {
  return formatadorPreco.format(Number(valor) || 0);
}

export function apenasDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

// "37500000" -> "37500-000" (aceita o CEP já formatado ou incompleto)
export function formatarCep(cep) {
  const digitos = apenasDigitos(cep).slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

// "35999998888" -> "(35) 99999-8888"
export function formatarTelefone(telefone) {
  const d = apenasDigitos(telefone).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatarData(dataIso) {
  return new Date(dataIso).toLocaleDateString('pt-BR');
}

export function formatarDataHora(dataIso) {
  return new Date(dataIso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// 754000 ms -> "12:34" (tempo restante da reserva, RN02)
export function formatarTempo(milissegundos) {
  const totalSegundos = Math.max(0, Math.floor(milissegundos / 1000));
  const minutos = String(Math.floor(totalSegundos / 60)).padStart(2, '0');
  const segundos = String(totalSegundos % 60).padStart(2, '0');
  return `${minutos}:${segundos}`;
}

// Nota média com uma casa: 4.5 -> "4,5"
export function formatarNota(nota) {
  return Number(nota || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Busca (RNF10): tira espaços repetidos e limita a 100 caracteres
export const TAMANHO_MAXIMO_BUSCA = 100;
export function prepararTermoBusca(termo) {
  return String(termo ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TAMANHO_MAXIMO_BUSCA);
}

// No ilike, % e _ são curingas ("qualquer texto" e "qualquer letra").
// Com a barra antes, valem como letras comuns: "100%" procura "100%" mesmo.
export function escaparCuringasLike(texto) {
  return String(texto ?? '').replace(/[\\%_]/g, '\\$&');
}
