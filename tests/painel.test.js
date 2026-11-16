// Testes de unidade: contas do dashboard de vendas do administrador
import { describe, it, expect } from 'vitest';
import {
  intervaloDoPeriodo, separarPorPeriodo, resumirPedidos, variacaoPercentual, faturamentoPorDia,
  vendasPorCategoria, produtosMaisVendidos, contarPorStatus, escalaDoEixo, celulaCsv, relatorioCsv,
} from '../js/utils/painel.js';

// Monta um pedido no formato que o banco devolve
function pedido({ id = 1, data = '2026-11-10T14:00:00', status = 'PAGO', itens = [] } = {}) {
  const valor = itens.reduce((soma, i) => soma + i.quantidade * i.preco, 0);
  return {
    id, data, status, forma_pagamento: 'PIX', valor_total: valor.toFixed(2),
    pedido_itens: itens.map((i) => ({
      produto_id: i.produtoId, quantidade: i.quantidade, preco_unitario: String(i.preco),
      produtos: { nome: i.nome, imagem_url: null, categorias: { nome: i.categoria } },
    })),
  };
}

const caneta = { produtoId: 1, nome: 'Caneta', categoria: 'Escolar', preco: 19.9 };
const mouse = { produtoId: 2, nome: 'Mouse', categoria: 'Informática', preco: 89.9 };

describe('intervaloDoPeriodo', () => {
  it('começa à meia-noite de N-1 dias atrás e calcula o período anterior', () => {
    const { inicio, inicioAnterior } = intervaloDoPeriodo(7, new Date('2026-11-16T15:30:00'));
    expect(inicio).toEqual(new Date('2026-11-10T00:00:00'));
    expect(inicioAnterior).toEqual(new Date('2026-11-03T00:00:00'));
  });
});

describe('separarPorPeriodo', () => {
  it('divide os pedidos antes e depois do início do período', () => {
    const antigo = pedido({ id: 1, data: '2026-11-01T10:00:00' });
    const novo = pedido({ id: 2, data: '2026-11-12T10:00:00' });
    const { atuais, anteriores } = separarPorPeriodo([antigo, novo], new Date('2026-11-10T00:00:00'));
    expect(atuais.map((p) => p.id)).toEqual([2]);
    expect(anteriores.map((p) => p.id)).toEqual([1]);
  });
});

describe('resumirPedidos', () => {
  it('soma só os pedidos pagos, em centavos, e calcula o ticket médio', () => {
    const pedidos = [
      pedido({ itens: [{ ...caneta, quantidade: 3 }] }),            // 59,70
      pedido({ status: 'ENTREGUE', itens: [{ ...mouse, quantidade: 1 }] }), // 89,90
      pedido({ status: 'CANCELADO', itens: [{ ...mouse, quantidade: 5 }] }),
      pedido({ status: 'AGUARDANDO_PAGAMENTO', itens: [{ ...caneta, quantidade: 1 }] }),
    ];
    expect(resumirPedidos(pedidos)).toEqual({ pedidos: 2, faturamento: 149.6, ticketMedio: 74.8, itens: 4 });
  });

  it('sem pedidos, tudo zero (sem divisão por zero)', () => {
    expect(resumirPedidos([])).toEqual({ pedidos: 0, faturamento: 0, ticketMedio: 0, itens: 0 });
  });
});

describe('variacaoPercentual', () => {
  it('compara com o período anterior', () => {
    expect(variacaoPercentual(150, 100)).toBe(50);
    expect(variacaoPercentual(80, 100)).toBe(-20);
  });

  it('devolve null quando não há base para comparar', () => {
    expect(variacaoPercentual(100, 0)).toBeNull();
  });
});

