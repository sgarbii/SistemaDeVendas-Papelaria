// Página do produto, com o botão de compra e as avaliações (RF01, RF02, Cenário 01).
import { mensagemDeErro } from '../services/supabase.js';
import { el, trocarConteudo } from '../utils/html.js';
import { formatarPreco, formatarNota, formatarData } from '../utils/formatacao.js';
import { montarPagina } from './cabecalho.js';
import {
  icone, imagemProduto, estrelas, seloCompraSegura, seletorQuantidade,
  mostrarCarregando, mostrarErro, mostrarVazio, avisar,
} from './componentes.js';
import { obterProduto, listarAvaliacoes } from '../services/produtos.js';
import { obterSessao, irParaLogin } from '../services/auth.js';
import { adicionarAoCarrinho } from '../services/carrinho.js';

const conteudo = document.getElementById('conteudo');
const produtoId = Number(new URLSearchParams(location.search).get('id'));

await montarPagina();
carregar();

async function carregar() {
  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    mostrarNaoEncontrado();
    return;
  }
  mostrarCarregando(conteudo, 'Carregando produto…');
  try {
    const [produto, avaliacoes] = await Promise.all([obterProduto(produtoId), listarAvaliacoes(produtoId)]);
    if (!produto) {
      mostrarNaoEncontrado();
      return;
    }
    mostrarProduto(produto, avaliacoes);
  } catch (erro) {
    mostrarErro(conteudo, mensagemDeErro(erro), carregar); // FE02
  }
}

function mostrarNaoEncontrado() {
  mostrarVazio(conteudo, {
    titulo: 'Produto não encontrado',
    texto: 'Ele pode ter sido removido da loja.',
    ilustracao: 'erro-404',
    extras: [el('a', { class: 'botao', href: '/index.html' }, 'Voltar para a loja')],
  });
}

// Texto da situação do estoque (disponível já descontando as reservas)
function textoEstoque(produto) {
  if (!produto.ativo) return el('p', { class: 'estoque esgotado' }, 'Este produto não está mais à venda.');
  if (produto.estoque === 0) return el('p', { class: 'estoque esgotado' }, 'Produto indisponível no momento.');
  if (produto.estoque <= 5) return el('p', { class: 'estoque pouco' }, `Últimas ${produto.estoque} unidades!`);
  return el('p', { class: 'estoque ok' }, 'Em estoque');
}

function mostrarProduto(produto, avaliacoes) {
  document.title = `${produto.nome} — Papelaria Online`;

  const areaEstoque = el('div', {}, textoEstoque(produto));
  const quantidade = seletorQuantidade({ valor: 1, maximo: Math.max(produto.estoque, 1) });
  const botaoComprar = botaoAdicionar(produto, quantidade, areaEstoque);
  if (!podeComprar(produto)) {
    botaoComprar.disabled = true;
    quantidade.querySelectorAll('button, input').forEach((c) => { c.disabled = true; });
  }

  const nota = Number(produto.nota_media);
  const categoria = produto.categorias;

  trocarConteudo(conteudo,
    el('nav', { class: 'trilha', 'aria-label': 'Você está em' },
      el('a', { href: '/index.html' }, 'Início'), ' › ',
      categoria ? el('a', { href: `/index.html?categoria=${Number(categoria.id)}` }, categoria.nome) : null,
      categoria ? ' › ' : null,
      el('span', { 'aria-current': 'page' }, produto.nome)
    ),
    el('article', { class: 'produto-detalhe' },
      el('figure', { class: 'produto-imagem' }, imagemProduto(produto, { loading: 'eager' })),
      el('div', { class: 'produto-info' },
        el('span', { class: 'cartao-categoria' }, categoria?.nome ?? ''),
        el('h1', {}, produto.nome),
        el('a', { class: 'linha-nota', href: '#avaliacoes' },
          estrelas(nota),
          nota > 0 ? `${formatarNota(nota)} · ` : '',
          `${avaliacoes.length} ${avaliacoes.length === 1 ? 'avaliação' : 'avaliações'}`
        ),
        el('p', { class: 'produto-preco' }, formatarPreco(produto.preco)),
        areaEstoque,
        el('div', { class: 'comprar' }, quantidade, botaoComprar),
        seloCompraSegura(),
        el('h2', { class: 'visualmente-oculto' }, 'Descrição'),
        el('p', { class: 'descricao' }, produto.descricao)
      )
    ),
    secaoAvaliacoes(avaliacoes)
  );
}

function podeComprar(produto) {
  return produto.ativo && produto.estoque > 0;
}

// Cenário 01: um clique adiciona o item (RNF04)
function botaoAdicionar(produto, quantidade, areaEstoque) {
  const botao = el('button', { class: 'botao botao-compra', type: 'button' }, icone('carrinho'), 'Adicionar ao carrinho');
  botao.addEventListener('click', async () => {
    // FA01: sem login, vai para o login e depois volta para este produto
    if (!(await obterSessao())) {
      irParaLogin();
      return;
    }
    botao.disabled = true;
    botao.lastChild.textContent = 'Adicionando…';
    await adicionar(produto, quantidade.valor());
    trocarConteudo(areaEstoque, textoEstoque(produto));
    botao.lastChild.textContent = 'Adicionar ao carrinho';
    botao.disabled = !podeComprar(produto);
  });
  return botao;
}

async function adicionar(produto, pedida) {
  try {
    const adicionada = await adicionarAoCarrinho(produto.id, pedida);
    produto.estoque -= adicionada;
    if (adicionada < pedida) {
      // FA02: quantidade maior que o estoque -> limitada ao disponível
      avisar(`Só havia ${adicionada} unidade(s) disponível(is). Adicionamos ${adicionada} ao carrinho.`, 'alerta');
    } else {
      avisar(`${adicionada > 1 ? `${adicionada} unidades adicionadas` : 'Produto adicionado'} ao carrinho!`);
    }
  } catch (erro) {
    if (erro.semSessao) {
      irParaLogin(); // sessão expirou (RNF02)
      return;
    }
    if (/indispon/i.test(mensagemDeErro(erro))) produto.estoque = 0; // FE01: esgotou
    avisar(mensagemDeErro(erro), 'erro'); // FE01 / FE02: o item não entra no carrinho
  }
}

// RF02: as avaliações aparecem na página do produto
function secaoAvaliacoes(avaliacoes) {
  return el('section', { class: 'secao', id: 'avaliacoes', 'aria-labelledby': 'titulo-avaliacoes' },
    el('h2', { id: 'titulo-avaliacoes' }, 'O que diz quem comprou'),
    avaliacoes.length === 0
      ? el('p', { class: 'subtitulo' }, 'Este produto ainda não tem avaliações. Só quem compra pode avaliar.')
      : el('ul', { class: 'lista-avaliacoes' },
          avaliacoes.map((a) =>
            el('li', { class: 'avaliacao' },
              estrelas(a.nota),
              el('p', {}, a.comentario), // textContent: o comentário nunca vira HTML
              el('span', { class: 'meta' },
                el('span', { class: 'verificada' }, '✔ Compra verificada'),
                ` · ${formatarData(a.publicado_em)}`
              )
            )
          )
        )
  );
}
