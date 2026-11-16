// CRUD de categorias no painel (RF07).
import { mensagemDeErro } from '../../services/supabase.js';
import { el, trocarConteudo } from '../../utils/html.js';
import { icone, mostrarCarregando, mostrarErro, marcarErro, limparErro, avisar } from '../componentes.js';
import { montarPainel } from './painel.js';
import { listarCategoriasComTotal, salvarCategoria, excluirCategoria } from '../../services/admin.js';

const conteudo = document.getElementById('conteudo');

if (await montarPainel('categorias.html')) carregar();

async function carregar() {
  mostrarCarregando(conteudo, 'Carregando categorias…');
  try {
    mostrarLista(await listarCategoriasComTotal());
  } catch (erro) {
    mostrarErro(conteudo, mensagemDeErro(erro), carregar);
  }
}

// produtos(count) vem como [{ count: 4 }]
function totalDeProdutos(categoria) {
  return categoria.produtos?.[0]?.count ?? 0;
}

function mostrarLista(categorias) {
  const novaCategoria = el('input', { id: 'nova-categoria', name: 'nova-categoria', maxlength: 60, placeholder: 'Ex.: Mochilas' });
  novaCategoria.addEventListener('input', () => limparErro(novaCategoria));

  const formNova = el('form', { class: 'painel form-inline', novalidate: true },
    el('div', { class: 'campo' }, el('label', { for: 'nova-categoria' }, 'Nova categoria'), novaCategoria),
    el('button', { class: 'botao botao-primario', type: 'submit' }, 'Adicionar')
  );
  formNova.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nome = novaCategoria.value.trim();
    if (!nome) return marcarErro(novaCategoria, 'Informe o nome da categoria.');
    try {
      await salvarCategoria(null, nome);
      avisar('Categoria criada!');
      carregar();
    } catch (erro) {
      marcarErro(novaCategoria, erro.codigo === '23505' ? 'Já existe uma categoria com esse nome.' : mensagemDeErro(erro));
    }
  });

  trocarConteudo(conteudo,
    el('div', { class: 'barra-titulo' }, el('h1', { class: 'titulo-pagina' }, 'Categorias')),
    formNova,
    el('table', { class: 'tabela' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Nome'),
        el('th', { class: 'numero' }, 'Produtos'),
        el('th', {}, el('span', { class: 'visualmente-oculto' }, 'Ações'))
      )),
      el('tbody', {}, categorias.map(linhaCategoria))
    )
  );
}

function linhaCategoria(categoria) {
  const total = totalDeProdutos(categoria);
  return el('tr', {},
    el('td', { 'data-rotulo': 'Nome' }, categoria.nome),
    el('td', { class: 'numero', 'data-rotulo': 'Produtos' }, String(total)),
    el('td', {},
      el('div', { class: 'acoes' },
        el('button', { class: 'botao-texto', type: 'button', onclick: () => renomear(categoria) }, icone('lapis'), 'Renomear'),
        el('button', { class: 'botao-texto perigo', type: 'button', onclick: () => excluir(categoria, total) }, icone('lixeira'), 'Excluir')
      )
    )
  );
}

async function renomear(categoria) {
  const nome = prompt('Novo nome da categoria:', categoria.nome)?.trim();
  if (!nome || nome === categoria.nome) return;
  try {
    await salvarCategoria(categoria.id, nome);
    avisar('Categoria renomeada!');
    carregar();
  } catch (erro) {
    avisar(erro.codigo === '23505' ? 'Já existe uma categoria com esse nome.' : mensagemDeErro(erro), 'erro');
  }
}

async function excluir(categoria, total) {
  // o banco recusa (on delete restrict) se ainda houver produtos na categoria
  if (total > 0) {
    avisar(`"${categoria.nome}" tem ${total} produto(s). Mude-os de categoria antes de excluir.`, 'alerta');
    return;
  }
  if (!confirm(`Excluir a categoria "${categoria.nome}"?`)) return;
  try {
    await excluirCategoria(categoria.id);
    avisar('Categoria excluída.');
    carregar();
  } catch (erro) {
    avisar(mensagemDeErro(erro), 'erro');
  }
}