describe('faturamentoPorDia', () => {
  it('preenche os dias sem venda com zero e soma os do mesmo dia', () => {
    const pedidos = [
      pedido({ data: '2026-11-10T09:00:00', itens: [{ ...caneta, quantidade: 1 }] }),
      pedido({ data: '2026-11-10T21:00:00', itens: [{ ...caneta, quantidade: 1 }] }),
      pedido({ data: '2026-11-12T12:00:00', itens: [{ ...mouse, quantidade: 1 }] }),
      pedido({ data: '2026-11-11T12:00:00', status: 'CANCELADO', itens: [{ ...mouse, quantidade: 1 }] }),
    ];
    const serie = faturamentoPorDia(pedidos, new Date('2026-11-10T00:00:00'), 3);
    expect(serie.map((d) => d.valor)).toEqual([39.8, 0, 89.9]);
    expect(serie[2].data).toEqual(new Date('2026-11-12T00:00:00'));
  });

  it('ignora pedidos fora do período', () => {
    const fora = pedido({ data: '2026-11-01T10:00:00', itens: [{ ...caneta, quantidade: 1 }] });
    expect(faturamentoPorDia([fora], new Date('2026-11-10T00:00:00'), 2).map((d) => d.valor)).toEqual([0, 0]);
  });
});

describe('vendasPorCategoria e produtosMaisVendidos', () => {
  const pedidos = [
    pedido({ itens: [{ ...caneta, quantidade: 4 }, { ...mouse, quantidade: 1 }] }),
    pedido({ itens: [{ ...caneta, quantidade: 2 }] }),
    pedido({ status: 'CANCELADO', itens: [{ ...mouse, quantidade: 9 }] }),
  ];

  it('agrupa o valor vendido por categoria, do maior para o menor', () => {
    expect(vendasPorCategoria(pedidos)).toEqual([
      { nome: 'Escolar', quantidade: 6, valor: 119.4 },
      { nome: 'Informática', quantidade: 1, valor: 89.9 },
    ]);
  });

  it('ordena os produtos pela quantidade vendida e respeita o limite', () => {
    const ranking = produtosMaisVendidos(pedidos, 1);
    expect(ranking).toEqual([{ id: 1, nome: 'Caneta', imagem_url: null, quantidade: 6, valor: 119.4 }]);
  });
});

describe('contarPorStatus', () => {
  it('conta cada situação na ordem do ciclo de vida, inclusive as zeradas', () => {
    const contagem = contarPorStatus([pedido({ status: 'PAGO' }), pedido({ status: 'PAGO' }), pedido({ status: 'CANCELADO' })]);
    expect(contagem).toEqual([
      { status: 'AGUARDANDO_PAGAMENTO', total: 0 },
      { status: 'PAGO', total: 2 },
      { status: 'ENVIADO', total: 0 },
      { status: 'ENTREGUE', total: 0 },
      { status: 'CANCELADO', total: 1 },
    ]);
  });
});

describe('escalaDoEixo', () => {
  it('arredonda o topo do eixo para um valor fácil de ler', () => {
    expect(escalaDoEixo(870)).toEqual({ topo: 1000, passo: 250 });
    expect(escalaDoEixo(37)).toEqual({ topo: 40, passo: 10 });
    expect(escalaDoEixo(3)).toEqual({ topo: 4, passo: 1 });
  });

  it('sem vendas, usa uma escala mínima para o gráfico não quebrar', () => {
    expect(escalaDoEixo(0)).toEqual({ topo: 4, passo: 1 });
  });
});

describe('relatório CSV', () => {
  it('neutraliza células que o Excel executaria como fórmula', () => {
    expect(celulaCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celulaCsv('-10')).toBe("'-10");
    expect(celulaCsv('texto; com separador')).toBe('"texto; com separador"');
  });

  it('gera uma linha por pedido com separador ; e vírgula decimal', () => {
    const csv = relatorioCsv([pedido({ id: 42, status: 'ENVIADO', itens: [{ ...caneta, quantidade: 2 }] })]);
    const [cabecalho, linha] = csv.split('\r\n');
    expect(cabecalho).toBe('Pedido;Data;Situação;Pagamento;Itens;Total (R$)');
    expect(linha).toMatch(/^42;.+;Enviado;Pix;2;39,80$/);
  });
});
