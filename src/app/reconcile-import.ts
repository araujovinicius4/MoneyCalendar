import {
  obterIdentidadeBancariaNubank,
  type DadosOriginaisNubank,
  type MovimentacaoFinanceira,
} from '../domain/transactions'
import { isManualMovement } from './manual-movement'

export interface ImportReconciliationSummary {
  readonly addedMovements: number
  readonly ignoredExistingMovements: number
  readonly preservedReclassifications: number
  readonly preservedManualMovements: number
}

export interface ImportReconciliationResult {
  readonly movements: readonly MovimentacaoFinanceira[]
  readonly addedMovements: readonly MovimentacaoFinanceira[]
  readonly summary: ImportReconciliationSummary
}

function isNubankOriginalData(value: MovimentacaoFinanceira['dadosOriginais']): value is DadosOriginaisNubank {
  return typeof value.Data === 'string'
    && typeof value.Valor === 'string'
    && typeof value.Identificador === 'string'
    && typeof value.Descrição === 'string'
}

function bankIdentity(movement: MovimentacaoFinanceira): string {
  return isNubankOriginalData(movement.dadosOriginais)
    ? obterIdentidadeBancariaNubank(movement.dadosOriginais)
    : `id:${movement.id}`
}

export function reconcileImportedMovements(
  existingMovements: readonly MovimentacaoFinanceira[],
  importedMovements: readonly MovimentacaoFinanceira[],
): ImportReconciliationResult {
  const existingBanksByIdentity = new Map<string, MovimentacaoFinanceira[]>()
  for (const movement of existingMovements) {
    if (isManualMovement(movement)) continue
    const identity = bankIdentity(movement)
    const matches = existingBanksByIdentity.get(identity) ?? []
    matches.push(movement)
    existingBanksByIdentity.set(identity, matches)
  }

  const consumedByIdentity = new Map<string, number>()
  const added: MovimentacaoFinanceira[] = []
  let ignoredExistingMovements = 0
  let preservedReclassifications = 0

  for (const imported of importedMovements) {
    const identity = bankIdentity(imported)
    const occurrence = consumedByIdentity.get(identity) ?? 0
    const existing = existingBanksByIdentity.get(identity)?.[occurrence]
    consumedByIdentity.set(identity, occurrence + 1)
    if (existing) {
      ignoredExistingMovements += 1
      if (existing.classificacaoFinanceira !== imported.classificacaoFinanceira) preservedReclassifications += 1
    } else {
      added.push(imported)
    }
  }

  const preservedManualMovements = existingMovements.filter(isManualMovement).length
  return {
    movements: [...existingMovements, ...added],
    addedMovements: added,
    summary: {
      addedMovements: added.length,
      ignoredExistingMovements,
      preservedReclassifications,
      preservedManualMovements,
    },
  }
}
