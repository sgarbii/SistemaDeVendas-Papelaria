// Montagem segura de HTML (RNF10, CT12).
// Regra do projeto: texto vindo do usuário ou do banco nunca entra com innerHTML.
// Usamos el(), que cria os elementos e coloca o texto como textContent.

// Troca os caracteres especiais do HTML pelas entidades.
// "<script>" vira "&lt;script&gt;" e aparece como texto, sem executar.
export function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Cria um elemento: el('a', { href: '/x', class: 'botao' }, 'Texto', outroElemento)
// - atributos "on..." viram event listeners (ex.: onclick)
// - filhos do tipo texto entram como nós de texto (nunca como HTML)
export function el(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);

  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (nome === 'class') {
      elemento.className = valor;
    } else if (nome.startsWith('on') && typeof valor === 'function') {
      elemento.addEventListener(nome.slice(2), valor);
    } else {
      elemento.setAttribute(nome, valor === true ? '' : String(valor));
    }
  }

  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return elemento;
}

// Troca todo o conteúdo de um container pelos novos filhos
export function trocarConteudo(container, ...filhos) {
  container.replaceChildren(...filhos.flat().filter(Boolean));
}
