// Carrinho (RF01, RN02) e finalização da compra (RF06, RN04).
// Etapas na mesma página: carrinho -> entrega e pagamento -> pedido confirmado.
import { mensagemDeErro } from '../services/supabase.js';
import { el, trocarConteudo } from '../utils/html.js';
import { formatarPreco, formatarTempo } from '../utils/formatacao.js';
import { calcularSubtotal, calcularTotal, contarUnidades, tempoRestanteReserva } from '../utils/calculos.js';
import { montarPagina } from './cabecalho.js';
import {
  icone, imagemProduto, seloCompraSegura, seletorQuantidade,
  mostrarCarregando, mostrarErro, mostrarVazio, avisar,
} from './componentes.js';
import { camposEndereco, enderecoCompleto } from './endereco.js';
import { exigirLogin, irParaLogin, obterPerfil } from '../services/auth.js';
import { listarItens, alterarQuantidade, removerDoCarrinho } from '../services/carrinho.js';
import { finalizarPedido, FORMAS_PAGAMENTO } from '../services/pedidos.js';

const conteudo = document.getElementById('conteudo');
let itens = [];
let cronometro = null;

// RNF02: carrinho só com login
const sessao = await exigirLogin();
if (sessao) {
  await montarPagina();
  carregarCarrinho();
}

// Converte o item do banco para o formato usado nos cálculos
function paraCalculo(item) {
  return { preco: item.produtos.preco, quantidade: item.quantidade };
}

function tratarErro(erro) {
  if (erro.semSessao) irParaLogin();
  else avisar(mensagemDeErro(erro), 'erro');
}

async function carregarCarrinho() {
  mostrarCarregando(conteudo, 'Carregando seu carrinho…');
  try {
    itens = await listarItens();
    mostrarCarrinho();
  } catch (erro) {
    if (erro.semSessao) return irParaLogin();
    mostrarErro(conteudo, mensagemDeErro(erro), carregarCarrinho); // FE02
  }
}

// ---------- etapa 1: carrinho ----------
function mostrarCarrinho() {
  pararCronometro();
  if (itens.length === 0) {
    mostrarVazio(conteudo, {
      titulo: 'Seu carrinho está vazio',
      texto: 'Que tal dar uma olhada nos produtos mais populares?',
      extras: [el('a', { class: 'botao botao-primario', href: '/index.html' }, 'Ver produtos')],
    });
    return;
  }

  const total = calcularTotal(itens.map(paraCalculo));
  const unidades = contarUnidades(itens);

  trocarConteudo(conteudo,
    el('h1', { class: 'titulo-pagina' }, 'Seu ', el('span', { class: 'grifo' }, 'carrinho')),
    el('p', { class: 'subtitulo' }, 'Cada item fica reservado para você por 15 minutos.'),
    el('div', { class: 'layout-carrinho' },
      el('ul', { class: 'lista-carrinho' }, itens.map(linhaItem)),
      el('aside', { class: 'resumo', 'aria-label': 'Resumo da compra' },
        el('h2', {}, 'Resumo'),
        el('dl', {},
          el('dt', {}, `Produtos (${unidades} ${unidades === 1 ? 'unidade' : 'unidades'})`),
          el('dd', {}, formatarPreco(total)),
          el('dt', { class: 'total' }, 'Total'),
          el('dd', { class: 'total' }, formatarPreco(total))
        ),
        el('button', { class: 'botao botao-compra botao-largo', type: 'button', onclick: () => mostrarCheckout() },
          'Finalizar compra'),
        seloCompraSegura()
      )
    )
  );
  iniciarCronometro();
}

