import type { MovimentacaoFinanceira } from '../domain/transactions'

export function getMovementDescription(movement: MovimentacaoFinanceira): string {
  const description = movement.dadosOriginais.Descrição
    ?? movement.dadosOriginais.descricao
    ?? movement.dadosOriginais.descricaoOriginal
  return typeof description === 'string' ? description : 'Movimentação sem descrição'
}
