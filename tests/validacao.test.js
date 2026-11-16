// Testes de unidade: validação de e-mail, senha e comentário (RF04, RNF13, RNF08)
import { describe, it, expect } from 'vitest';
import {
  validarEmail, validarSenha, validarComentario, validarNota, validarCep,
  validarTelefone, termoDeBuscaValido, destinoSeguro, imagemPermitida, validarProduto, SENHA_MINIMA,
} from '../js/utils/validacao.js';

describe('validarEmail', () => {
  it('aceita e-mails válidos', () => {
    expect(validarEmail('cliente@gmail.com')).toBe(true);
    expect(validarEmail('nome.sobrenome@unifei.edu.br')).toBe(true);
    expect(validarEmail('  com.espacos@exemplo.com  ')).toBe(true);
  });

  it('recusa e-mails inválidos', () => {
    expect(validarEmail('')).toBe(false);
    expect(validarEmail('semarroba.com')).toBe(false);
    expect(validarEmail('sem@dominio')).toBe(false);
    expect(validarEmail('com espaco@x.com')).toBe(false);
    expect(validarEmail(null)).toBe(false);
  });
});

describe('validarSenha (RNF13: mínimo de 8 caracteres)', () => {
  it('o mínimo é 8', () => {
    expect(SENHA_MINIMA).toBe(8);
  });

  it('aceita 8 ou mais caracteres', () => {
    expect(validarSenha('12345678')).toBe(true);
    expect(validarSenha('uma senha longa')).toBe(true);
  });

  it('recusa menos de 8 caracteres', () => {
    expect(validarSenha('1234567')).toBe(false);
    expect(validarSenha('')).toBe(false);
    expect(validarSenha(undefined)).toBe(false);
  });
});

describe('validarComentario (RNF08: comentário obrigatório)', () => {
  it('aceita comentário com texto', () => {
    expect(validarComentario('Gostei muito!')).toBe(true);
  });

  it('recusa comentário vazio ou só com espaços (CT08)', () => {
    expect(validarComentario('')).toBe(false);
    expect(validarComentario('    ')).toBe(false);
    expect(validarComentario('\n\t ')).toBe(false);
    expect(validarComentario(null)).toBe(false);
  });
});

describe('validarNota (1 a 5 estrelas)', () => {
  it('aceita de 1 a 5', () => {
    [1, 2, 3, 4, 5].forEach((n) => expect(validarNota(n)).toBe(true));
  });

  it('recusa fora da faixa ou não inteiro', () => {
    expect(validarNota(0)).toBe(false);
    expect(validarNota(6)).toBe(false);
    expect(validarNota(4.5)).toBe(false);
  });
});

describe('validarCep e validarTelefone', () => {
  it('CEP precisa de 8 dígitos, com ou sem hífen', () => {
    expect(validarCep('37500-903')).toBe(true);
    expect(validarCep('37500903')).toBe(true);
    expect(validarCep('3750090')).toBe(false);
  });

  it('telefone é opcional, mas se vier precisa de DDD', () => {
    expect(validarTelefone('')).toBe(true);
    expect(validarTelefone('(35) 99999-8888')).toBe(true);
    expect(validarTelefone('(35) 3629-1000')).toBe(true);
    expect(validarTelefone('99999')).toBe(false);
  });
});

describe('termoDeBuscaValido (Cenário 03, FE01)', () => {
  it('busca só com espaços é ignorada', () => {
    expect(termoDeBuscaValido('   ')).toBe(false);
    expect(termoDeBuscaValido('caneta')).toBe(true);
  });
});

describe('imagemPermitida (imagem_url)', () => {
  const projeto = 'https://abcdefghij.supabase.co';
  const storage = `${projeto}/storage/v1/object/public/produtos/`;

  it('aceita as fotos WEBP do seed, que ficam no site', () => {
    expect(imagemPermitida('/img/produtos/caneta-azul.webp', projeto)).toBe(true);
  });

  it('recusa os antigos SVGs do seed e outras extensões locais', () => {
    expect(imagemPermitida('/img/produtos/caneta-azul.svg', projeto)).toBe(false);
    expect(imagemPermitida('/img/produtos/caneta-azul.webpx', projeto)).toBe(false);
  });

  it('aceita arquivo do Storage do próprio projeto com nome UUID', () => {
    expect(imagemPermitida(`${storage}1b4e28ba-2fa1-11d2-883f-0016d3cca427.png`, projeto)).toBe(true);
  });

  it('recusa outros sites, outros projetos e esquemas perigosos', () => {
    expect(imagemPermitida('https://site-malicioso.com/x.png', projeto)).toBe(false);
    expect(imagemPermitida('https://outro.supabase.co/storage/v1/object/public/produtos/a.png', projeto)).toBe(false);
    expect(imagemPermitida('javascript:alert(1)', projeto)).toBe(false);
    expect(imagemPermitida('data:image/svg+xml,<svg onload=alert(1)>', projeto)).toBe(false);
  });

  it('recusa SVG ou HTML no Storage e caminhos com ../', () => {
    expect(imagemPermitida(`${storage}abc.svg`, projeto)).toBe(false);
    expect(imagemPermitida(`${storage}abc.html`, projeto)).toBe(false);
    expect(imagemPermitida('/img/produtos/../../admin/x.webp', projeto)).toBe(false);
  });

  it('vazio usa a imagem padrão', () => {
    expect(imagemPermitida(null, projeto)).toBe(false);
  });
});

describe('destinoSeguro (volta depois do login, FA01)', () => {
  it('aceita páginas do próprio site', () => {
    expect(destinoSeguro('/produto.html?id=5')).toBe('/produto.html?id=5');
    expect(destinoSeguro('/carrinho.html')).toBe('/carrinho.html');
    expect(destinoSeguro('/admin/produtos.html')).toBe('/admin/produtos.html');
  });

  it('recusa endereços externos', () => {
    expect(destinoSeguro('https://site-falso.com')).toBe('/index.html');
    expect(destinoSeguro('//site-falso.com/login.html')).toBe('/index.html');
    expect(destinoSeguro('javascript:alert(1)')).toBe('/index.html');
    expect(destinoSeguro(null)).toBe('/index.html');
  });
});

describe('validarProduto (painel do administrador)', () => {
  const valido = { nome: 'Caneta', preco: 19.9, estoque: 10, categoriaId: 1 };

  it('produto completo não tem erros', () => {
    expect(validarProduto(valido)).toEqual({});
  });

  it('aceita estoque zero (produto esgotado)', () => {
    expect(validarProduto({ ...valido, estoque: 0 })).toEqual({});
  });

  it('aponta cada campo inválido', () => {
    expect(validarProduto({ nome: '   ', preco: 0, estoque: 1.5, categoriaId: 0 })).toEqual({
      nome: 'Informe o nome.',
      preco: 'O preço precisa ser maior que zero.',
      estoque: 'Informe um número inteiro, zero ou maior.',
      categoria: 'Escolha a categoria.',
    });
  });

  it('recusa preço e estoque negativos ou que não são números', () => {
    const erros = validarProduto({ ...valido, preco: Number.NaN, estoque: -1 });
    expect(Object.keys(erros)).toEqual(['preco', 'estoque']);
  });
});
