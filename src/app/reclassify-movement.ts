import {
  classificarMovimentacao,
  type ClassificacaoFinanceira,
  type MovimentacaoFinanceira,
} from '../domain/transactions'

export function reclassifyMovementInMemory(
  movements: readonly MovimentacaoFinanceira[],
  movementId: string,
  classification: ClassificacaoFinanceira,
): readonly MovimentacaoFinanceira[] {
  return movements.map((movement) =>
    movement.id === movementId
      ? classificarMovimentacao(movement, classification)
      : movement
  )
}
