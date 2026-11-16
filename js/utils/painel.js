// Contas do dashboard de vendas do administrador.
// Funções puras (sem rede e sem DOM), testadas no Vitest: recebem a lista
// de pedidos que o banco devolveu e montam os números e as séries dos gráficos.
//
// Formato esperado de cada pedido (consulta de listarPedidosDesde):
//   { id, data, valor_total, status, forma_pagamento,
//     pedido_itens: [{ quantidade, preco_unitario, produto_id,
//                      produtos: { nome, imagem_url, categorias: { nome } } }] }
import { emCentavos, contarUnidades } from './calculos.js';
import { NOMES_STATUS, FORMAS_PAGAMENTO, pedidoPago } from './constantes.js';
import { formatarDataHora } from './formatacao.js';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export function inicioDoDia(data) {
  const dia = new Date(data);
  dia.setHours(0, 0, 0, 0);
  return dia;
}

function somarDias(data, dias) {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

// Período de N dias terminando hoje, e o período anterior de mesmo tamanho
// (usado para comparar: "+12% em relação aos 30 dias anteriores").
export function intervaloDoPeriodo(dias, agora = new Date()) {
  const inicio = somarDias(inicioDoDia(agora), -(dias - 1));
  return { inicio, inicioAnterior: somarDias(inicio, -dias) };
}

export function separarPorPeriodo(pedidos, inicio) {
  const limite = inicio.getTime();
  return {
    atuais: pedidos.filter((p) => new Date(p.data).getTime() >= limite),
    anteriores: pedidos.filter((p) => new Date(p.data).getTime() < limite),
  };
}

function subtotalEmCentavos(item) {
  return emCentavos(item.preco_unitario) * item.quantidade;
}

// Números do topo do painel. Só pedidos pagos contam como venda.
export function resumirPedidos(pedidos) {
  const pagos = pedidos.filter(pedidoPago);
  const centavos = pagos.reduce((soma, p) => soma + emCentavos(p.valor_total), 0);
  return {
    pedidos: pagos.length,
    faturamento: centavos / 100,
    ticketMedio: pagos.length > 0 ? Math.round(centavos / pagos.length) / 100 : 0,
    itens: pagos.reduce((soma, p) => soma + contarUnidades(p.pedido_itens ?? []), 0),
  };
}

// Variação em % entre dois valores; null quando não há base de comparação
export function variacaoPercentual(atual, anterior) {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

// Faturamento de cada dia do período, com os dias sem venda valendo zero
export function faturamentoPorDia(pedidos, inicio, dias) {
  const centavosPorDia = new Array(dias).fill(0);
  const primeiroDia = inicioDoDia(inicio).getTime();

  for (const pedido of pedidos.filter(pedidoPago)) {
    // Math.round absorve a hora a mais ou a menos do horário de verão
    const indice = Math.round((inicioDoDia(pedido.data).getTime() - primeiroDia) / UM_DIA_MS);
    if (indice >= 0 && indice < dias) centavosPorDia[indice] += emCentavos(pedido.valor_total);
  }
  return centavosPorDia.map((centavos, i) => ({ data: somarDias(inicio, i), valor: centavos / 100 }));
}

// Soma os itens dos pedidos pagos agrupando por uma chave (categoria, produto...)
function agruparItens(pedidos, extrairGrupo) {
  const grupos = new Map();
  for (const item of pedidos.filter(pedidoPago).flatMap((p) => p.pedido_itens ?? [])) {
    const { chave, ...dados } = extrairGrupo(item);
    const grupo = grupos.get(chave) ?? { ...dados, quantidade: 0, centavos: 0 };
    grupo.quantidade += item.quantidade;
    grupo.centavos += subtotalEmCentavos(item);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].map(({ centavos, ...grupo }) => ({ ...grupo, valor: centavos / 100 }));
}

export function vendasPorCategoria(pedidos) {
  return agruparItens(pedidos, (item) => {
    const nome = item.produtos?.categorias?.nome ?? 'Sem categoria';
    return { chave: nome, nome };
  }).sort((a, b) => b.valor - a.valor);
}

export function produtosMaisVendidos(pedidos, limite = 5) {
  return agruparItens(pedidos, (item) => ({
    chave: item.produto_id,
    id: item.produto_id,
    nome: item.produtos?.nome ?? 'Produto removido',
    imagem_url: item.produtos?.imagem_url ?? null,
  }))
    .sort((a, b) => (b.quantidade - a.quantidade) || (b.valor - a.valor))
    .slice(0, limite);
}

// Quantos pedidos há em cada situação, na ordem do ciclo de vida do pedido
export function contarPorStatus(pedidos) {
  return Object.keys(NOMES_STATUS).map((status) => ({
    status,
    total: pedidos.filter((p) => p.status === status).length,
  }));
}

// Topo "redondo" para o eixo do gráfico: 0, 250, 500, 750, 1000...
export function escalaDoEixo(maximo, divisoes = 4) {
  if (!(maximo > 0)) return { topo: divisoes, passo: 1 };
  const passoBruto = maximo / divisoes;
  const potencia = 10 ** Math.floor(Math.log10(passoBruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= passoBruto);
  return { topo: passo * divisoes, passo };
}

// ---------- relatório em CSV (abre no Excel em português) ----------

// Célula que começa com = + - @ vira fórmula no Excel ("CSV injection").
// O apóstrofo na frente faz o Excel tratar como texto.
export function celulaCsv(valor) {
  let texto = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function valorCsv(numero) {
  return Number(numero || 0).toFixed(2).replace('.', ',');
}

export function relatorioCsv(pedidos) {
  const cabecalho = ['Pedido', 'Data', 'Situação', 'Pagamento', 'Itens', 'Total (R$)'];
  const linhas = pedidos.map((p) => [
    p.id,
    formatarDataHora(p.data),
    NOMES_STATUS[p.status] ?? p.status,
    FORMAS_PAGAMENTO[p.forma_pagamento] ?? p.forma_pagamento,
    contarUnidades(p.pedido_itens ?? []),
    valorCsv(p.valor_total),
  ]);
  return [cabecalho, ...linhas].map((linha) => linha.map(celulaCsv).join(';')).join('\r\n');
}
