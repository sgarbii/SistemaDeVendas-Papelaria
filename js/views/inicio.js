// Página inicial, busca e categorias (RF03, Cenário 03).
//   /index.html                -> vitrine: destaque, categorias e mais populares
//   /index.html?busca=caneta   -> resultado da busca
//   /index.html?categoria=3    -> produtos da categoria
import { mensagemDeErro } from '../services/supabase.js';
import { el, trocarConteudo } from '../utils/html.js';
import { termoDeBuscaValido } from '../utils/validacao.js';
import { montarPagina } from './cabecalho.js';
import { cartaoProduto, mostrarCarregando, mostrarErro, mostrarVazio } from './componentes.js';
import {
  listarPopulares, buscarProdutos, listarPorCategoria, listarCategorias, obterCategoria, urlImagemCategoria,
} from '../services/produtos.js';

const conteudo = document.getElementById('conteudo');
let categorias = [];

await montarPagina();
iniciar();

function iniciar() {
  const parametros = new URLSearchParams(location.search);
  const termo = parametros.get('busca');
  const categoriaId = Number(parametros.get('categoria')) || null;

  if (termoDeBuscaValido(termo)) carregar(() => telaDeBusca(termo.trim()));
  else if (categoriaId) carregar(() => telaDeCategoria(categoriaId));
  else carregar(telaInicial);

  // FA02: se o usuário apaga o texto da busca, voltam os mais populares
  const campoBusca = document.getElementById('campo-busca');
  campoBusca?.addEventListener('input', () => {
    if (campoBusca.value === '' && new URLSearchParams(location.search).has('busca')) {
      history.replaceState(null, '', '/index.html');
      carregar(telaInicial);
    }
  });
}

// Mostra "carregando", monta a tela pedida e trata a falha de conexão (FE02)
async function carregar(montarTela) {
  mostrarCarregando(conteudo, 'Carregando produtos…');
  try {
    // as categorias aparecem como atalhos e como sugestão (FA01)
    if (categorias.length === 0) categorias = await listarCategorias();
    trocarConteudo(conteudo, ...(await montarTela()));
  } catch (erro) {
    mostrarErro(conteudo, mensagemDeErro(erro), () => carregar(montarTela));
  }
}

// ---------- telas ----------
async function telaInicial() {
  const produtos = await listarPopulares();
  return [
    destaque(),
    el('section', { class: 'secao-inicio', id: 'categorias', 'aria-labelledby': 'titulo-categorias' },
      el('h2', { id: 'titulo-categorias' }, 'Compre por categoria'),
      gradeCategorias()
    ),
    el('section', { class: 'secao-inicio', id: 'mais-vendidos', 'aria-labelledby': 'titulo-vitrine' },
      el('h2', { id: 'titulo-vitrine' }, 'Mais vendidos e bem avaliados'),
      el('p', { class: 'subtitulo' }, 'O que nossos clientes mais compram e recomendam.'),
      gradeProdutos(produtos)
    ),
    vantagens(),
  ];
}

async function telaDeBusca(termo) {
  const produtos = await buscarProdutos(termo);
  document.title = `Busca: ${termo} — Papelaria Online`;
  const titulo = el('h1', { class: 'titulo-pagina' }, `Resultados para “${termo}”`);
  if (produtos.length === 0) return [titulo, nadaEncontrado()];
  return [
    titulo,
    el('p', { class: 'subtitulo' }, `${produtos.length} ${produtos.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`),
    gradeProdutos(produtos),
  ];
}

async function telaDeCategoria(categoriaId) {
  const categoria = await obterCategoria(categoriaId);
  if (!categoria) return [el('h1', { class: 'titulo-pagina' }, 'Categoria não encontrada'), nadaEncontrado()];

  const produtos = await listarPorCategoria(categoriaId);
  document.title = `${categoria.nome} — Papelaria Online`;
  return [
    faixaDaCategoria(categoria),
    atalhosDeCategorias(categoriaId),
    produtos.length === 0 ? nadaEncontrado(categoriaId) : gradeProdutos(produtos),
  ];
}

