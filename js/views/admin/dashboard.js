// Dashboard de vendas do administrador (nível avançado do MVP):
// indicadores do período com comparação, gráficos, mais vendidos,
// estoque baixo, pedidos chegando em tempo real e relatório em CSV.
import { mensagemDeErro } from '../../services/supabase.js';
import { el, trocarConteudo } from '../../utils/html.js';
import { formatarPreco, formatarPrecoCurto, formatarDiaMes, formatarDataHora } from '../../utils/formatacao.js';
import {
  intervaloDoPeriodo, separarPorPeriodo, resumirPedidos, variacaoPercentual, faturamentoPorDia,
  vendasPorCategoria, produtosMaisVendidos, contarPorStatus, inicioDoDia, relatorioCsv,
} from '../../utils/painel.js';
import { imagemProduto, seloStatus, mostrarCarregando, mostrarErro, avisar } from '../componentes.js';
import { graficoColunas, barrasHorizontais, barraDeStatus } from './graficos.js';
import { montarPainel } from './painel.js';
import {
  listarPedidosDesde, listarEstoqueBaixo, acompanharPedidos, LIMITE_ESTOQUE_BAIXO,
} from '../../services/admin.js';

const PERIODOS = [7, 30, 90];
const ESPERA_ANTES_DE_RECARREGAR_MS = 800;
const ULTIMOS_PEDIDOS = 6;

const conteudo = document.getElementById('conteudo');
const estado = { periodo: 30, pedidos: [], estoqueBaixo: [] };
const areaDados = el('div', { class: 'area-dados', 'aria-live': 'polite', 'aria-busy': 'false' });
const indicadorAoVivo = el('span', { class: 'ao-vivo conectando' }, 'Conectando…');

if (await montarPainel('index.html')) {
  trocarConteudo(conteudo, barraDoTopo(), areaDados);
  carregar();
  acompanharPedidos({ aoMudar: aoMudarPedido, aoMudarConexao: mostrarConexao });
}

// ---------- topo: título, período, relatório e "ao vivo" ----------
function barraDoTopo() {
  const botoesPeriodo = PERIODOS.map((dias) => el('button', {
    type: 'button',
    'aria-pressed': String(dias === estado.periodo),
    onclick: (evento) => trocarPeriodo(dias, botoesPeriodo, evento.currentTarget),
  }, `${dias} dias`));

  return el('div', { class: 'barra-titulo topo-dashboard' },
    el('div', {},
      el('h1', { class: 'titulo-pagina' }, 'Dashboard de vendas'),
      indicadorAoVivo
    ),
    el('div', { class: 'acoes-dashboard' },
      el('div', { class: 'seletor-periodo', role: 'group', 'aria-label': 'Período' }, botoesPeriodo),
      el('button', { class: 'botao', type: 'button', onclick: baixarRelatorio }, 'Baixar relatório (CSV)')
    )
  );
}

function trocarPeriodo(dias, botoes, escolhido) {
  estado.periodo = dias;
  botoes.forEach((botao) => botao.setAttribute('aria-pressed', String(botao === escolhido)));
  carregar();
}

function mostrarConexao(conectado) {
  indicadorAoVivo.className = conectado ? 'ao-vivo' : 'ao-vivo desligado';
  indicadorAoVivo.textContent = conectado ? 'Ao vivo: novos pedidos aparecem sozinhos' : 'Atualização automática indisponível';
}

// ---------- dados ----------
async function carregar({ semAviso = false } = {}) {
  if (!semAviso) mostrarCarregando(areaDados, 'Calculando as vendas…');
  areaDados.setAttribute('aria-busy', 'true');
  try {
    // busca também o período anterior, para a comparação dos indicadores
    const { inicioAnterior } = intervaloDoPeriodo(estado.periodo);
    [estado.pedidos, estado.estoqueBaixo] = await Promise.all([
      listarPedidosDesde(inicioAnterior), listarEstoqueBaixo(),
    ]);
    desenhar();
  } catch (erro) {
    mostrarErro(areaDados, mensagemDeErro(erro), () => carregar());
  } finally {
    areaDados.setAttribute('aria-busy', 'false');
  }
}

