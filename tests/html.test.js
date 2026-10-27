// Testes de unidade: escape de HTML (RNF10, CT12)
import { describe, it, expect } from 'vitest';
import { escaparHtml } from '../js/utils/html.js';

describe('escaparHtml', () => {
  it('o texto do CT12 não vira tag de script', () => {
    expect(escaparHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapa aspas, para não sair de um atributo', () => {
    expect(escaparHtml('" onmouseover="alert(1)')).toBe('&quot; onmouseover=&quot;alert(1)');
    expect(escaparHtml("'")).toBe('&#39;');
  });

  it('escapa o & primeiro (sem escapar duas vezes)', () => {
    expect(escaparHtml('Tom & Jerry <3')).toBe('Tom &amp; Jerry &lt;3');
  });

  it('texto comum não muda', () => {
    expect(escaparHtml('Caderno 10 matérias')).toBe('Caderno 10 matérias');
  });

  it('aceita valores vazios', () => {
    expect(escaparHtml(null)).toBe('');
    expect(escaparHtml(undefined)).toBe('');
    expect(escaparHtml(42)).toBe('42');
  });
});
