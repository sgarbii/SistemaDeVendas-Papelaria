// Pedaços de tela usados em várias páginas: ícones, cartão de produto,
// estrelas, selo de compra segura, estados de carregamento/erro e avisos.
import { el, trocarConteudo } from '../utils/html.js';
import { formatarPreco, formatarNota } from '../utils/formatacao.js';
import { urlImagem } from '../services/produtos.js';
import { NOMES_STATUS } from '../utils/constantes.js';

// ---------- ícones ----------
// Desenhos fixos escritos no próprio código (nunca vêm do usuário),
// por isso podem ser montados a partir de texto SVG.
const ICONES = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  carrinho: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cadeado: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.3"/>',
  lixeira: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9.5"/>',
  alerta: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17.5v.01"/>',
  erro: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  sacola: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  lapis: '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1Z"/><path d="m14 7 3 3"/>',
  caixa: '<path d="M3 8l9-5 9 5v8l-9 5-9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  estrela: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z"/>',
};

// Único uso de innerHTML no site: só com os desenhos FIXOS acima (nenhum
// dado do usuário, do banco ou do ViaCEP passa por aqui).
export function icone(nome) {
  const molde = document.createElement('template');
  molde.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONES[nome] ?? ''}</svg>`;
  const svg = molde.content.firstElementChild;
  svg.setAttribute('class', 'icone');
  return svg;
}

// Logotipo: lápis + nome da loja
export function logotipo() {
  const molde = document.createElement('template');
  molde.innerHTML = `<svg class="logo-marca" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <rect x="18" y="4" width="12" height="30" rx="2" fill="#ffe066" stroke="currentColor" stroke-width="2.5"/>
    <rect x="18" y="4" width="12" height="7" rx="2" fill="#f28da0" stroke="currentColor" stroke-width="2.5"/>
    <path d="M18 34h12l-6 10z" fill="#f1d1a3" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M22 40.5h4L24 44z" fill="currentColor"/>
  </svg>`;
  return el('a', { class: 'logo', href: '/index.html', 'aria-label': 'Papelaria Online, página inicial' },
    molde.content.firstElementChild,
    el('span', {}, 'Papelaria ', el('span', { class: 'grifo' }, 'Online'))
  );
}

// ---------- imagem com imagem padrão (Cenário 03, FE02) ----------
export function imagemProduto(produto, atributos = {}) {
  const imagem = el('img', {
    src: urlImagem(produto),
    alt: produto?.nome ?? '',
    loading: 'lazy',
    width: 400,
    height: 400,
    ...atributos,
  });
  imagem.addEventListener('error', () => {
    if (!imagem.src.endsWith('/img/sem-imagem.svg')) imagem.src = '/img/sem-imagem.svg';
  }, { once: false });
  return imagem;
}

// ---------- estrelas (só leitura) ----------
export function estrelas(nota) {
  const elemento = el('span', {
    class: 'estrelas',
    role: 'img',
    'aria-label': `Nota ${formatarNota(nota)} de 5`,
  });
  elemento.style.setProperty('--nota', String(Number(nota) || 0));
  return elemento;
}

// ---------- ilustrações (estados vazios, confirmação, login) ----------
// Desenhos decorativos: o texto ao lado já diz o que a tela mostra, por isso alt="".
export function ilustracao(nome, classe = 'ilustracao') {
  return el('img', { class: classe, src: `/img/ilustracoes/${nome}.webp`, alt: '', width: 800, height: 800, loading: 'lazy' });
}

// ---------- cartão de produto da vitrine ----------
export function cartaoProduto(produto) {
  return el('li', {}, el('a', { class: 'cartao-produto', href: `/produto.html?id=${Number(produto.id)}` },
    imagemProduto(produto),
    el('div', { class: 'cartao-corpo' },
      el('span', { class: 'cartao-categoria' }, produto.categorias?.nome ?? ''),
      el('h3', { class: 'cartao-nome' }, produto.nome),
      Number(produto.nota_media) > 0
        ? el('span', { class: 'linha-nota' }, estrelas(produto.nota_media), formatarNota(produto.nota_media))
        : el('span', { class: 'linha-nota' }, 'Sem avaliações ainda'),
      produto.estoque === 0 ? el('span', { class: 'cartao-esgotado' }, 'Indisponível') : null,
      el('span', { class: 'cartao-preco' }, formatarPreco(produto.preco))
    )
  ));
}

// ---------- selo de compra segura (RNF04) ----------
export function seloCompraSegura() {
  return el('div', { class: 'selo-seguro' },
    el('img', { src: '/img/icones/compra-segura.webp', alt: '', width: 512, height: 512, loading: 'lazy' }),
    el('span', {},
      el('strong', {}, 'Compra segura'),
      el('small', {}, 'Conexão HTTPS e dados protegidos (LGPD)')
    )
  );
}

export function seloStatus(status) {
  return el('span', { class: `status status-${status}` }, NOMES_STATUS[status] ?? status);
}

// ---------- estados das telas ----------
export function mostrarCarregando(container, texto = 'Carregando…') {
  trocarConteudo(container,
    el('div', { class: 'estado', role: 'status' }, el('div', { class: 'rodinha' }), el('p', {}, texto))
  );
}

// FE02: erro (por exemplo, falha de conexão) com botão para tentar de novo
export function mostrarErro(container, mensagem, aoTentarDeNovo) {
  trocarConteudo(container,
    el('div', { class: 'estado estado-erro', role: 'alert' },
      icone('erro'),
      el('h2', {}, 'Ops, algo deu errado'),
      el('p', {}, mensagem),
      aoTentarDeNovo
        ? el('button', { class: 'botao', type: 'button', onclick: aoTentarDeNovo }, 'Tentar de novo')
        : null
    )
  );
}

// Tela vazia: com ilustracao (nome do arquivo em img/ilustracoes/) ou com um ícone
export function mostrarVazio(container, { titulo, texto, ilustracao: nomeIlustracao, nomeIcone = 'sacola', extras = [] }) {
  trocarConteudo(container,
    el('div', { class: 'estado' },
      nomeIlustracao ? ilustracao(nomeIlustracao, 'ilustracao-estado') : icone(nomeIcone),
      el('h2', {}, titulo),
      texto ? el('p', {}, texto) : null,
      ...extras
    )
  );
}

// ---------- avisos rápidos (toasts) ----------
export function avisar(mensagem, tipo = 'sucesso') {
  let area = document.getElementById('avisos');
  if (!area) {
    area = el('div', { id: 'avisos', class: 'avisos', 'aria-live': 'polite' });
    document.body.append(area);
  }
  const nomeIcone = { sucesso: 'ok', alerta: 'alerta', erro: 'erro' }[tipo] ?? 'ok';
  const aviso = el('div', { class: `aviso ${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' }, icone(nomeIcone), el('span', {}, mensagem));
  area.append(aviso);
  setTimeout(() => {
    aviso.classList.add('saindo');
    setTimeout(() => aviso.remove(), 350);
  }, tipo === 'erro' ? 6000 : 3500);
}

