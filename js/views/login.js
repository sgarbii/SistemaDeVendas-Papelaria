// Login e cadastro (RF04, RE01, RNF13).
// Depois de entrar, volta para a página de onde o cliente veio (FA01).
import { mensagemDeErro } from '../services/supabase.js';
import { el, trocarConteudo } from '../utils/html.js';
import { validarEmail, validarSenha, validarNome, destinoSeguro, SENHA_MINIMA } from '../utils/validacao.js';
import { montarPagina } from './cabecalho.js';
import { marcarErro, limparErro } from './componentes.js';
import { obterSessao, entrar, cadastrar } from '../services/auth.js';

const conteudo = document.getElementById('conteudo');
const parametros = new URLSearchParams(location.search);
const voltarPara = destinoSeguro(parametros.get('voltar'));

// já logado: não precisa estar aqui
if (await obterSessao()) {
  location.replace(voltarPara);
} else {
  await montarPagina();
  montarTela(parametros.get('modo') === 'cadastro' ? 'cadastro' : 'entrar');
}

function campo({ id, rotulo, tipo = 'text', autocomplete, dica }) {
  const entrada = el('input', { id, name: id, type: tipo, autocomplete, required: true });
  entrada.addEventListener('input', () => limparErro(entrada));
  return el('div', { class: 'campo' },
    el('label', { for: id }, rotulo),
    entrada,
    dica ? el('span', { class: 'dica' }, dica) : null
  );
}

function montarTela(modo) {
  const mensagem = el('div', { 'aria-live': 'polite' });
  // FA01: veio de uma ação que exige login
  if (parametros.has('voltar') && voltarPara !== '/index.html') {
    trocarConteudo(mensagem, el('div', { class: 'caixa caixa-info' },
      el('p', {}, 'Faça login para usar o carrinho e comprar. Depois voltamos para onde você estava.')));
  }

  const abaEntrar = el('button', { class: 'aba', type: 'button', role: 'tab', id: 'aba-entrar', 'aria-controls': 'painel-login' }, 'Entrar');
  const abaCadastro = el('button', { class: 'aba', type: 'button', role: 'tab', id: 'aba-cadastro', 'aria-controls': 'painel-login' }, 'Criar conta');
  const painel = el('div', { id: 'painel-login', role: 'tabpanel' });

  function selecionar(qual) {
    abaEntrar.setAttribute('aria-selected', String(qual === 'entrar'));
    abaCadastro.setAttribute('aria-selected', String(qual === 'cadastro'));
    painel.setAttribute('aria-labelledby', qual === 'entrar' ? 'aba-entrar' : 'aba-cadastro');
    trocarConteudo(painel, qual === 'entrar' ? formularioEntrar(mensagem) : formularioCadastro(mensagem));
  }
  abaEntrar.addEventListener('click', () => selecionar('entrar'));
  abaCadastro.addEventListener('click', () => selecionar('cadastro'));

  trocarConteudo(conteudo,
    el('section', { class: 'cartao-login' },
      el('h1', { class: 'titulo-pagina' }, 'Sua ', el('span', { class: 'grifo' }, 'conta')),
      mensagem,
      el('div', { class: 'abas', role: 'tablist' }, abaEntrar, abaCadastro),
      painel
    )
  );
  selecionar(modo);
}

function formularioEntrar(mensagem) {
  const form = el('form', { class: 'formulario', novalidate: true },
    campo({ id: 'email', rotulo: 'E-mail', tipo: 'email', autocomplete: 'email' }),
    campo({ id: 'senha', rotulo: 'Senha', tipo: 'password', autocomplete: 'current-password' }),
    el('button', { class: 'botao botao-primario botao-largo', type: 'submit' }, 'Entrar')
  );

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const email = form.email.value.trim();
    const senha = form.senha.value;

    let valido = true;
    if (!validarEmail(email)) { marcarErro(form.email, 'Informe um e-mail válido.'); valido = false; }
    if (!senha) { marcarErro(form.senha, 'Informe a senha.'); valido = false; }
    if (!valido) return;

    const botao = form.querySelector('button[type=submit]');
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    try {
      await entrar(email, senha);
      location.href = voltarPara;
    } catch (erro) {
      trocarConteudo(mensagem, el('div', { class: 'caixa caixa-erro', role: 'alert' }, el('p', {}, mensagemDeErro(erro))));
      botao.disabled = false;
      botao.textContent = 'Entrar';
    }
  });
  return form;
}

