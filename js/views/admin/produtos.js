// CRUD de produtos no painel (RF07), com envio de imagem para o Storage.
import { mensagemDeErro } from '../../services/supabase.js';
import { el, trocarConteudo } from '../../utils/html.js';
import { formatarPreco } from '../../utils/formatacao.js';
import {
  icone, imagemProduto, mostrarCarregando, mostrarErro, marcarErro, limparErro, avisar, abrirJanela,
} from '../componentes.js';
import { montarPainel } from './painel.js';
import { listarCategorias } from '../../services/produtos.js';
import {
  listarTodosProdutos, salvarProduto, definirProdutoAtivo, enviarImagem, TIPOS_IMAGEM, TAMANHO_MAXIMO_IMAGEM,
} from '../../services/admin.js';

const conteudo = document.getElementById('conteudo');
let produtos = [];
let categorias = [];

if (await montarPainel('produtos.html')) carregar();

async function carregar() {
  mostrarCarregando(conteudo, 'Carregando produtos…');
  try {
    [produtos, categorias] = await Promise.all([listarTodosProdutos(), listarCategorias()]);
    mostrarLista();

    // vindo do resumo: /admin/produtos.html?editar=3
    const editarId = Number(new URLSearchParams(location.search).get('editar'));
    const produto = produtos.find((p) => p.id === editarId);
    if (produto) {
      history.replaceState(null, '', '/admin/produtos.html');
      abrirFormulario(produto);
    }
  } catch (erro) {
    mostrarErro(conteudo, mensagemDeErro(erro), carregar);
  }
}

function mostrarLista() {
  trocarConteudo(conteudo,
    el('div', { class: 'barra-titulo' },
      el('h1', { class: 'titulo-pagina' }, el('span', { class: 'grifo' }, 'Produtos')),
      el('button', { class: 'botao botao-primario', type: 'button', onclick: () => abrirFormulario(null) }, '+ Novo produto')
    ),
    el('table', { class: 'tabela' },
      el('thead', {}, el('tr', {},
        el('th', {}, el('span', { class: 'visualmente-oculto' }, 'Imagem')),
        el('th', {}, 'Nome'),
        el('th', {}, 'Categoria'),
        el('th', { class: 'numero' }, 'Preço'),
        el('th', { class: 'numero' }, 'Estoque'),
        el('th', {}, 'Situação'),
        el('th', {}, el('span', { class: 'visualmente-oculto' }, 'Ações'))
      )),
      el('tbody', {}, produtos.map(linhaProduto))
    )
  );
}

function linhaProduto(produto) {
  return el('tr', { class: produto.ativo ? null : 'inativo' },
    el('td', {}, imagemProduto(produto, { alt: '' })),
    el('td', { 'data-rotulo': 'Nome' }, produto.nome),
    el('td', { 'data-rotulo': 'Categoria' }, produto.categorias?.nome ?? '—'),
    el('td', { class: 'numero', 'data-rotulo': 'Preço' }, formatarPreco(produto.preco)),
    el('td', { class: 'numero', 'data-rotulo': 'Estoque' }, String(produto.estoque)),
    el('td', { 'data-rotulo': 'Situação' },
      el('span', { class: `selo-ativo ${produto.ativo ? 'sim' : 'nao'}` }, produto.ativo ? 'À venda' : 'Removido da loja')),
    el('td', {},
      el('div', { class: 'acoes' },
        el('button', { class: 'botao-texto', type: 'button', onclick: () => abrirFormulario(produto) }, icone('lapis'), 'Editar'),
        el('button', {
          class: `botao-texto${produto.ativo ? ' perigo' : ''}`,
          type: 'button',
          onclick: () => alternarAtivo(produto),
        }, produto.ativo ? 'Remover' : 'Voltar à venda')
      )
    )
  );
}

// "Remover" só tira da loja (ativo = false): os pedidos antigos continuam com o produto
async function alternarAtivo(produto) {
  const acao = produto.ativo ? 'remover da loja' : 'colocar de volta à venda';
  if (!confirm(`Deseja ${acao} "${produto.nome}"?`)) return;
  try {
    await definirProdutoAtivo(produto.id, !produto.ativo);
    avisar(produto.ativo ? 'Produto removido da loja.' : 'Produto de volta à venda.');
    carregar();
  } catch (erro) {
    avisar(mensagemDeErro(erro), 'erro');
  }
}

function campoTexto(id, rotulo, valor, atributos = {}) {
  const entrada = el(atributos.tag ?? 'input', { id, name: id, ...atributos, tag: null });
  entrada.value = valor ?? '';
  entrada.addEventListener('input', () => limparErro(entrada));
  return el('div', { class: 'campo' }, el('label', { for: id }, rotulo), entrada);
}

