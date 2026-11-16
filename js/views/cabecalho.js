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
  const menu = menuDeCategorias();
  const areaConta = el('div', { class: 'conta' });

  trocarConteudo(document.getElementById('cabecalho'),
    el('div', { class: 'container' },
      el('div', { class: 'cabecalho-logo' }, logotipo()),
      el('div', { class: 'cabecalho-barra' },
        menu.botao,
        formularioDeBusca(),
        el('div', { class: 'cabecalho-acoes' }, linkDoCarrinho(), areaConta)
      ),
      menu.painel
    )
  );
  trocarConteudo(document.getElementById('rodape'), conteudoDoRodape());

  const sessao = await obterSessao();
  await montarConta(areaConta, sessao);
  atualizarContador();

  // RNF04: contador atualizado assim que o carrinho muda
  window.addEventListener('carrinho-mudou', atualizarContador);
  aoMudarSessao(() => atualizarContador());

  return { sessao };
}

// Menu de categorias à esquerda da busca; fecha ao clicar fora ou com Esc
function menuDeCategorias() {
  const painel = el('nav', { id: 'painel-categorias', class: 'painel-categorias', 'aria-label': 'Categorias', hidden: true });
  const botao = el('button', {
    class: 'botao-icone botao-categorias',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'painel-categorias',
    'aria-label': 'Abrir menu de categorias',
  }, icone('menu'), el('span', { class: 'rotulo' }, 'Categorias'));

  function mostrar(aberto) {
    painel.hidden = !aberto;
    botao.setAttribute('aria-expanded', String(aberto));
    if (aberto) carregarCategorias(painel);
  }
  botao.addEventListener('click', () => mostrar(painel.hidden));
  document.addEventListener('click', (evento) => {
    if (!painel.hidden && !painel.contains(evento.target) && !botao.contains(evento.target)) mostrar(false);
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !painel.hidden) {
      mostrar(false);
      botao.focus();
    }
  });
  return { botao, painel };
}

function formularioDeBusca() {
  const campoBusca = el('input', {
    type: 'search',
    name: 'busca',
    id: 'campo-busca',
    placeholder: 'Buscar canetas, cadernos, impressoras…',
    'aria-label': 'Buscar produtos',
    autocomplete: 'off',
    maxlength: 100,
  });
  campoBusca.value = new URLSearchParams(location.search).get('busca') ?? ''; // value é texto puro, nunca HTML

  const form = el('form', { class: 'busca', role: 'search', action: '/index.html', method: 'get' },
    campoBusca,
    el('button', { type: 'submit', 'aria-label': 'Buscar' }, icone('busca'))
  );
  // Cenário 03, FE01: busca só com espaços é ignorada (mantém a lista atual)
  form.addEventListener('submit', (evento) => {
    if (!termoDeBuscaValido(campoBusca.value)) {
      evento.preventDefault();
      campoBusca.value = '';
    }
  });
  return form;
}

function linkDoCarrinho() {
  contador = el('span', { class: 'contador', 'aria-live': 'polite', hidden: true });
  return el('a', { class: 'botao-icone link-carrinho', href: '/carrinho.html', 'aria-label': 'Carrinho' },
    icone('carrinho'), contador);
}

function conteudoDoRodape() {
  return el('div', { class: 'container rodape-grade' },
    el('div', { class: 'rodape-marca' },
      logotipo(),
      el('p', {}, 'Material escolar, de escritório, arte e informática, vendido só pela internet.')
    ),
    el('nav', { class: 'rodape-links', 'aria-label': 'Sua conta' },
      el('a', { href: '/pedidos.html' }, 'Meus pedidos'),
      el('a', { href: '/perfil.html' }, 'Meu perfil'),
      el('a', { href: '/carrinho.html' }, 'Carrinho')
    ),
    seloCompraSegura(),
    el('p', { class: 'rodape-nota' }, 'Projeto final de ECOT11A, UNIFEI. Pagamento simulado: nenhuma cobrança real é feita.')
  );
}

async function montarConta(area, sessao) {
  if (!sessao) {
    trocarConteudo(area, linkDeEntrar());
    return;
  }
  let perfil = null;
  try {
    perfil = await obterPerfil();
  } catch {
    // sem perfil o menu ainda funciona; só não mostra o nome
  }
  const primeiroNome = (perfil?.nome ?? 'cliente').split(' ')[0];
  const menu = menuDaConta(primeiroNome, perfil?.papel === 'admin');
  const botao = el('button', {
    class: 'botao-icone',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'menu-conta',
    'aria-label': `Conta de ${primeiroNome}`,
  }, icone('usuario'), el('span', { class: 'rotulo' }, primeiroNome));

  function mostrar(aberto) {
    menu.hidden = !aberto;
    botao.setAttribute('aria-expanded', String(aberto));
  }
  botao.addEventListener('click', () => mostrar(menu.hidden));
  document.addEventListener('click', (evento) => {
    if (!menu.hidden && !area.contains(evento.target)) mostrar(false);
  });
  trocarConteudo(area, botao, menu);
}

// RU08: visitante navega sem login; o link leva ao login e volta para cá
function linkDeEntrar() {
  const voltar = encodeURIComponent(location.pathname + location.search);
  const destino = location.pathname === '/login.html' ? '/login.html' : `/login.html?voltar=${voltar}`;
  return el('a', { class: 'botao-icone', href: destino, 'aria-label': 'Entrar ou criar conta' },
    icone('usuario'), el('span', { class: 'rotulo' }, 'Entrar'));
}

function menuDaConta(primeiroNome, ehAdmin) {
  return el('ul', { class: 'menu-conta', id: 'menu-conta', hidden: true },
    el('li', { class: 'saudacao' }, `Olá, ${primeiroNome}`),
    el('li', {}, el('a', { href: '/pedidos.html' }, 'Meus pedidos')),
    el('li', {}, el('a', { href: '/perfil.html' }, 'Meu perfil')),
    // só visual: quem protege o painel é o RLS do banco
    ehAdmin ? el('li', {}, el('a', { href: '/admin/index.html' }, 'Painel do administrador')) : null,
    el('li', {}, el('button', {
      type: 'button',
      onclick: async () => {
        await sair();
        location.href = '/index.html';
      },
    }, 'Sair'))
  );
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
