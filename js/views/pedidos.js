// "Meus pedidos" (RF06) e avaliação dos produtos comprados (RF02, RN01, Cenário 02).
import { mensagemDeErro } from '../services/supabase.js';
import { el, trocarConteudo } from '../utils/html.js';
import { formatarPreco, formatarDataHora, formatarData } from '../utils/formatacao.js';
import { podeEditarAvaliacao } from '../utils/calculos.js';
import { montarPagina } from './cabecalho.js';
import {
  imagemProduto, estrelas, seloStatus, mostrarCarregando, mostrarErro, mostrarVazio, avisar,
} from './componentes.js';
import { abrirJanelaAvaliacao } from './avaliacao.js';
import { exigirLogin, irParaLogin } from '../services/auth.js';
import {
  listarMeusPedidos, avaliacaoDoItem,
} from '../services/pedidos.js';
import { FORMAS_PAGAMENTO, pedidoPago } from '../utils/constantes.js';
import { publicarAvaliacao, editarAvaliacao } from '../services/avaliacoes.js';

const conteudo = document.getElementById('conteudo');

const sessao = await exigirLogin();
if (sessao) {
  await montarPagina();
  carregar();
}

async function carregar() {
  mostrarCarregando(conteudo, 'Carregando seus pedidos…');
  try {
    const pedidos = await listarMeusPedidos(sessao.user.id);
    mostrarPedidos(pedidos);
  } catch (erro) {
    if (erro.semSessao) return irParaLogin();
    mostrarErro(conteudo, mensagemDeErro(erro), carregar); // FE02
  }
}

function mostrarPedidos(pedidos) {
  if (pedidos.length === 0) {
    mostrarVazio(conteudo, {
      titulo: 'Você ainda não fez pedidos',
      texto: 'Quando comprar, seus pedidos aparecem aqui para você acompanhar.',
      ilustracao: 'sem-pedidos',
      extras: [el('a', { class: 'botao botao-primario', href: '/index.html' }, 'Ir às compras')],
    });
    return;
  }

  trocarConteudo(conteudo,
    el('h1', { class: 'titulo-pagina' }, 'Meus pedidos'),
    el('p', { class: 'subtitulo' }, 'Acompanhe a situação de cada pedido e avalie o que você comprou.'),
    el('ul', { class: 'lista-pedidos' }, pedidos.map(cartaoPedido))
  );
}

function cartaoPedido(pedido) {
  const avaliavel = pedidoPago(pedido); // RNF07: só itens de pedidos pagos
  return el('li', { class: 'pedido' },
    el('div', { class: 'pedido-topo' },
      el('div', {},
        el('h2', {}, `Pedido nº ${pedido.id}`),
        el('span', { class: 'meta' }, formatarDataHora(pedido.data))
      ),
      seloStatus(pedido.status)
    ),
    el('ul', { class: 'pedido-itens' }, pedido.pedido_itens.map((item) => linhaItem(item, avaliavel))),
    el('div', { class: 'pedido-rodape' },
      el('span', {}, `Entrega: ${pedido.endereco_entrega}`),
      el('span', {}, `${FORMAS_PAGAMENTO[pedido.forma_pagamento] ?? pedido.forma_pagamento} · `,
        el('span', { class: 'total' }, formatarPreco(pedido.valor_total)))
    )
  );
}

function linhaItem(item, pedidoAvaliavel) {
  const produto = item.produtos ?? { nome: 'Produto removido' };
  return el('li', { class: 'pedido-item' },
    imagemProduto(produto, { alt: '' }),
    el('div', {},
      el('a', { class: 'nome', href: `/produto.html?id=${Number(item.produto_id)}` }, produto.nome),
      el('div', { class: 'detalhe' }, `${item.quantidade} × ${formatarPreco(item.preco_unitario)}`)
    ),
    el('div', { class: 'acao-avaliar' }, acaoAvaliar(item, produto, pedidoAvaliavel))
  );
}

// Cenário 02, passo 2: botão "Avaliar" só em itens pagos e ainda não avaliados
function acaoAvaliar(item, produto, pedidoAvaliavel) {
  const avaliacao = avaliacaoDoItem(item);

  if (avaliacao) {
    // FE01: já avaliado -> mostra a avaliação feita
    // RN01: o autor edita até 7 dias depois; depois disso o botão some
    return [
      el('span', { class: 'minha-avaliacao' }, 'Sua avaliação: ', estrelas(avaliacao.nota),
        ` em ${formatarData(avaliacao.publicado_em)}`),
      podeEditarAvaliacao(avaliacao.publicado_em)
        ? el('button', {
            class: 'botao-texto', type: 'button',
            onclick: () => abrirJanelaAvaliacao({
              titulo: 'Editar avaliação',
              nomeProduto: produto.nome,
              nota: avaliacao.nota,
              comentario: avaliacao.comentario,
              aoEnviar: (nota, comentario) => enviar(() => editarAvaliacao(avaliacao.id, nota, comentario)),
              aoFechar: carregar,
            }),
          }, 'Editar')
        : null,
    ];
  }

  // FA02: produto não comprado (ou pedido não pago) -> sem botão
  if (!pedidoAvaliavel) return null;

  return el('button', {
    class: 'botao botao-primario',
    type: 'button',
    onclick: () => abrirJanelaAvaliacao({
      titulo: 'Avaliar produto',
      nomeProduto: produto.nome,
      aoEnviar: (nota, comentario) => enviar(() => publicarAvaliacao(item.id, nota, comentario)),
      aoFechar: carregar,
    }),
  }, 'Avaliar');
}

// Envia e trata a sessão vencida (Cenário 02, FE02)
async function enviar(acao) {
  try {
    return await acao();
  } catch (erro) {
    if (erro.semSessao) {
      avisar('Sua sessão expirou e a avaliação não foi enviada. Faça login de novo.', 'erro');
      setTimeout(() => irParaLogin(), 1500);
    }
    throw erro;
  }
}
