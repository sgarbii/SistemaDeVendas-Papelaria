// Lista de todos os pedidos com mudança de status (RF07).
import { mensagemDeErro } from '../../services/supabase.js';
import { el, trocarConteudo } from '../../utils/html.js';
import { formatarPreco, formatarDataHora } from '../../utils/formatacao.js';
import { mostrarCarregando, mostrarErro, mostrarVazio, avisar } from '../componentes.js';
import { montarPainel } from './painel.js';
import { listarTodosPedidos, mudarStatusPedido } from '../../services/admin.js';
import { NOMES_STATUS, FORMAS_PAGAMENTO } from '../../services/pedidos.js';

const conteudo = document.getElementById('conteudo');

if (await montarPainel('pedidos.html')) carregar();

async function carregar() {
  mostrarCarregando(conteudo, 'Carregando pedidos…');
  try {
    mostrarLista(await listarTodosPedidos());
  } catch (erro) {
    mostrarErro(conteudo, mensagemDeErro(erro), carregar);
  }
}

function mostrarLista(pedidos) {
  const titulo = el('div', { class: 'barra-titulo' }, el('h1', { class: 'titulo-pagina' }, el('span', { class: 'grifo' }, 'Pedidos')));
  if (pedidos.length === 0) {
    const area = el('div');
    mostrarVazio(area, { titulo: 'Nenhum pedido ainda', texto: 'Os pedidos dos clientes aparecem aqui.' });
    trocarConteudo(conteudo, titulo, area);
    return;
  }

  trocarConteudo(conteudo,
    titulo,
    el('table', { class: 'tabela' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Nº'),
        el('th', {}, 'Data'),
        el('th', {}, 'Cliente'),
        el('th', {}, 'Itens'),
        el('th', { class: 'numero' }, 'Total'),
        el('th', {}, 'Status')
      )),
      el('tbody', {}, pedidos.map(linhaPedido))
    )
  );
}

function linhaPedido(pedido) {
  const seletor = el('select', { 'aria-label': `Status do pedido ${pedido.id}` },
    Object.entries(NOMES_STATUS).map(([valor, nome]) =>
      el('option', { value: valor, selected: valor === pedido.status }, nome))
  );
  seletor.addEventListener('change', async () => {
    const anterior = pedido.status;
    seletor.disabled = true;
    try {
      await mudarStatusPedido(pedido.id, seletor.value);
      pedido.status = seletor.value;
      avisar(`Pedido nº ${pedido.id}: ${NOMES_STATUS[pedido.status]}.`);
    } catch (erro) {
      seletor.value = anterior;
      avisar(mensagemDeErro(erro), 'erro');
    } finally {
      seletor.disabled = false;
    }
  });

  const itens = pedido.pedido_itens
    .map((i) => `${i.quantidade}× ${i.produtos?.nome ?? 'produto'}`)
    .join(', ');

  return el('tr', {},
    el('td', { 'data-rotulo': 'Nº' }, String(pedido.id)),
    el('td', { 'data-rotulo': 'Data' }, formatarDataHora(pedido.data)),
    // RE01: cliente que excluiu a conta aparece sem identificação
    el('td', { 'data-rotulo': 'Cliente' }, pedido.perfis?.nome ?? 'Cliente removido (LGPD)',
      el('div', { class: 'dica' }, pedido.endereco_entrega)),
    el('td', { 'data-rotulo': 'Itens' }, itens,
      el('div', { class: 'dica' }, FORMAS_PAGAMENTO[pedido.forma_pagamento] ?? pedido.forma_pagamento)),
    el('td', { class: 'numero', 'data-rotulo': 'Total' }, formatarPreco(pedido.valor_total)),
    el('td', { 'data-rotulo': 'Status' }, seletor)
  );
}