function linhaItem(item) {
  const produto = item.produtos;
  const subtotal = calcularSubtotal(produto.preco, item.quantidade);

  // o banco limita ao estoque disponível e devolve a quantidade possível (FA02)
  const quantidade = seletorQuantidade({
    valor: item.quantidade,
    maximo: 99,
    rotulo: `Quantidade de ${produto.nome}`,
    aoMudar: (nova) => mudarQuantidade(item, nova),
  });

  return el('li', { class: 'item-carrinho' },
    el('a', { href: `/produto.html?id=${Number(item.produto_id)}`, tabindex: '-1', 'aria-hidden': 'true' },
      imagemProduto(produto, { alt: '' })),
    el('div', {},
      el('h3', {}, el('a', { href: `/produto.html?id=${Number(item.produto_id)}` }, produto.nome)),
      el('span', { class: 'item-preco-un' }, `${formatarPreco(produto.preco)} cada`),
      el('div', {}, seloReserva(item)),
      !produto.ativo ? el('p', { class: 'mensagem-erro' }, 'Este produto saiu de venda.') : null
    ),
    el('div', { class: 'item-acoes' },
      quantidade,
      el('span', { class: 'item-subtotal' }, formatarPreco(subtotal)),
      el('button', {
        class: 'botao-texto perigo',
        type: 'button',
        'aria-label': `Remover ${produto.nome}`,
        onclick: () => remover(item),
      }, icone('lixeira'), 'Remover')
    )
  );
}

// RN02: selo com o tempo restante da reserva, atualizado a cada segundo
function seloReserva(item) {
  const selo = el('span', { class: 'reserva', 'data-reservado-ate': item.reservado_ate ?? '' });
  atualizarSelo(selo);
  return selo;
}

function atualizarSelo(selo) {
  const restante = tempoRestanteReserva(selo.dataset.reservadoAte || null);
  if (restante > 0) {
    selo.className = restante < 2 * 60 * 1000 ? 'reserva acabando' : 'reserva';
    selo.replaceChildren(icone('relogio'), `Reservado por ${formatarTempo(restante)}`);
  } else {
    // a reserva venceu: o estoque será conferido de novo ao finalizar (RN04)
    selo.className = 'reserva expirada';
    selo.replaceChildren(icone('alerta'), 'Reserva expirada: conferimos o estoque ao finalizar');
  }
}

function iniciarCronometro() {
  cronometro = setInterval(() => {
    document.querySelectorAll('.reserva').forEach(atualizarSelo);
  }, 1000);
}

function pararCronometro() {
  clearInterval(cronometro);
}

async function mudarQuantidade(item, pedida) {
  try {
    const nova = await alterarQuantidade(item.produto_id, pedida);
    if (nova < pedida) {
      avisar(`Só temos ${nova} unidade(s) de "${item.produtos.nome}" disponíveis.`, 'alerta'); // FA02
    }
  } catch (erro) {
    tratarErro(erro);
  }
  await recarregarSemPiscar();
}

async function remover(item) {
  try {
    await removerDoCarrinho(item.produto_id);
    avisar(`"${item.produtos.nome}" saiu do carrinho.`);
  } catch (erro) {
    tratarErro(erro);
  }
  await recarregarSemPiscar();
}

// Recarrega os itens sem mostrar a tela de "carregando"
async function recarregarSemPiscar() {
  try {
    itens = await listarItens();
    mostrarCarrinho();
  } catch (erro) {
    mostrarErro(conteudo, mensagemDeErro(erro), carregarCarrinho);
  }
}

