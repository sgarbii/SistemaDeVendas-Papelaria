// Estrutura comum das páginas do painel (RF07): topo, menu e controle de acesso.
//
// IMPORTANTE: a checagem de admin feita aqui é só VISUAL (esconde o menu e
// mostra "Acesso restrito"). Qualquer um pode mexer no JavaScript do próprio
// navegador. A proteção de verdade está no banco: as políticas RLS e os
// GRANTs (06_rls.sql) recusam as alterações de quem não é admin (RNF15).
import { mensagemDeErro } from '../../services/supabase.js';
import { el, trocarConteudo } from '../../utils/html.js';
import { icone, logotipo, mostrarVazio } from '../componentes.js';
import { exigirLogin, obterPerfil, sair } from '../../services/auth.js';

const PAGINAS = [
  { arquivo: 'index.html', nome: 'Resumo', icone: 'grafico' },
  { arquivo: 'produtos.html', nome: 'Produtos', icone: 'caixa' },
  { arquivo: 'categorias.html', nome: 'Categorias', icone: 'menu' },
  { arquivo: 'pedidos.html', nome: 'Pedidos', icone: 'sacola' },
  { arquivo: 'avaliacoes.html', nome: 'Avaliações', icone: 'estrela' },
];

// Devolve o perfil do admin ou null (quando não pode entrar)
export async function montarPainel(paginaAtual) {
  const cabecalho = document.getElementById('cabecalho');
  const conteudo = document.getElementById('conteudo');

  const sessao = await exigirLogin();
  if (!sessao) return null;

  let perfil = null;
  try {
    perfil = await obterPerfil();
  } catch (erro) {
    mostrarVazio(conteudo, { titulo: 'Não foi possível abrir o painel', texto: mensagemDeErro(erro), nomeIcone: 'erro' });
    return null;
  }

  trocarConteudo(cabecalho,
    el('div', { class: 'admin-topo' },
      el('div', { class: 'container' },
        el('div', {}, logotipo(), el('div', { class: 'etiqueta' }, 'Painel do administrador')),
        el('div', { class: 'acoes-topo' },
          el('a', { class: 'link-claro', href: '/index.html' }, 'Ver a loja'),
          el('button', {
            class: 'link-claro', type: 'button',
            onclick: async () => { await sair(); location.href = '/index.html'; },
          }, 'Sair')
        )
      )
    ),
    perfil?.papel === 'admin'
      ? el('nav', { class: 'admin-nav', 'aria-label': 'Seções do painel' },
          el('ul', { class: 'container' },
            PAGINAS.map((p) => el('li', {},
              el('a', { href: `/admin/${p.arquivo}`, 'aria-current': p.arquivo === paginaAtual ? 'page' : null },
                icone(p.icone), p.nome)))
          )
        )
      : null
  );

  if (perfil?.papel !== 'admin') {
    mostrarVazio(conteudo, {
      titulo: 'Acesso restrito',
      texto: 'Esta área é só para o administrador da loja.',
      nomeIcone: 'cadeado',
      extras: [el('a', { class: 'botao', href: '/index.html' }, 'Voltar para a loja')],
    });
    return null;
  }
  return perfil;
}
