// Testes de caracterização: tradução dos erros do Supabase para mensagens
// em português (o texto bruto do banco nunca chega ao usuário).
import { describe, it, expect } from 'vitest';
import { traduzirErro, mensagemDeErro, ErroDoSistema } from '../js/services/supabase.js';

const traduzir = (erro) => traduzirErro(erro);

describe('traduzirErro', () => {
  it('falha de rede vira mensagem de conexão (FE02)', () => {
    const erro = traduzir({ message: 'TypeError: Failed to fetch' });
    expect(erro.message).toMatch(/Não foi possível conectar/);
    expect(erro.codigo).toBe('rede');
  });

  it.each(['28000', 'PGRST301', 'PGRST303'])('código %s pede login de novo (RNF02)', (codigo) => {
    const erro = traduzir({ code: codigo, message: 'x' });
    expect(erro.semSessao).toBe(true);
    expect(erro.message).toMatch(/sessão expirou/);
  });

  it('JWT vencido pela mensagem também pede login', () => {
    expect(traduzir({ message: 'JWT expired' }).semSessao).toBe(true);
  });

  it('mensagens das nossas funções (P0001) passam como estão', () => {
    expect(traduzir({ code: 'P0001', message: 'Produto indisponível.' }).message).toBe('Produto indisponível.');
  });

  it('permissão negada (42501) não revela detalhes, exceto a regra de avaliação', () => {
    expect(traduzir({ code: '42501', message: 'new row violates row-level security policy for table "produtos"' }).message)
      .toBe('Você não tem permissão para fazer isso.');
    expect(traduzir({ code: '42501', message: 'Só é possível avaliar produtos de pedidos pagos.' }).message)
      .toBe('Só é possível avaliar produtos de pedidos pagos.');
  });

  it.each([
    ['23505', 'Este registro já existe.'],
    ['23503', 'Não é possível excluir: existem outros registros ligados a este.'],
    ['23514', 'Algum valor informado não é válido. Confira os campos.'],
    ['22001', 'Algum valor informado não é válido. Confira os campos.'],
    ['22P02', 'Algum valor informado não é válido. Confira os campos.'],
  ])('código %s tem mensagem própria', (codigo, mensagem) => {
    expect(traduzir({ code: codigo, message: 'detalhe interno do banco' }).message).toBe(mensagem);
  });

  it('erro desconhecido vira a mensagem genérica, sem o texto do banco', () => {
    const erro = traduzir({ code: 'XX000', message: 'relation "perfis" does not exist' });
    expect(erro.message).toBe('Algo deu errado. Tente de novo em instantes.');
  });
});

describe('mensagemDeErro', () => {
  it('só mostra mensagens nossas; o resto vira a genérica', () => {
    expect(mensagemDeErro(new ErroDoSistema('Texto amigável'))).toBe('Texto amigável');
    expect(mensagemDeErro(new Error('stack interno'))).toBe('Algo deu errado. Tente de novo em instantes.');
  });
});
