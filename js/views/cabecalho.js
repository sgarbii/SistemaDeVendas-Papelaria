// Cabeçalho e rodapé comuns a todas as páginas da loja (RF03):
// logotipo no topo; logo abaixo, a busca; na altura da busca, o menu
// de categorias à esquerda e o carrinho e o login à direita.
import { mensagemDeErro } from '../services/supabase.js';
import { el, trocarConteudo } from '../utils/html.js';
import { termoDeBuscaValido } from '../utils/validacao.js';
import { icone, logotipo, seloCompraSegura } from './componentes.js';
import { obterSessao, obterPerfil, sair, aoMudarSessao } from '../services/auth.js';
import { listarCategorias } from '../services/produtos.js';
import { contarItensDoCarrinho } from '../services/carrinho.js';

let contador;

export async function montarPagina() {
  const cabecalho = document.getElementById('cabecalho');
  const rodape = document.getElementById('rodape');

  const termoAtual = new URLSearchParams(location.search).get('busca') ?? '';

  // --- menu de categorias ---
  const painel = el('nav', { id: 'painel-categorias', class: 'painel-categorias', 'aria-label': 'Categorias', hidden: true });
  const botaoCategorias = el('button', {
    class: 'botao-icone botao-categorias',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'painel-categorias',
    'aria-label': 'Abrir menu de categorias',
  }, icone('menu'), el('span', { class: 'rotulo' }, 'Categorias'));

  botaoCategorias.addEventListener('click', () => {
    const abrir = painel.hidden;
    painel.hidden = !abrir;
    botaoCategorias.setAttribute('aria-expanded', String(abrir));
    if (abrir) carregarCategorias(painel);
  });

  // --- busca ---
  const campoBusca = el('input', {
    type: 'search',
    name: 'busca',
    id: 'campo-busca',
    placeholder: 'Buscar produtos…',
    'aria-label': 'Buscar produtos',
    autocomplete: 'off',
    maxlength: 100,
  });
  campoBusca.value = termoAtual; // value é texto puro, nunca HTML

  const formBusca = el('form', { class: 'busca', role: 'search', action: '/index.html', method: 'get' },
    campoBusca,
    el('button', { type: 'submit', 'aria-label': 'Buscar' }, icone('busca'))
  );
  // Cenário 03, FE01: busca só com espaços é ignorada (mantém a lista atual)
  formBusca.addEventListener('submit', (evento) => {
    if (!termoDeBuscaValido(campoBusca.value)) {
      evento.preventDefault();
      campoBusca.value = '';
    }
  });

  // --- carrinho e conta ---
  contador = el('span', { class: 'contador', 'aria-live': 'polite', hidden: true });
  const linkCarrinho = el('a', { class: 'botao-icone link-carrinho', href: '/carrinho.html', 'aria-label': 'Carrinho' },
    icone('carrinho'), contador);
  const areaConta = el('div', { class: 'conta' });

  trocarConteudo(cabecalho,
    el('div', { class: 'container' },
      el('div', { class: 'cabecalho-logo' }, logotipo()),
      el('div', { class: 'cabecalho-barra' },
        botaoCategorias,
        formBusca,
        el('div', { class: 'cabecalho-acoes' }, linkCarrinho, areaConta)
      ),
      painel
    )
  );

  // fecha os menus ao clicar fora ou apertar Esc
  document.addEventListener('click', (evento) => {
    if (!painel.hidden && !painel.contains(evento.target) && !botaoCategorias.contains(evento.target)) {
      painel.hidden = true;
      botaoCategorias.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !painel.hidden) {
      painel.hidden = true;
      botaoCategorias.setAttribute('aria-expanded', 'false');
      botaoCategorias.focus();
    }
  });

  trocarConteudo(rodape,
    el('div', { class: 'container' },
      seloCompraSegura(),
      el('p', {}, 'Papelaria Online · Projeto final ECOT11A — UNIFEI · Pagamento simulado (MVP)')
    )
  );

  const sessao = await obterSessao();
  await montarConta(areaConta, sessao);
  atualizarContador();

  // RNF04: contador atualizado assim que o carrinho muda
  window.addEventListener('carrinho-mudou', atualizarContador);
  aoMudarSessao(() => atualizarContador());

  return { sessao };
}

async function montarConta(area, sessao) {
  if (!sessao) {
    // RU08: visitante navega sem login; o link leva ao login e volta para cá
    const voltar = encodeURIComponent(location.pathname + location.search);
    const destino = location.pathname === '/login.html' ? '/login.html' : `/login.html?voltar=${voltar}`;
    trocarConteudo(area,
      el('a', { class: 'botao-icone', href: destino, 'aria-label': 'Entrar ou criar conta' },
        icone('usuario'), el('span', { class: 'rotulo' }, 'Entrar'))
    );
    return;
  }

  let perfil = null;
  try {
    perfil = await obterPerfil();
  } catch {
    // sem perfil o menu ainda funciona; só não mostra o nome
  }
  const primeiroNome = (perfil?.nome ?? 'cliente').split(' ')[0];

  const menu = el('ul', { class: 'menu-conta', id: 'menu-conta', hidden: true },
    el('li', { class: 'saudacao' }, `Olá, ${primeiroNome}`),
    el('li', {}, el('a', { href: '/pedidos.html' }, 'Meus pedidos')),
    el('li', {}, el('a', { href: '/perfil.html' }, 'Meu perfil')),
    // só visual: quem protege o painel é o RLS do banco
    perfil?.papel === 'admin' ? el('li', {}, el('a', { href: '/admin/index.html' }, 'Painel do administrador')) : null,
    el('li', {}, el('button', {
      type: 'button',
      onclick: async () => {
        await sair();
        location.href = '/index.html';
      },
    }, 'Sair'))
  );
  const botao = el('button', {
    class: 'botao-icone',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'menu-conta',
    'aria-label': `Conta de ${primeiroNome}`,
  }, icone('usuario'), el('span', { class: 'rotulo' }, primeiroNome));

  botao.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    botao.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', (evento) => {
    if (!menu.hidden && !area.contains(evento.target)) {
      menu.hidden = true;
      botao.setAttribute('aria-expanded', 'false');
    }
  });
  trocarConteudo(area, botao, menu);
}

async function carregarCategorias(painel) {
  if (painel.dataset.carregado) return;
  trocarConteudo(painel, el('p', { class: 'dica' }, 'Carregando categorias…'));
  try {
    const categorias = await listarCategorias();
    trocarConteudo(painel,
      el('h2', {}, 'Categorias'),
      el('ul', {},
        el('li', {}, el('a', { href: '/index.html' }, 'Mais populares')),
        categorias.map((c) => el('li', {}, el('a', { href: `/index.html?categoria=${Number(c.id)}` }, c.nome)))
      )
    );
    painel.dataset.carregado = 'sim';
  } catch (erro) {
    trocarConteudo(painel, el('p', { class: 'mensagem-erro' }, mensagemDeErro(erro)));
  }
}

async function atualizarContador() {
  if (!contador) return;
  try {
    const total = await contarItensDoCarrinho();
    const anterior = contador.textContent;
    contador.textContent = total > 99 ? '99+' : String(total);
    contador.hidden = total === 0;
    contador.closest('a').setAttribute('aria-label', `Carrinho com ${total} ${total === 1 ? 'item' : 'itens'}`);
    if (anterior !== contador.textContent) {
      contador.classList.remove('pulou');
      void contador.offsetWidth; // reinicia a animação
      contador.classList.add('pulou');
    }
  } catch {
    contador.hidden = true;
  }
}
