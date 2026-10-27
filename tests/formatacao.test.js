// Testes de unidade: formatação de preço e de CEP
import { describe, it, expect } from 'vitest';
import {
  formatarPreco, formatarCep, formatarTelefone, formatarTempo, formatarNota,
  prepararTermoBusca, escaparCuringasLike,
} from '../js/utils/formatacao.js';

// O Intl usa um espaço especial (não separável) entre "R$" e o número.
// Trocamos por espaço comum para comparar.
const semEspacoEspecial = (texto) => texto.replace(/\s/g, ' ');

describe('formatarPreco', () => {
  it('formata em reais com vírgula', () => {
    expect(semEspacoEspecial(formatarPreco(19.9))).toBe('R$ 19,90');
  });

  it('usa ponto nos milhares', () => {
    expect(semEspacoEspecial(formatarPreco(3615.9))).toBe('R$ 3.615,90');
  });

  it('aceita texto vindo do banco e valores vazios', () => {
    expect(semEspacoEspecial(formatarPreco('899.00'))).toBe('R$ 899,00');
    expect(semEspacoEspecial(formatarPreco(null))).toBe('R$ 0,00');
  });
});

describe('formatarCep', () => {
  it('coloca o hífen', () => {
    expect(formatarCep('37500903')).toBe('37500-903');
  });

  it('aceita CEP já formatado ou com letras e espaços', () => {
    expect(formatarCep('37500-903')).toBe('37500-903');
    expect(formatarCep(' 37.500 903 ')).toBe('37500-903');
  });

  it('formata enquanto o usuário digita', () => {
    expect(formatarCep('375')).toBe('375');
    expect(formatarCep('375009')).toBe('37500-9');
  });

  it('corta o que passar de 8 dígitos', () => {
    expect(formatarCep('375009031234')).toBe('37500-903');
  });
});

describe('formatarTelefone', () => {
  it('celular com 11 dígitos', () => {
    expect(formatarTelefone('35999998888')).toBe('(35) 99999-8888');
  });

  it('fixo com 10 dígitos', () => {
    expect(formatarTelefone('3536291000')).toBe('(35) 3629-1000');
  });
});

describe('formatarTempo (tempo da reserva, RN02)', () => {
  it('mostra minutos e segundos', () => {
    expect(formatarTempo(15 * 60 * 1000)).toBe('15:00');
    expect(formatarTempo(65 * 1000)).toBe('01:05');
  });

  it('nunca mostra tempo negativo', () => {
    expect(formatarTempo(-5000)).toBe('00:00');
  });
});

describe('formatarNota', () => {
  it('uma casa decimal com vírgula', () => {
    expect(formatarNota(4.5)).toBe('4,5');
    expect(formatarNota(4)).toBe('4,0');
  });
});

describe('prepararTermoBusca (RNF10)', () => {
  it('tira espaços sobrando', () => {
    expect(prepararTermoBusca('  caneta   azul ')).toBe('caneta azul');
  });

  it('limita a 100 caracteres', () => {
    expect(prepararTermoBusca('a'.repeat(250))).toHaveLength(100);
  });

  it('o texto do CT12 continua sendo só texto', () => {
    expect(prepararTermoBusca('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
  });
});

describe('escaparCuringasLike (busca com ilike)', () => {
  it('escapa % e _ para valerem como letras comuns', () => {
    expect(escaparCuringasLike('100%')).toBe('100\\%');
    expect(escaparCuringasLike('a_b')).toBe('a\\_b');
  });

  it('escapa a própria barra', () => {
    expect(escaparCuringasLike('a\\b')).toBe('a\\\\b');
  });

  it('texto comum não muda', () => {
    expect(escaparCuringasLike('caderno')).toBe('caderno');
  });
});
