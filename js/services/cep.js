// Consulta de CEP no ViaCEP (RF05, RNF16).
// Se a API demorar mais de 2 s ou falhar, devolve null e o cliente
// digita o endereço normalmente (CT13).
import { apenasDigitos } from '../utils/formatacao.js';

const TEMPO_LIMITE_MS = 2000; // RNF16

export async function buscarCep(cep) {
  const digitos = apenasDigitos(cep);
  if (digitos.length !== 8) return null;

  const controle = new AbortController();
  const cronometro = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { signal: controle.signal });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    if (dados.erro) return { naoEncontrado: true };

    // "Rua X, Bairro, Cidade - UF"
    const partes = [dados.logradouro, dados.bairro, `${dados.localidade} - ${dados.uf}`].filter(Boolean);
    return { endereco: partes.join(', ') };
  } catch {
    return null; // fora do ar, sem internet ou passou de 2 s
  } finally {
    clearTimeout(cronometro);
  }
}
