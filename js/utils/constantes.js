// Valores do domínio usados pela loja e pelo painel (enum StatusPedido do
// diagrama de classes). Ficam aqui, sem rede e sem DOM, para que os
// cálculos do painel possam ser testados no Vitest.

export const NOMES_STATUS = {
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  PAGO: 'Pago',
  ENVIADO: 'Enviado',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};

export const FORMAS_PAGAMENTO = {
  PIX: 'Pix',
  CARTAO: 'Cartão de crédito',
  BOLETO: 'Boleto',
};

// Pedido pago = já entrou no faturamento e seus itens podem ser avaliados
// (RNF07). O banco usa a mesma lista na política de avaliações (06_rls.sql).
export const STATUS_PAGOS = ['PAGO', 'ENVIADO', 'ENTREGUE'];

export function pedidoPago(pedido) {
  return STATUS_PAGOS.includes(pedido.status);
}
