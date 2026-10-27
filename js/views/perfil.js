// Perfil do cliente (RF05): editar nome, telefone e endereço (pelo CEP)
// e excluir a conta com os dados pessoais (RE01).
import { mensagemDeErro } from '../services/supabase.js';
import { el, trocarConteudo } from '../utils/html.js';
import { formatarTelefone, apenasDigitos, formatarData } from '../utils/formatacao.js';
import { validarNome, validarTelefone } from '../utils/validacao.js';
import { montarPagina } from './cabecalho.js';
import { icone, mostrarCarregando, mostrarErro, marcarErro, limparErro, avisar, abrirJanela } from './componentes.js';
import { camposEndereco } from './endereco.js';
import { exigirLogin, irParaLogin, obterPerfil, atualizarPerfil, excluirConta } from '../services/auth.js';

const conteudo = document.getElementById('conteudo');

const sessao = await exigirLogin();
if (sessao) {
  await montarPagina();
  carregar();
}

async function carregar() {
  mostrarCarregando(conteudo, 'Carregando seu perfil…');
  try {
    mostrarPerfil(await obterPerfil());
  } catch (erro) {
    if (erro.semSessao) return irParaLogin();
    mostrarErro(conteudo, mensagemDeErro(erro), carregar);
  }
}

function mostrarPerfil(perfil) {
  const nome = el('input', { id: 'nome', name: 'nome', autocomplete: 'name' });
  const telefone = el('input', { id: 'telefone', name: 'telefone', type: 'tel', autocomplete: 'tel', placeholder: '(35) 99999-9999' });
  nome.value = perfil.nome ?? '';
  telefone.value = formatarTelefone(perfil.telefone ?? '');
  nome.addEventListener('input', () => limparErro(nome));
  telefone.addEventListener('input', () => {
    telefone.value = formatarTelefone(telefone.value);
    limparErro(telefone);
  });

  const endereco = camposEndereco(perfil);
  const botaoSalvar = el('button', { class: 'botao botao-primario', type: 'submit' }, 'Salvar alterações');

  const form = el('form', { class: 'painel formulario', novalidate: true },
    el('h2', {}, 'Dados pessoais'),
    el('div', { class: 'linha-campos' },
      el('div', { class: 'campo' }, el('label', { for: 'nome' }, 'Nome'), nome),
      el('div', { class: 'campo' }, el('label', { for: 'telefone' }, 'Telefone'), telefone)
    ),
    el('div', { class: 'campo' },
      el('label', { for: 'email' }, 'E-mail'),
      el('input', { id: 'email', value: sessao.user.email ?? '', readonly: true }),
      el('span', { class: 'dica' }, 'O e-mail é o seu login e não pode ser alterado aqui.')
    ),
    el('h2', {}, 'Endereço de entrega'),
    endereco.elemento,
    el('div', {}, botaoSalvar)
  );

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    let valido = endereco.validar(false);
    if (!validarNome(nome.value)) { marcarErro(nome, 'Informe seu nome.'); valido = false; }
    if (!validarTelefone(telefone.value)) { marcarErro(telefone, 'Informe o telefone com DDD.'); valido = false; }
    if (!valido) return;

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando…';
    try {
      await atualizarPerfil(perfil.id, {
        nome: nome.value.trim(),
        telefone: apenasDigitos(telefone.value) || null,
        ...endereco.valores(),
      });
      avisar('Perfil atualizado!');
    } catch (erro) {
      if (erro.semSessao) return irParaLogin();
      avisar(mensagemDeErro(erro), 'erro');
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = 'Salvar alterações';
    }
  });

  trocarConteudo(conteudo,
    el('h1', { class: 'titulo-pagina' }, 'Meu ', el('span', { class: 'grifo' }, 'perfil')),
    el('p', { class: 'subtitulo' }, `Termo de uso de dados aceito em ${formatarData(perfil.termo_aceito_em)}.`),
    el('div', { class: 'layout-perfil' },
      form,
      el('section', { class: 'painel zona-perigo' },
        el('h2', {}, 'Excluir conta'),
        el('p', {}, 'Seus dados pessoais (nome, e-mail, telefone e endereço) serão apagados para sempre. '
          + 'Os pedidos antigos ficam guardados sem identificar você, só para controle de vendas e estoque (LGPD).'),
        el('button', { class: 'botao botao-perigo', type: 'button', onclick: confirmarExclusao }, 'Excluir minha conta')
      )
    )
  );
}

// RE01: confirmação antes de apagar
function confirmarExclusao() {
  const confirmacao = el('input', { id: 'confirmar-exclusao', type: 'checkbox' });
  const botaoExcluir = el('button', { class: 'botao botao-perigo', type: 'button', disabled: true }, 'Excluir definitivamente');
  const mensagem = el('div', { 'aria-live': 'polite' });
  confirmacao.addEventListener('change', () => { botaoExcluir.disabled = !confirmacao.checked; });

  const janela = el('dialog', { class: 'janela', 'aria-labelledby': 'titulo-exclusao' },
    el('div', { class: 'janela-conteudo' },
      el('div', { class: 'janela-topo' },
        el('h2', { id: 'titulo-exclusao' }, 'Excluir sua conta?'),
        el('button', { class: 'botao-icone', type: 'button', 'aria-label': 'Fechar', onclick: () => fechar() }, icone('fechar'))
      ),
      el('p', {}, 'Esta ação não pode ser desfeita. Os itens do seu carrinho voltam para o estoque da loja.'),
      el('label', { class: 'caixa-marcar', for: 'confirmar-exclusao' }, confirmacao,
        el('span', {}, 'Entendo que meus dados pessoais serão apagados.')),
      mensagem,
      el('div', { class: 'janela-acoes' },
        el('button', { class: 'botao', type: 'button', onclick: () => fechar() }, 'Cancelar'),
        botaoExcluir
      )
    )
  );

  botaoExcluir.addEventListener('click', async () => {
    botaoExcluir.disabled = true;
    botaoExcluir.textContent = 'Excluindo…';
    try {
      await excluirConta();
      fechar();
      trocarConteudo(conteudo,
        el('section', { class: 'confirmacao', role: 'status' },
          icone('ok'),
          el('h1', { class: 'titulo-pagina' }, 'Conta excluída'),
          el('p', {}, 'Seus dados pessoais foram apagados. Obrigado por ter comprado com a gente.'),
          el('div', { class: 'acoes' }, el('a', { class: 'botao', href: '/index.html' }, 'Voltar à loja'))
        )
      );
    } catch (erro) {
      trocarConteudo(mensagem, el('div', { class: 'caixa caixa-erro', role: 'alert' }, el('p', {}, mensagemDeErro(erro))));
      botaoExcluir.disabled = false;
      botaoExcluir.textContent = 'Excluir definitivamente';
    }
  });

  const fechar = abrirJanela(janela);
}