// RE01: termo de uso de dados (consentimento da LGPD)
function termoDeUso() {
  return el('details', { class: 'termo' },
    el('summary', {}, 'Ler o termo de uso de dados'),
    el('p', {}, 'Ao criar a conta, você concorda que a Papelaria Online guarde seu nome, e-mail, telefone e endereço, seguindo a LGPD (Lei 13.709/2018):'),
    el('ul', {},
      el('li', {}, 'os dados são usados só para as vendas: identificar você, entregar os pedidos e mostrar seu histórico;'),
      el('li', {}, 'não vendemos nem compartilhamos seus dados com terceiros;'),
      el('li', {}, 'você pode editar seus dados ou excluir a conta quando quiser, na página "Meu perfil";'),
      el('li', {}, 'ao excluir a conta, seus dados pessoais são apagados; os pedidos antigos ficam guardados sem identificar você, só para controle de vendas e estoque.')
    )
  );
}

function formularioCadastro(mensagem) {
  const aceite = el('input', { id: 'aceite', name: 'aceite', type: 'checkbox' });
  aceite.addEventListener('change', () => limparErro(aceite));

  const form = el('form', { class: 'formulario', novalidate: true },
    campo({ id: 'nome', rotulo: 'Nome completo', autocomplete: 'name' }),
    campo({ id: 'email', rotulo: 'E-mail', tipo: 'email', autocomplete: 'email' }),
    campo({ id: 'senha', rotulo: 'Senha', tipo: 'password', autocomplete: 'new-password', dica: `Mínimo de ${SENHA_MINIMA} caracteres.` }),
    el('div', { class: 'campo' },
      el('label', { class: 'caixa-marcar', for: 'aceite' }, aceite,
        el('span', {}, 'Li e aceito o termo de uso de dados pessoais (LGPD).')),
      termoDeUso()
    ),
    el('button', { class: 'botao botao-primario botao-largo', type: 'submit' }, 'Criar conta')
  );

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nome = form.nome.value.trim();
    const email = form.email.value.trim();
    const senha = form.senha.value;

    let valido = true;
    if (!validarNome(nome)) { marcarErro(form.nome, 'Informe seu nome.'); valido = false; }
    if (!validarEmail(email)) { marcarErro(form.email, 'Informe um e-mail válido.'); valido = false; }
    if (!validarSenha(senha)) { marcarErro(form.senha, `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`); valido = false; }
    if (!aceite.checked) { marcarErro(aceite, 'Para criar a conta é preciso aceitar o termo.'); valido = false; }
    if (!valido) return;

    const botao = form.querySelector('button[type=submit]');
    botao.disabled = true;
    botao.textContent = 'Criando conta…';
    try {
      const resultado = await cadastrar({ nome, email, senha, aceitouTermo: true });
      if (resultado.session) {
        location.href = voltarPara;
        return;
      }
      // confirmação de e-mail ligada no Supabase
      trocarConteudo(mensagem, el('div', { class: 'caixa caixa-sucesso', role: 'status' },
        el('p', {}, 'Conta criada! Confirme pelo link que enviamos para o seu e-mail e depois entre.')));
      form.reset();
    } catch (erro) {
      trocarConteudo(mensagem, el('div', { class: 'caixa caixa-erro', role: 'alert' }, el('p', {}, mensagemDeErro(erro))));
    } finally {
      botao.disabled = false;
      botao.textContent = 'Criar conta';
    }
  });
  return form;
}
