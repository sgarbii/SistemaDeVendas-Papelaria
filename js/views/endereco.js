// Campos de endereço com preenchimento pelo CEP (RF05, RNF16, CT13).
// Usados no perfil e na finalização da compra.
import { el } from '../utils/html.js';
import { formatarCep, apenasDigitos } from '../utils/formatacao.js';
import { validarCep } from '../utils/validacao.js';
import { limparErro, marcarErro } from './componentes.js';
import { buscarCep } from '../services/cep.js';

// Devolve { elemento, valores(), validar() }
export function camposEndereco(inicial = {}) {
  const cep = el('input', { id: 'cep', name: 'cep', inputmode: 'numeric', autocomplete: 'postal-code', maxlength: 9, placeholder: '00000-000' });
  const endereco = el('input', { id: 'endereco', name: 'endereco', autocomplete: 'street-address', placeholder: 'Rua, bairro, cidade - UF' });
  const numero = el('input', { id: 'numero', name: 'numero', placeholder: 'Ex.: 120, apto 3' });
  const status = el('span', { class: 'status-cep', 'aria-live': 'polite' });

  cep.value = formatarCep(inicial.cep ?? '');
  endereco.value = inicial.endereco ?? '';
  numero.value = inicial.numero_complemento ?? '';

  for (const campo of [cep, endereco, numero]) {
    campo.addEventListener('input', () => limparErro(campo));
  }

  // Ao completar os 8 dígitos, consulta o ViaCEP
  let ultimaConsulta = apenasDigitos(cep.value);
  cep.addEventListener('input', async () => {
    cep.value = formatarCep(cep.value);
    const digitos = apenasDigitos(cep.value);
    if (digitos.length !== 8 || digitos === ultimaConsulta) return;
    ultimaConsulta = digitos;

    status.textContent = 'Buscando endereço…';
    endereco.readOnly = true;
    const resultado = await buscarCep(digitos);
    endereco.readOnly = false; // os campos ficam sempre liberados para digitar

    if (resultado?.endereco) {
      endereco.value = resultado.endereco;
      status.textContent = 'Endereço preenchido pelo CEP. Confira e informe o número.';
      numero.focus();
    } else if (resultado?.naoEncontrado) {
      status.textContent = 'CEP não encontrado. Digite o endereço abaixo.';
      endereco.focus();
    } else {
      // RNF16: ViaCEP fora do ar ou demorou mais de 2 s
      status.textContent = 'Não conseguimos buscar o CEP agora. Digite o endereço normalmente.';
      endereco.focus();
    }
  });

  const elemento = el('div', { class: 'formulario' },
    el('div', { class: 'linha-campos' },
      el('div', { class: 'campo' }, el('label', { for: 'cep' }, 'CEP'), cep, status),
      el('div', { class: 'campo' }, el('label', { for: 'numero' }, 'Número e complemento'), numero)
    ),
    el('div', { class: 'campo' }, el('label', { for: 'endereco' }, 'Endereço'), endereco)
  );

  return {
    elemento,
    valores: () => ({
      cep: apenasDigitos(cep.value) || null,
      endereco: endereco.value.trim() || null,
      numero_complemento: numero.value.trim() || null,
    }),
    // obrigatorio = true na compra; no perfil o endereço é opcional
    validar(obrigatorio) {
      let valido = true;
      const temAlgo = cep.value || endereco.value.trim() || numero.value.trim();
      if (!obrigatorio && !temAlgo) return true;
      if (!validarCep(cep.value)) { marcarErro(cep, 'Informe um CEP com 8 dígitos.'); valido = false; }
      if (!endereco.value.trim()) { marcarErro(endereco, 'Informe o endereço.'); valido = false; }
      if (!numero.value.trim()) { marcarErro(numero, 'Informe o número.'); valido = false; }
      return valido;
    },
  };
}

// Texto único gravado em pedidos.endereco_entrega
export function enderecoCompleto({ cep, endereco, numero_complemento }) {
  return `${endereco}, ${numero_complemento} — CEP ${formatarCep(cep)}`;
}