// Realtime: um pedido novo gera um aviso; qualquer mudança recarrega
// os números (com uma pequena espera, para juntar eventos seguidos).
let recarga = null;
function aoMudarPedido(evento) {
  if (evento.eventType === 'INSERT') {
    avisar(`Novo pedido nº ${evento.new.id}: ${formatarPreco(evento.new.valor_total)}`);
  }
  clearTimeout(recarga);
  recarga = setTimeout(() => carregar({ semAviso: true }), ESPERA_ANTES_DE_RECARREGAR_MS);
}

function pedidosDoPeriodo() {
  const { inicio } = intervaloDoPeriodo(estado.periodo);
  return { inicio, ...separarPorPeriodo(estado.pedidos, inicio) };
}

function desenhar() {
  const { inicio, atuais, anteriores } = pedidosDoPeriodo();
  trocarConteudo(areaDados,
    faixaDeHoje(atuais),
    indicadores(resumirPedidos(atuais), resumirPedidos(anteriores)),
    el('div', { class: 'grade-dashboard' },
      blocoFaturamento(atuais, inicio),
      blocoStatus(atuais),
      blocoCategorias(atuais),
      blocoMaisVendidos(atuais),
      blocoEstoqueBaixo(),
      blocoUltimosPedidos(atuais)
    )
  );
}

// ---------- indicadores ----------
function faixaDeHoje(pedidos) {
  const hoje = inicioDoDia(new Date());
  const deHoje = pedidos.filter((p) => new Date(p.data) >= hoje);
  const { faturamento } = resumirPedidos(deHoje);
  return el('p', { class: 'faixa-hoje' },
    el('strong', {}, 'Hoje: '),
    `${deHoje.length} ${deHoje.length === 1 ? 'pedido' : 'pedidos'}, ${formatarPreco(faturamento)} faturados`
  );
}

function indicadores(atual, anterior) {
  const comparacao = `em relação aos ${estado.periodo} dias anteriores`;
  const cartao = (rotulo, valor, base, formatar, principal = false) =>
    el('div', { class: principal ? 'cartao-resumo principal' : 'cartao-resumo' },
      el('span', { class: 'rotulo' }, rotulo),
      el('span', { class: 'valor' }, formatar(valor)),
      textoVariacao(variacaoPercentual(valor, base), comparacao)
    );
  return el('div', { class: 'cartoes-resumo' },
    cartao('Faturamento', atual.faturamento, anterior.faturamento, formatarPreco, true),
    cartao('Pedidos pagos', atual.pedidos, anterior.pedidos, String),
    cartao('Ticket médio', atual.ticketMedio, anterior.ticketMedio, formatarPreco),
    cartao('Itens vendidos', atual.itens, anterior.itens, String)
  );
}

function textoVariacao(variacao, comparacao) {
  if (variacao === null) return el('span', { class: 'variacao' }, 'Sem vendas no período anterior');
  const sentido = variacao > 0 ? 'subiu' : variacao < 0 ? 'caiu' : 'igual';
  const texto = variacao === 0 ? 'Igual ao período anterior' : `${variacao > 0 ? '+' : '−'}${Math.abs(variacao)}% ${comparacao}`;
  return el('span', { class: `variacao ${sentido}` }, texto);
}

// ---------- blocos com gráficos e listas ----------
function bloco(titulo, classe, ...filhos) {
  return el('section', { class: `painel bloco-dashboard ${classe}` }, el('h2', {}, titulo), ...filhos);
}

function blocoFaturamento(pedidos, inicio) {
  const serie = faturamentoPorDia(pedidos, inicio, estado.periodo).map((dia) => ({
    rotulo: formatarDiaMes(dia.data), rotuloCurto: formatarDiaMes(dia.data), valor: dia.valor,
  }));
  const melhorDia = serie.reduce((melhor, dia) => (dia.valor > melhor.valor ? dia : melhor), serie[0]);
  const destaque = el('p', { class: 'destaque-grafico' });
  const mostrarDia = (dia, prefixo = '') => { destaque.textContent = `${prefixo}${dia.rotulo}: ${formatarPreco(dia.valor)}`; };
  mostrarDia(melhorDia, 'Melhor dia, ');

  return bloco('Faturamento por dia', 'bloco-largo',
    destaque,
    graficoColunas({
      serie,
      largura: larguraDosGraficos(),
      titulo: `Faturamento por dia nos últimos ${estado.periodo} dias`,
      formatarValor: formatarPreco,
      formatarEixo: formatarPrecoCurto,
      aoDestacar: (dia) => mostrarDia(dia),
    })
  );
}