function abrirFormulario(produto) {
  const novo = !produto;
  const campoArquivo = el('input', {
    id: 'imagem', name: 'imagem', type: 'file', accept: Object.keys(TIPOS_IMAGEM).join(','),
  });
  const previa = imagemProduto(produto ?? {}, { class: 'previa-imagem', alt: 'Prévia da imagem' });
  campoArquivo.addEventListener('change', () => {
    const arquivo = campoArquivo.files[0];
    limparErro(campoArquivo);
    if (!arquivo) return;
    // SVG e HTML são recusados: podem carregar script (o Storage também recusa)
    if (!TIPOS_IMAGEM[arquivo.type]) {
      marcarErro(campoArquivo, 'Envie uma imagem PNG, JPG ou WEBP.');
      campoArquivo.value = '';
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
      marcarErro(campoArquivo, 'A imagem pode ter no máximo 2 MB.');
      campoArquivo.value = '';
      return;
    }
    // prévia como "data:" (a CSP do site não permite imagens "blob:")
    const leitor = new FileReader();
    leitor.addEventListener('load', () => { previa.src = leitor.result; });
    leitor.readAsDataURL(arquivo);
  });

  const seletorCategoria = el('select', { id: 'categoria', name: 'categoria' },
    el('option', { value: '' }, 'Escolha…'),
    categorias.map((c) => el('option', { value: c.id, selected: c.id === produto?.categoria_id }, c.nome))
  );
  seletorCategoria.addEventListener('change', () => limparErro(seletorCategoria));

  const caixaAtivo = el('input', { id: 'ativo', name: 'ativo', type: 'checkbox', checked: novo || produto.ativo });
  const mensagem = el('div', { 'aria-live': 'polite' });
  const botaoSalvar = el('button', { class: 'botao botao-primario', type: 'submit' }, 'Salvar');

  const form = el('form', { class: 'formulario', novalidate: true },
    campoTexto('nome', 'Nome', produto?.nome, { maxlength: 150 }),
    campoTexto('descricao', 'Descrição', produto?.descricao, { tag: 'textarea', maxlength: 2000 }),
    el('div', { class: 'linha-campos' },
      campoTexto('preco', 'Preço (R$)', produto?.preco, { type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal' }),
      campoTexto('estoque', 'Estoque disponível', produto?.estoque ?? 0, { type: 'number', min: '0', step: '1', inputmode: 'numeric' })
    ),
    el('div', { class: 'campo' }, el('label', { for: 'categoria' }, 'Categoria'), seletorCategoria),
    el('div', { class: 'campo' },
      el('label', { for: 'imagem' }, 'Imagem'),
      el('div', { class: 'linha-imagem' }, previa, campoArquivo),
      el('span', { class: 'dica' }, 'PNG, JPG ou WEBP de até 2 MB. Deixe em branco para manter a atual.')
    ),
    el('label', { class: 'caixa-marcar', for: 'ativo' }, caixaAtivo, el('span', {}, 'À venda na loja')),
    mensagem,
    el('div', { class: 'janela-acoes' },
      el('button', { class: 'botao', type: 'button', onclick: () => fechar() }, 'Cancelar'),
      botaoSalvar
    )
  );

  const janela = el('dialog', { class: 'janela', 'aria-labelledby': 'titulo-produto' },
    el('div', { class: 'janela-conteudo' },
      el('div', { class: 'janela-topo' },
        el('h2', { id: 'titulo-produto' }, novo ? 'Novo produto' : 'Editar produto'),
        el('button', { class: 'botao-icone', type: 'button', 'aria-label': 'Fechar', onclick: () => fechar() }, icone('fechar'))
      ),
      form
    )
  );

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nome = form.nome.value.trim();
    const preco = Number(form.preco.value);
    const estoque = Number(form.estoque.value);
    const categoriaId = Number(seletorCategoria.value);

    let valido = true;
    if (!nome) { marcarErro(form.nome, 'Informe o nome.'); valido = false; }
    if (!(preco > 0)) { marcarErro(form.preco, 'O preço precisa ser maior que zero.'); valido = false; }
    if (!Number.isInteger(estoque) || estoque < 0) { marcarErro(form.estoque, 'Informe um número inteiro, zero ou maior.'); valido = false; }
    if (!categoriaId) { marcarErro(seletorCategoria, 'Escolha a categoria.'); valido = false; }
    if (!valido) return;

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando…';
    try {
      let imagemUrl = produto?.imagem_url ?? null;
      if (campoArquivo.files[0]) imagemUrl = await enviarImagem(campoArquivo.files[0]);

      await salvarProduto({
        id: produto?.id,
        nome,
        descricao: form.descricao.value.trim(),
        preco,
        estoque,
        categoria_id: categoriaId,
        imagem_url: imagemUrl,
        ativo: caixaAtivo.checked,
      });
      fechar();
      avisar(novo ? 'Produto cadastrado!' : 'Produto atualizado!');
      carregar();
    } catch (erro) {
      trocarConteudo(mensagem, el('div', { class: 'caixa caixa-erro', role: 'alert' }, el('p', {}, mensagemDeErro(erro))));
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = 'Salvar';
    }
  });

  const fechar = abrirJanela(janela);
}
