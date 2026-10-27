// Resumo do painel: pedidos do dia, faturamento do dia e estoque baixo.
import { mensagemDeErro } from '../../services/supabase.js';
import { el, trocarConteudo } from '../../utils/html.js';
import { formatarPreco } from '../../utils/formatacao.js';
import { mostrarCarregando, mostrarErro } from '../componentes.js';
import { montarPainel } from './painel.js';
import { obterResumo, LIMITE_ESTOQUE_BAIXO } from '../../services/admin.js';

const conteudo = document.getElementById('conteudo');

if (await montarPainel('index.html')) carregar();

async function carregar() {
  mostrarCarregando(conteudo, 'Carregando o resumo…');
  try {
    const resumo = await obterResumo();
    trocarConteudo(conteudo,
      el('div', { class: 'barra-titulo' },
        el('h1', { class: 'titulo-pagina' }, 'Resumo ', el('span', { class: 'grifo' }, 'de hoje'))
      ),
      el('div', { class: 'cartoes-resumo' },
        el('div', { class: 'cartao-resumo' },
          el('span', { class: 'rotulo' }, 'Pedidos do dia'),
          el('span', { class: 'valor' }, String(resumo.totalPedidos))
        ),
        el('div', { class: 'cartao-resumo destaque' },
          el('span', { class: 'rotulo' }, 'Faturamento do dia'),
          el('span', { class: 'valor' }, formatarPreco(resumo.faturamento))
        ),
        el('div', { class: 'cartao-resumo' },
          el('span', { class: 'rotulo' }, 'Produtos com estoque baixo'),
          el('span', { class: 'valor' }, String(resumo.estoqueBaixo.length))
        )
      ),
      el('section', { class: 'painel' },
        el('h2', {}, `Estoque baixo (${LIMITE_ESTOQUE_BAIXO} unidades ou menos)`),
        resumo.estoqueBaixo.length === 0
          ? el('p', {}, 'Nenhum produto com estoque baixo. 🎉')
          : el('ul', { class: 'lista-estoque' },
              resumo.estoqueBaixo.map((p) =>
                el('li', {},
                  el('a', { href: `/admin/produtos.html?editar=${Number(p.id)}` }, p.nome),
                  el('span', { class: 'qtd' }, p.estoque === 0 ? 'esgotado' : `${p.estoque} un.`)
                )
              )
            ),
        el('p', { class: 'dica' }, 'O estoque mostrado é o disponível, já descontando o que está reservado em carrinhos.')
      )
    );
  } catch (erro) {
    mostrarErro(conteudo, mensagemDeErro(erro), carregar);
  }
}
