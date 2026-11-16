// Gráficos do dashboard, desenhados pelo próprio código em SVG e HTML
// (o site não usa biblioteca de CDN nem bundler). As cores vêm do CSS
// (admin.css), então seguem a paleta de tema.css.
// Cada gráfico traz também uma tabela escondida com os mesmos números,
// lida pelos leitores de tela.
import { el } from '../../utils/html.js';
import { escalaDoEixo } from '../../utils/painel.js';
import { NOMES_STATUS } from '../../utils/constantes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, atributos = {}, ...filhos) {
  const elemento = document.createElementNS(SVG_NS, tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor !== null && valor !== undefined) elemento.setAttribute(nome, String(valor));
  }
  for (const filho of filhos.flat()) {
    if (filho !== null && filho !== undefined) elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return elemento;
}

function tabelaAcessivel(legenda, colunas, linhas) {
  return el('table', { class: 'visualmente-oculto' },
    el('caption', {}, legenda),
    el('thead', {}, el('tr', {}, colunas.map((c) => el('th', { scope: 'col' }, c)))),
    el('tbody', {}, linhas.map((linha) => el('tr', {}, linha.map((celula) => el('td', {}, celula)))))
  );
}

// ---------- colunas (faturamento por dia) ----------
const AREA = { altura: 240, esquerda: 64, direita: 8, topo: 12, base: 30 };
const ESPACO_POR_ROTULO_X = 64; // px: abaixo disso os rótulos dos dias se encostam

function eixoY({ topo, passo, y, largura, formatarEixo }) {
  const linhas = [];
  for (let valor = 0; valor <= topo + passo / 2; valor += passo) {
    linhas.push(svg('g', { class: 'eixo' },
      svg('line', { x1: AREA.esquerda, x2: largura - AREA.direita, y1: y(valor), y2: y(valor) }),
      svg('text', { x: AREA.esquerda - 10, y: y(valor), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, formatarEixo(valor))
    ));
  }
  return linhas;
}

// serie: [{ rotulo, rotuloCurto, valor }]; largura em px. aoDestacar(dado) é chamado ao
// passar o mouse numa coluna, para mostrar o valor do dia (quem usa
// teclado ou leitor de tela tem a tabela com todos os dias).
export function graficoColunas({ serie, largura, titulo, formatarValor, formatarEixo, aoDestacar }) {
  const alturaUtil = AREA.altura - AREA.topo - AREA.base;
  const larguraUtil = largura - AREA.esquerda - AREA.direita;
  const larguraColuna = larguraUtil / serie.length;
  const { topo, passo } = escalaDoEixo(Math.max(0, ...serie.map((d) => d.valor)));
  const y = (valor) => AREA.topo + alturaUtil - (valor / topo) * alturaUtil;
  const pularRotulos = Math.ceil(serie.length / Math.max(1, Math.floor(larguraUtil / ESPACO_POR_ROTULO_X)));

  const colunas = serie.map((dado, i) => {
    const x = AREA.esquerda + i * larguraColuna;
    const coluna = svg('g', { class: dado.valor > 0 ? 'coluna' : 'coluna vazia' },
      // área invisível da altura toda: facilita o mouse em colunas baixas
      svg('rect', { class: 'alvo', x, y: AREA.topo, width: larguraColuna, height: alturaUtil }),
      svg('rect', {
        class: 'barra',
        x: x + larguraColuna * 0.18,
        y: y(dado.valor),
        width: larguraColuna * 0.64,
        height: Math.max(AREA.topo + alturaUtil - y(dado.valor), dado.valor > 0 ? 2 : 0),
        rx: Math.min(3, larguraColuna * 0.15),
      }),
      i % pularRotulos === 0
        ? svg('text', { class: 'rotulo-x', x: x + larguraColuna / 2, y: AREA.altura - 8, 'text-anchor': 'middle' }, dado.rotuloCurto)
        : null
    );
    coluna.addEventListener('pointerenter', () => aoDestacar?.(dado));
    return coluna;
  });

  return el('figure', { class: 'grafico' },
    svg('svg', { viewBox: `0 0 ${largura} ${AREA.altura}`, class: 'grafico-colunas', 'aria-hidden': 'true' },
      eixoY({ topo, passo, y, largura, formatarEixo }),
      colunas
    ),
    tabelaAcessivel(titulo, ['Dia', 'Valor'], serie.map((d) => [d.rotulo, formatarValor(d.valor)]))
  );
}

// ---------- barras horizontais (vendas por categoria) ----------
// itens: [{ nome, valor }], já em ordem
export function barrasHorizontais({ itens, titulo, formatarValor }) {
  const maior = Math.max(0, ...itens.map((i) => i.valor));
  return el('figure', { class: 'grafico' },
    el('ul', { class: 'barras', 'aria-hidden': 'true' },
      itens.map((item) => {
        const barra = el('span', { class: 'barra' });
        barra.style.setProperty('--fatia', String(maior > 0 ? item.valor / maior : 0));
        return el('li', {},
          el('span', { class: 'nome' }, item.nome),
          el('span', { class: 'trilho' }, barra),
          el('span', { class: 'valor' }, formatarValor(item.valor))
        );
      })
    ),
    tabelaAcessivel(titulo, ['Categoria', 'Valor'], itens.map((i) => [i.nome, formatarValor(i.valor)]))
  );
}

// ---------- barra empilhada (pedidos por situação) ----------
// contagem: [{ status, total }] na ordem do ciclo de vida
export function barraDeStatus({ contagem, titulo }) {
  const total = contagem.reduce((soma, c) => soma + c.total, 0);
  const visiveis = contagem.filter((c) => c.total > 0);

  const barra = el('div', { class: 'barra-status', 'aria-hidden': 'true' },
    visiveis.map((c) => {
      const fatia = el('span', { class: `fatia fatia-${c.status}` });
      fatia.style.setProperty('--peso', String(c.total));
      return fatia;
    })
  );

  return el('figure', { class: 'grafico' },
    total > 0 ? barra : el('div', { class: 'barra-status vazia', 'aria-hidden': 'true' }),
    el('ul', { class: 'legenda-status' },
      contagem.map((c) => el('li', {},
        el('span', { class: `amostra fatia-${c.status}`, 'aria-hidden': 'true' }),
        el('span', {}, NOMES_STATUS[c.status]),
        el('strong', {}, String(c.total))
      ))
    ),
    el('figcaption', { class: 'visualmente-oculto' }, `${titulo}: ${total} pedidos no período`)
  );
}
