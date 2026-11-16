// Cálculos do carrinho e regras de prazo (métodos do diagrama de classes).
// As contas são feitas em centavos para evitar erros de arredondamento
// (em JavaScript, 0.1 + 0.2 = 0.30000000000000004).

export function emCentavos(valor) {
  return Math.round(Number(valor) * 100);
}

// ItemCarrinho.calcularSubtotal()
export function calcularSubtotal(preco, quantidade) {
  return (emCentavos(preco) * quantidade) / 100;
}

// Carrinho.calcularTotal(): itens no formato { preco, quantidade }
export function calcularTotal(itens) {
  const centavos = itens.reduce((soma, item) => soma + emCentavos(item.preco) * item.quantidade, 0);
  return centavos / 100;
}

// Quantidade de unidades no carrinho (contador do cabeçalho, RNF04)
export function contarUnidades(itens) {
  return itens.reduce((soma, item) => soma + item.quantidade, 0);
}

// RN02: milissegundos que faltam para a reserva vencer (0 se já venceu)
export function tempoRestanteReserva(reservadoAte, agora = Date.now()) {
  if (!reservadoAte) return 0;
  return Math.max(0, new Date(reservadoAte).getTime() - agora);
}

// ItemCarrinho.reservaExpirou()
export function reservaExpirou(reservadoAte, agora = Date.now()) {
  return tempoRestanteReserva(reservadoAte, agora) === 0;
}

// Cenário 03, passo 4: mais vendidos primeiro; empate -> mais bem avaliados
export function ordenarPorPopularidade(produtos) {
  return [...produtos].sort((a, b) =>
    (b.total_vendido - a.total_vendido) || (Number(b.nota_media) - Number(a.nota_media)));
}

// RN01 / Avaliacao.podeEditar(): o autor edita até 7 dias depois de publicar.
// (O banco confere de novo pela política RLS; aqui só decide se o botão aparece.)
export const DIAS_PARA_EDITAR = 7;
export function podeEditarAvaliacao(publicadoEm, agora = Date.now()) {
  const limite = new Date(publicadoEm).getTime() + DIAS_PARA_EDITAR * 24 * 60 * 60 * 1000;
  return agora < limite;
}