// ---------- etapa 2: entrega e pagamento ----------
// avisosRn04, enderecoAnterior e pagamentoAnterior vêm preenchidos quando a
// tela é mostrada de novo depois de um ajuste da RN04 (para não perder o que foi digitado)
async function mostrarCheckout(avisosRn04 = null, enderecoAnterior = null, pagamentoAnterior = 'PIX') {
  pararCronometro();
  let perfil = null;
  if (!enderecoAnterior) {
    try {
      perfil = await obterPerfil();
    } catch {
      // sem o perfil, o cliente só digita o endereço
    }
  }

  const endereco = camposEndereco(enderecoAnterior ?? perfil ?? {});
  const total = calcularTotal(itens.map(paraCalculo));

  const formasPagamento = el('fieldset', { class: 'formas-pagamento' },
    el('legend', { class: 'legenda' }, 'Forma de pagamento'),
    Object.entries(FORMAS_PAGAMENTO).map(([valor, nome]) =>
      el('label', { class: 'forma' },
        el('input', { type: 'radio', name: 'pagamento', value: valor, checked: valor === pagamentoAnterior }),
        nome
      )
    )
  );

  const botaoConfirmar = el('button', { class: 'botao botao-compra botao-largo', type: 'submit' },
    avisosRn04 ? 'Confirmar com as mudanças' : 'Confirmar pedido e pagar');

  const form = el('form', { class: 'layout-carrinho', novalidate: true },
    el('div', {},
      avisosRn04 ? caixaAvisos(avisosRn04) : null,
      el('section', { class: 'painel' },
        el('h2', {}, '1. Endereço de entrega'),
        endereco.elemento
      ),
      el('section', { class: 'painel' },
        el('h2', {}, '2. Pagamento'),
        el('p', { class: 'dica' }, 'Pagamento simulado: nenhuma cobrança real é feita nesta versão da loja.'),
        formasPagamento
      )
    ),
    el('aside', { class: 'resumo', 'aria-label': 'Revisão do pedido' },
      el('h2', {}, 'Revise seu pedido'),
      el('dl', {},
        itens.flatMap((item) => [
          el('dt', {}, `${item.quantidade}× ${item.produtos.nome}`),
          el('dd', {}, formatarPreco(calcularSubtotal(item.produtos.preco, item.quantidade))),
        ]),
        el('dt', { class: 'total' }, 'Total'),
        el('dd', { class: 'total' }, formatarPreco(total))
      ),
      botaoConfirmar,
      el('button', { class: 'botao-texto', type: 'button', onclick: () => mostrarCarrinho() }, '← Voltar ao carrinho'),
      seloCompraSegura()
    )
  );

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!endereco.validar(true)) return;

    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = 'Processando…';
    try {
      const resultado = await finalizarPedido(enderecoCompleto(endereco.valores()), form.pagamento.value);

      if (resultado.ok) {
        mostrarConfirmacao(resultado.pedido_id);
        return;
      }
      // RN04: o banco ajustou o carrinho e não criou o pedido -> o cliente revê e confirma
      itens = await listarItens();
      if (itens.length === 0) {
        mostrarCarrinho();
        avisar('Os itens do seu carrinho esgotaram.', 'alerta');
        return;
      }
      mostrarCheckout(resultado.avisos, endereco.valores(), form.pagamento.value);
    } catch (erro) {
      tratarErro(erro); // FE02: falha de conexão -> nada é criado
      botaoConfirmar.disabled = false;
      botaoConfirmar.textContent = 'Confirmar pedido e pagar';
    }
  });

  trocarConteudo(conteudo,
    el('h1', { class: 'titulo-pagina' }, 'Finalizar ', el('span', { class: 'grifo' }, 'compra')),
    form
  );
  conteudo.focus();
}

// RN04: lista do que mudou no carrinho, mostrada antes de confirmar
function caixaAvisos(avisos) {
  return el('div', { class: 'caixa caixa-alerta', role: 'alert' },
    el('p', {}, el('strong', {}, 'Atualizamos seu carrinho, porque a reserva de alguns itens tinha vencido:')),
    el('ul', {}, avisos.map((a) => el('li', {}, el('strong', {}, a.produto), `: ${a.mensagem}.`))),
    el('p', {}, 'Confira o novo total e confirme de novo.')
  );
}

// ---------- etapa 3: pedido confirmado ----------
function mostrarConfirmacao(pedidoId) {
  itens = [];
  trocarConteudo(conteudo,
    el('section', { class: 'confirmacao', role: 'status' },
      icone('ok'),
      el('h1', { class: 'titulo-pagina' }, 'Pedido ', el('span', { class: 'grifo' }, `nº ${pedidoId}`), ' confirmado!'),
      el('p', {}, 'Pagamento simulado aprovado. Você pode acompanhar a situação do pedido em "Meus pedidos".'),
      el('div', { class: 'acoes' },
        el('a', { class: 'botao botao-primario', href: '/pedidos.html' }, 'Ver meus pedidos'),
        el('a', { class: 'botao', href: '/index.html' }, 'Continuar comprando')
      )
    )
  );
}
