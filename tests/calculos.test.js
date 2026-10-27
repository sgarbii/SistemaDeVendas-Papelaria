// Testes de unidade: subtotal e total do carrinho (RF01) e prazos (RN01, RN02)
import { describe, it, expect } from 'vitest';
import {
  calcularSubtotal, calcularTotal, contarUnidades,
  tempoRestanteReserva, reservaExpirou, podeEditarAvaliacao, ordenarPorPopularidade,
} from '../js/utils/calculos.js';

describe('calcularSubtotal (ItemCarrinho.calcularSubtotal)', () => {
  it('multiplica preço pela quantidade', () => {
    expect(calcularSubtotal(19.9, 3)).toBe(59.7);
  });

  it('não tem erro de arredondamento com centavos', () => {
    expect(calcularSubtotal(0.1, 3)).toBe(0.3); // 0.1 * 3 em JS daria 0.30000000000000004
  });

  it('aceita o preço como texto (o Postgres devolve numeric assim às vezes)', () => {
    expect(calcularSubtotal('899.00', 2)).toBe(1798);
  });
});

describe('calcularTotal (Carrinho.calcularTotal)', () => {
  it('soma os subtotais', () => {
    const itens = [
      { preco: 19.9, quantidade: 5 },
      { preco: 49.9, quantidade: 1 },
    ];
    expect(calcularTotal(itens)).toBe(149.4);
  });

  it('carrinho vazio tem total zero', () => {
    expect(calcularTotal([])).toBe(0);
  });

  it('soma vários centavos sem erro', () => {
    const itens = [
      { preco: 0.1, quantidade: 1 },
      { preco: 0.2, quantidade: 1 },
    ];
    expect(calcularTotal(itens)).toBe(0.3);
  });
});

describe('contarUnidades (contador do cabeçalho, RNF04)', () => {
  it('soma as quantidades dos itens', () => {
    expect(contarUnidades([{ quantidade: 2 }, { quantidade: 3 }])).toBe(5);
  });
});

describe('reserva de 15 minutos (RN02)', () => {
  const agora = new Date('2026-10-26T12:00:00Z').getTime();

  it('calcula o tempo restante', () => {
    expect(tempoRestanteReserva('2026-10-26T12:10:00Z', agora)).toBe(10 * 60 * 1000);
  });

  it('reserva vencida ou sem reserva tem tempo zero', () => {
    expect(tempoRestanteReserva('2026-10-26T11:59:00Z', agora)).toBe(0);
    expect(tempoRestanteReserva(null, agora)).toBe(0);
  });

  it('reservaExpirou diz se o prazo passou', () => {
    expect(reservaExpirou('2026-10-26T12:00:01Z', agora)).toBe(false);
    expect(reservaExpirou('2026-10-26T11:45:00Z', agora)).toBe(true);
    expect(reservaExpirou(null, agora)).toBe(true);
  });
});

describe('ordenarPorPopularidade (Cenário 03)', () => {
  it('mais vendidos primeiro e, no empate, mais bem avaliados', () => {
    const lista = [
      { id: 1, total_vendido: 10, nota_media: '4.0' },
      { id: 2, total_vendido: 50, nota_media: '3.0' },
      { id: 3, total_vendido: 10, nota_media: '4.8' },
    ];
    expect(ordenarPorPopularidade(lista).map((p) => p.id)).toEqual([2, 3, 1]);
  });
});

describe('podeEditarAvaliacao (RN01, Avaliacao.podeEditar)', () => {
  const agora = new Date('2026-10-26T12:00:00Z').getTime();

  it('permite editar dentro de 7 dias', () => {
    expect(podeEditarAvaliacao('2026-10-20T12:00:00Z', agora)).toBe(true);
  });

  it('não permite depois de 7 dias (CT09: publicada há 8 dias)', () => {
    expect(podeEditarAvaliacao('2026-10-18T12:00:00Z', agora)).toBe(false);
  });
});