// ---------- janelas (<dialog>) ----------
// Mostra a janela e devolve a função fechar(), que fecha, tira da página
// e chama aoFechar. A tecla Esc também passa por ela (evento "close").
export function abrirJanela(janela, aoFechar) {
  let fechada = false;
  function fechar() {
    if (fechada) return;
    fechada = true;
    if (janela.open) janela.close();
    janela.remove();
    aoFechar?.();
  }
  janela.addEventListener('close', fechar);
  document.body.append(janela);
  janela.showModal();
  return fechar;
}

// ---------- campos de formulário ----------
export function marcarErro(input, mensagem) {
  const campo = input.closest('.campo');
  campo.classList.add('invalido');
  input.setAttribute('aria-invalid', 'true');
  let texto = campo.querySelector('.mensagem-erro');
  if (!texto) {
    texto = el('span', { class: 'mensagem-erro', id: `${input.id}-erro` });
    campo.append(texto);
    input.setAttribute('aria-describedby', texto.id);
  }
  texto.textContent = mensagem;
}

export function limparErro(input) {
  const campo = input.closest('.campo');
  campo.classList.remove('invalido');
  input.removeAttribute('aria-invalid');
  campo.querySelector('.mensagem-erro')?.remove();
}

// Seletor de quantidade [-] n [+]
export function seletorQuantidade({ valor = 1, minimo = 1, maximo = 99, rotulo = 'Quantidade', aoMudar }) {
  const entrada = el('input', {
    type: 'number', inputmode: 'numeric', min: minimo, max: maximo, value: valor, 'aria-label': rotulo,
  });
  const menos = el('button', { type: 'button', 'aria-label': 'Diminuir quantidade' }, '−');
  const mais = el('button', { type: 'button', 'aria-label': 'Aumentar quantidade' }, '+');

  function ajustar(novo) {
    const numero = Math.min(Math.max(parseInt(novo, 10) || minimo, minimo), maximo);
    entrada.value = numero;
    menos.disabled = numero <= minimo;
    mais.disabled = numero >= maximo;
    return numero;
  }
  function mudar(novo) {
    const numero = ajustar(novo);
    if (aoMudar) aoMudar(numero);
  }
  menos.addEventListener('click', () => mudar(Number(entrada.value) - 1));
  mais.addEventListener('click', () => mudar(Number(entrada.value) + 1));
  entrada.addEventListener('change', () => mudar(entrada.value));
  ajustar(valor);

  const caixa = el('div', { class: 'quantidade' }, menos, entrada, mais);
  caixa.valor = () => ajustar(entrada.value);
  return caixa;
}
