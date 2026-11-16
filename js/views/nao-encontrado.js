// Página 404: o Netlify mostra 404.html para qualquer endereço que não existe.
import { el } from '../utils/html.js';
import { montarPagina } from './cabecalho.js';
import { mostrarVazio } from './componentes.js';

await montarPagina();
mostrarVazio(document.getElementById('conteudo'), {
  titulo: 'Página não encontrada',
  texto: 'O endereço pode ter mudado ou ter sido digitado errado. A busca no topo ajuda a achar o produto.',
  ilustracao: 'erro-404',
  extras: [el('a', { class: 'botao botao-primario', href: '/index.html' }, 'Voltar para a loja')],
});