// O SVG é desenhado na largura real da tela, para o texto dos eixos não
// encolher no celular (descontados o padding e a borda do bloco)
function larguraDosGraficos() {
  return Math.max(300, Math.min(areaDados.clientWidth, 800) - 44);
}

function blocoStatus(pedidos) {
  return bloco('Pedidos por situação', 'bloco-status',
    barraDeStatus({ contagem: contarPorStatus(pedidos), titulo: 'Pedidos por situação' }),
    el('a', { class: 'botao-texto', href: '/admin/pedidos.html' }, 'Gerenciar pedidos')
  );
}

function blocoCategorias(pedidos) {
  const categorias = vendasPorCategoria(pedidos);
  return bloco('Vendas por categoria', 'bloco-categorias',
    categorias.length === 0
      ? el('p', { class: 'dica' }, 'Nenhuma venda paga no período.')
      : barrasHorizontais({ itens: categorias, titulo: 'Vendas por categoria', formatarValor: formatarPreco })
  );
}

function blocoMaisVendidos(pedidos) {
  const ranking = produtosMaisVendidos(pedidos);
  return bloco('Mais vendidos', 'bloco-ranking',
    ranking.length === 0
      ? el('p', { class: 'dica' }, 'Nenhuma venda paga no período.')
      : el('ol', { class: 'ranking' },
          ranking.map((produto) => el('li', {},
            imagemProduto(produto, { alt: '', width: 48, height: 48 }),
            el('span', { class: 'nome' }, produto.nome),
            el('span', { class: 'numeros' },
              el('strong', {}, `${produto.quantidade} un.`),
              el('span', {}, formatarPreco(produto.valor)))
          ))
        )
  );
}

function blocoUltimosPedidos(pedidos) {
  const ultimos = pedidos.slice(0, ULTIMOS_PEDIDOS); // já vêm do mais novo para o mais antigo
  return bloco('Últimos pedidos', 'bloco-inteiro',
    ultimos.length === 0
      ? el('p', { class: 'dica' }, 'Nenhum pedido no período.')
      : el('ul', { class: 'lista-ultimos' },
          ultimos.map((p) => el('li', {},
            el('span', { class: 'numero-pedido' }, `Nº ${p.id}`),
            el('span', { class: 'quando' }, formatarDataHora(p.data)),
            seloStatus(p.status),
            el('strong', { class: 'total' }, formatarPreco(p.valor_total))
          ))
        )
  );
}

function blocoEstoqueBaixo() {
  const produtos = estado.estoqueBaixo;
  return bloco(`Estoque baixo (até ${LIMITE_ESTOQUE_BAIXO} unidades)`, 'bloco-estoque',
    produtos.length === 0
      ? el('p', { class: 'dica' }, 'Nenhum produto com estoque baixo.')
      : el('ul', { class: 'lista-estoque' },
          produtos.map((p) => el('li', {},
            el('a', { href: `/admin/produtos.html?editar=${Number(p.id)}` }, p.nome),
            el('span', { class: 'qtd' }, p.estoque === 0 ? 'Esgotado' : `${p.estoque} un.`)
          ))
        ),
    el('p', { class: 'dica' }, 'Já descontado o que está reservado em carrinhos.')
  );
}

// ---------- relatório ----------
function baixarRelatorio() {
  const { atuais } = pedidosDoPeriodo();
  // o BOM (﻿) faz o Excel abrir os acentos corretamente
  const arquivo = new Blob(['﻿', relatorioCsv(atuais)], { type: 'text/csv;charset=utf-8' });
  const endereco = URL.createObjectURL(arquivo);
  const hoje = new Date().toISOString().slice(0, 10);
  el('a', { href: endereco, download: `vendas-${estado.periodo}-dias-${hoje}.csv` }).click();
  setTimeout(() => URL.revokeObjectURL(endereco), 1000);
  avisar(`Relatório com ${atuais.length} ${atuais.length === 1 ? 'pedido' : 'pedidos'} baixado.`);
}
