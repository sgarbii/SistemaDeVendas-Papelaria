// Avaliações no painel: o administrador edita qualquer avaliação,
// mesmo depois dos 7 dias (RN01: "só o administrador (suporte) edita").
import { mensagemDeErro } from '../../services/supabase.js';
import { el, trocarConteudo } from '../../utils/html.js';
import { formatarData } from '../../utils/formatacao.js';
import { icone, estrelas, mostrarCarregando, mostrarErro, mostrarVazio } from '../componentes.js';
import { abrirJanelaAvaliacao } from '../avaliacao.js';
import { montarPainel } from './painel.js';
import { listarTodasAvaliacoes } from '../../services/admin.js';
import { editarAvaliacao } from '../../services/avaliacoes.js';

const conteudo = document.getElementById('conteudo');

if (await montarPainel('avaliacoes.html')) carregar();

async function carregar() {
  mostrarCarregando(conteudo, 'Carregando avaliações…');
  try {
    mostrarLista(await listarTodasAvaliacoes());
  } catch (erro) {
    mostrarErro(conteudo, mensagemDeErro(erro), carregar);
  }
}

function mostrarLista(avaliacoes) {
  const titulo = el('div', { class: 'barra-titulo' }, el('h1', { class: 'titulo-pagina' }, el('span', { class: 'grifo' }, 'Avaliações')));
  if (avaliacoes.length === 0) {
    const area = el('div');
    mostrarVazio(area, { titulo: 'Nenhuma avaliação ainda', nomeIcone: 'estrela', texto: 'As avaliações dos clientes aparecem aqui.' });
    trocarConteudo(conteudo, titulo, area);
    return;
  }

  trocarConteudo(conteudo,
    titulo,
    el('table', { class: 'tabela' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Produto'),
        el('th', {}, 'Nota'),
        el('th', {}, 'Comentário'),
        el('th', {}, 'Publicada em'),
        el('th', {}, el('span', { class: 'visualmente-oculto' }, 'Ações'))
      )),
      el('tbody', {}, avaliacoes.map((a) =>
        el('tr', {},
          el('td', { 'data-rotulo': 'Produto' },
            el('a', { href: `/produto.html?id=${Number(a.produtos?.id)}` }, a.produtos?.nome ?? '—')),
          el('td', { 'data-rotulo': 'Nota' }, estrelas(a.nota)),
          el('td', { class: 'comentario', 'data-rotulo': 'Comentário' }, a.comentario),
          el('td', { 'data-rotulo': 'Publicada em' }, formatarData(a.publicado_em)),
          el('td', {},
            el('div', { class: 'acoes' },
              el('button', {
                class: 'botao-texto',
                type: 'button',
                onclick: () => abrirJanelaAvaliacao({
                  titulo: 'Editar avaliação (suporte)',
                  nomeProduto: a.produtos?.nome ?? '',
                  nota: a.nota,
                  comentario: a.comentario,
                  aoEnviar: (nota, comentario) => editarAvaliacao(a.id, nota, comentario),
                  aoFechar: carregar,
                }),
              }, icone('lapis'), 'Editar')
            )
          )
        )
      ))
    )
  );
}
