// Página inicial, busca e categorias (RF03, Cenário 03).
//   /index.html                -> mais populares e bem avaliados
//   /index.html?busca=caneta   -> resultado da busca
//   /index.html?categoria=3    -> produtos da categoria
import { mensagemDeErro } from '../services/supabase.js';
import { el, trocarConteudo } from '../utils/html.js';
import { termoDeBuscaValido } from '../utils/validacao.js';
import { montarPagina } from './cabecalho.js';
import { cartaoProduto, mostrarCarregando, mostrarErro, mostrarVazio } from './componentes.js';
import {
  listarPopulares, buscarProdutos, listarPorCategoria, listarCategorias, obterCategoria,
} from '../services/produtos.js';

const conteudo = document.getElementById('conteudo');
let categorias = [];

await montarPagina();
iniciar();

function iniciar() {
  const parametros = new URLSearchParams(location.search);
  const termo = parametros.get('busca');
  const categoriaId = Number(parametros.get('categoria')) || null;

  if (termoDeBuscaValido(termo)) {
    carregar({ modo: 'busca', termo: termo.trim() });
  } else if (categoriaId) {
    carregar({ modo: 'categoria', categoriaId });
  } else {
    carregar({ modo: 'populares' });
  }

  // FA02: se o usuário apaga o texto da busca, voltam os mais populares
  const campoBusca = document.getElementById('campo-busca');
  campoBusca?.addEventListener('input', () => {
    if (campoBusca.value === '' && new URLSearchParams(location.search).has('busca')) {
      history.replaceState(null, '', '/index.html');
      carregar({ modo: 'populares' });
    }
  });
}

async function carregar(estado) {
  mostrarCarregando(conteudo, 'Carregando produtos…');
  try {
    // as categorias aparecem como atalhos e como sugestão (FA01)
    if (categorias.length === 0) categorias = await listarCategorias();

    let produtos;
    let titulo;
    let subtitulo;

    if (estado.modo === 'busca') {
      produtos = await buscarProdutos(estado.termo);
      titulo = el('span', {}, 'Resultados para ', el('span', { class: 'grifo' }, `“${estado.termo}”`));
      subtitulo = `${produtos.length} ${produtos.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
      document.title = `Busca: ${estado.termo} — Papelaria Online`;
    } else if (estado.modo === 'categoria') {
      const categoria = await obterCategoria(estado.categoriaId);
      produtos = categoria ? await listarPorCategoria(estado.categoriaId) : [];
      titulo = el('span', { class: 'grifo' }, categoria?.nome ?? 'Categoria não encontrada');
      subtitulo = 'Ordenados pelos mais vendidos e mais bem avaliados';
      if (categoria) document.title = `${categoria.nome} — Papelaria Online`;
    } else {
      produtos = await listarPopulares();
      titulo = el('span', {}, 'Mais populares e ', el('span', { class: 'grifo' }, 'bem avaliados'));
      subtitulo = 'O que nossos clientes mais compram e recomendam';
    }

    mostrarProdutos(estado, titulo, subtitulo, produtos);
  } catch (erro) {
    mostrarErro(conteudo, mensagemDeErro(erro), () => carregar(estado)); // FE02
  }
}

function faixaCategorias(categoriaAtual) {
  return el('ul', { class: 'faixa-categorias', 'aria-label': 'Atalhos de categorias' },
    categorias.map((c) =>
      el('li', {}, el('a', {
        class: 'chip',
        href: `/index.html?categoria=${Number(c.id)}`,
        'aria-current': c.id === categoriaAtual ? 'page' : null,
      }, c.nome))
    )
  );
}

function mostrarProdutos(estado, titulo, subtitulo, produtos) {
  const cabecalhoSecao = [
    el('h1', { class: 'titulo-pagina' }, titulo),
    el('p', { class: 'subtitulo' }, subtitulo),
  ];

  // Cenário 03, FA01: nada encontrado -> mensagem e sugestão de categorias
  if (produtos.length === 0) {
    const area = el('div');
    mostrarVazio(area, {
      titulo: 'Nenhum produto encontrado',
      texto: 'Confira a grafia ou explore uma destas categorias:',
      nomeIcone: 'busca',
      extras: [faixaCategorias(estado.categoriaId)],
    });
    trocarConteudo(conteudo, cabecalhoSecao[0], area);
    return;
  }

  trocarConteudo(conteudo,
    ...cabecalhoSecao,
    estado.modo !== 'busca' ? faixaCategorias(estado.categoriaId) : null,
    el('ul', { class: 'grade-produtos' }, produtos.map((p, i) => cartaoProduto(p, i)))
  );
}
