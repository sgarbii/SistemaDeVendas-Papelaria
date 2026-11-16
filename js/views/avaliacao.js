// Janela de avaliação: estrelas clicáveis de 1 a 5 e comentário obrigatório
// (RF02, RNF05, RNF08, Cenário 02). Usada em "Meus pedidos" e no painel admin.
import { mensagemDeErro } from '../services/supabase.js';
import { el, trocarConteudo } from '../utils/html.js';
import { validarComentario, validarNota } from '../utils/validacao.js';
import { icone, ilustracao, marcarErro, limparErro, abrirJanela } from './componentes.js';

const NOMES_NOTA = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];

// abrirJanelaAvaliacao({ titulo, nomeProduto, nota, comentario, aoEnviar })
// aoEnviar(nota, comentario) deve gravar no banco e lançar erro se falhar.
export function abrirJanelaAvaliacao({ titulo, nomeProduto, nota = 0, comentario = '', aoEnviar, aoFechar }) {
  let notaEscolhida = nota;
  let fechar = () => {}; // definida no fim, quando a janela é aberta
  const editando = nota > 0; // nota já preenchida = edição de uma avaliação existente

  const janela = el('dialog', { class: 'janela', 'aria-labelledby': 'titulo-janela' });
  const conteudo = el('div', { class: 'janela-conteudo' });
  janela.append(conteudo);

  // --- estrelas (RNF08) ---
  const textoNota = el('span', { class: 'nota-escolhida', 'aria-live': 'polite' });
  const botoesEstrela = [1, 2, 3, 4, 5].map((valor) =>
    el('button', {
      type: 'button',
      'aria-label': `${valor} ${valor === 1 ? 'estrela' : 'estrelas'}: ${NOMES_NOTA[valor]}`,
      onclick: () => escolherNota(valor),
    }, '★')
  );
  const grupoEstrelas = el('fieldset', { class: 'escolha-estrelas' },
    el('legend', { class: 'visualmente-oculto' }, 'Nota de 1 a 5 estrelas'), botoesEstrela);
  const campoEstrelas = el('div', { class: 'campo', id: 'campo-estrelas' },
    el('span', { class: 'legenda' }, 'Sua nota'), grupoEstrelas, textoNota);

  function escolherNota(valor) {
    notaEscolhida = valor;
    botoesEstrela.forEach((botao, i) => {
      botao.classList.toggle('acesa', i < valor);
      botao.setAttribute('aria-pressed', String(i < valor && i === valor - 1));
    });
    textoNota.textContent = valor ? `${valor} de 5 — ${NOMES_NOTA[valor]}` : 'Escolha de 1 a 5 estrelas';
    campoEstrelas.classList.remove('invalido');
    campoEstrelas.querySelector('.mensagem-erro')?.remove();
  }

  // --- comentário obrigatório ---
  const caixaComentario = el('textarea', {
    id: 'comentario', name: 'comentario', maxlength: 1000,
    placeholder: 'Conte o que achou do produto: qualidade, uso no dia a dia…',
  });
  caixaComentario.value = comentario;
  caixaComentario.addEventListener('input', () => limparErro(caixaComentario));

  const mensagem = el('div', { 'aria-live': 'polite' });
  const botaoEnviar = el('button', { class: 'botao botao-primario', type: 'submit' }, 'Enviar avaliação');

  const form = el('form', { class: 'formulario', novalidate: true },
    campoEstrelas,
    el('div', { class: 'campo' }, el('label', { for: 'comentario' }, 'Comentário'), caixaComentario),
    mensagem,
    el('div', { class: 'janela-acoes' },
      el('button', { class: 'botao', type: 'button', onclick: () => fechar() }, 'Cancelar'),
      botaoEnviar
    )
  );

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    let valido = true;
    if (!validarNota(notaEscolhida)) {
      campoEstrelas.classList.add('invalido');
      if (!campoEstrelas.querySelector('.mensagem-erro')) {
        campoEstrelas.append(el('span', { class: 'mensagem-erro' }, 'Escolha uma nota de 1 a 5 estrelas.'));
      }
      valido = false;
    }
    // Cenário 02, FA01: comentário vazio não é enviado e o campo fica destacado
    if (!validarComentario(caixaComentario.value)) {
      marcarErro(caixaComentario, 'O comentário é obrigatório.');
      caixaComentario.focus();
      valido = false;
    }
    if (!valido) return;

    botaoEnviar.disabled = true;
    botaoEnviar.textContent = 'Enviando…';
    try {
      await aoEnviar(notaEscolhida, caixaComentario.value);
      mostrarAgradecimento();
    } catch (erro) {
      trocarConteudo(mensagem, el('div', { class: 'caixa caixa-erro', role: 'alert' }, el('p', {}, mensagemDeErro(erro))));
      botaoEnviar.disabled = false;
      botaoEnviar.textContent = 'Enviar avaliação';
    }
  });

  // RNF05: tela de agradecimento logo após o envio
  function mostrarAgradecimento() {
    trocarConteudo(conteudo,
      el('div', { class: 'agradecimento', role: 'status' },
        ilustracao('avaliacao-obrigado', 'ilustracao-agradecimento'),
        el('h2', { id: 'titulo-janela' }, editando ? 'Avaliação atualizada!' : 'Obrigado pela avaliação!'),
        el('p', {}, 'A avaliação já aparece na página do produto e ajuda outros clientes a escolher.')
      ),
      el('div', { class: 'janela-acoes' },
        el('button', { class: 'botao botao-primario', type: 'button', onclick: () => fechar() }, 'Fechar')
      )
    );
  }

  trocarConteudo(conteudo,
    el('div', { class: 'janela-topo' },
      el('div', {},
        el('h2', { id: 'titulo-janela' }, titulo),
        el('p', { class: 'dica' }, nomeProduto)
      ),
      el('button', { class: 'botao-icone', type: 'button', 'aria-label': 'Fechar', onclick: () => fechar() }, icone('fechar'))
    ),
    form
  );

  escolherNota(notaEscolhida);
  fechar = abrirJanela(janela, aoFechar);
}