// ---------- pedaços da página ----------
// Foto da mesa de estudos com o título por cima, na área vazia da imagem
function destaque() {
  return el('section', { class: 'destaque', 'aria-labelledby': 'titulo-destaque' },
    el('picture', {},
      el('source', { media: '(max-width: 699px)', srcset: '/img/banner/hero-mobile.webp', width: 1080, height: 1350 }),
      el('img', { src: '/img/banner/hero.webp', alt: '', width: 1920, height: 1080, fetchpriority: 'high' })
    ),
    el('div', { class: 'destaque-texto' },
      el('h1', { id: 'titulo-destaque' }, 'Do lápis à impressora, tudo para estudar e trabalhar'),
      el('p', {}, 'Material escolar, de escritório, arte e informática. O que você coloca no carrinho fica reservado por 15 minutos.'),
      el('div', { class: 'destaque-acoes' },
        el('a', { class: 'botao botao-compra', href: '#mais-vendidos' }, 'Ver os mais vendidos'),
        el('a', { class: 'botao', href: '#categorias' }, 'Explorar categorias')
      )
    )
  );
}

function gradeCategorias() {
  return el('ul', { class: 'grade-categorias' },
    categorias.map((categoria) => {
      const foto = urlImagemCategoria(categoria);
      return el('li', {},
        el('a', { class: foto ? 'bloco-categoria' : 'bloco-categoria sem-foto', href: `/index.html?categoria=${Number(categoria.id)}` },
          foto ? el('img', { src: foto, alt: '', width: 900, height: 600, loading: 'lazy' }) : null,
          el('span', { class: 'etiqueta' }, categoria.nome)
        )
      );
    })
  );
}

function faixaDaCategoria(categoria) {
  const foto = urlImagemCategoria(categoria);
  return el('header', { class: foto ? 'faixa-categoria' : 'faixa-categoria sem-foto' },
    foto ? el('img', { src: foto, alt: '', width: 900, height: 600 }) : null,
    el('div', { class: 'faixa-categoria-texto' },
      el('h1', {}, categoria.nome),
      el('p', {}, 'Ordenados pelos mais vendidos e mais bem avaliados')
    )
  );
}

function atalhosDeCategorias(categoriaAtual) {
  return el('ul', { class: 'faixa-categorias', 'aria-label': 'Outras categorias' },
    categorias.map((c) =>
      el('li', {}, el('a', {
        class: 'chip',
        href: `/index.html?categoria=${Number(c.id)}`,
        'aria-current': c.id === categoriaAtual ? 'page' : null,
      }, c.nome))
    )
  );
}

function gradeProdutos(produtos) {
  return el('ul', { class: 'grade-produtos' }, produtos.map(cartaoProduto));
}

// Cenário 03, FA01: nada encontrado -> mensagem e sugestão de categorias
function nadaEncontrado(categoriaAtual = null) {
  const area = el('div');
  mostrarVazio(area, {
    titulo: 'Nenhum produto encontrado',
    texto: 'Confira a grafia ou explore uma destas categorias:',
    ilustracao: 'busca-vazia',
    extras: [atalhosDeCategorias(categoriaAtual)],
  });
  return area;
}

const VANTAGENS = [
  { icone: 'compra-segura', titulo: 'Compra segura', texto: 'Conexão HTTPS e dados pessoais protegidos pela LGPD.' },
  { icone: 'reserva', titulo: 'Reserva de 15 minutos', texto: 'O que entra no carrinho fica separado para você.' },
  { icone: 'avaliacoes', titulo: 'Avaliações verificadas', texto: 'Só quem comprou e pagou pode avaliar um produto.' },
  { icone: 'entrega', titulo: 'Pedido acompanhado', texto: 'Veja a situação de cada compra em Meus pedidos.' },
];

function vantagens() {
  return el('section', { class: 'vantagens', 'aria-label': 'Por que comprar aqui' },
    el('ul', {},
      VANTAGENS.map((v) => el('li', {},
        el('img', { src: `/img/icones/${v.icone}.webp`, alt: '', width: 512, height: 512, loading: 'lazy' }),
        el('h3', {}, v.titulo),
        el('p', {}, v.texto)
      ))
    )
  );
}
