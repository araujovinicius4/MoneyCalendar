import type { ClassificacaoFinanceira, MovimentacaoFinanceira } from '../domain/transactions'
import type { ImportReconciliationResult } from './reconcile-import'

export type ImportBatchStatus = 'ativo' | 'revertido'

export interface ImportBatch {
  readonly importBatchId: string
  readonly importedAt: string
  readonly fileName: string
  readonly recognizedMovements: number
  readonly addedCount: number
  readonly ignoredExistingCount: number
  readonly preservedManualCount: number
  readonly preservedReclassificationCount: number
  readonly addedMovementIds: readonly string[]
  readonly initialClassifications: Readonly<Record<string, ClassificacaoFinanceira>>
  readonly status: ImportBatchStatus
  readonly revertedAt?: string
}

export interface ImportReversalPreview {
  readonly batch: ImportBatch
  readonly removableMovementIds: readonly string[]
  readonly reclassifiedMovementIds: readonly string[]
}

export interface ImportReversalResult {
  readonly movements: readonly MovimentacaoFinanceira[]
  readonly history: readonly ImportBatch[]
  readonly removedCount: number
  readonly removedReclassifiedCount: number
}

const defaultBatchId = () => {
  const uniquePart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `import:${uniquePart}`
}

export function createImportBatch(
  fileName: string,
  recognizedMovements: number,
  reconciliation: ImportReconciliationResult,
  options: { readonly now?: Date; readonly generateId?: () => string } = {},
): ImportBatch {
  const importBatchId = (options.generateId ?? defaultBatchId)()
  const importedAt = (options.now ?? new Date()).toISOString()
  const addedMovementIds = reconciliation.addedMovements.map(({ id }) => id)
  return {
    importBatchId,
    importedAt,
    fileName,
    recognizedMovements,
    addedCount: reconciliation.summary.addedMovements,
    ignoredExistingCount: reconciliation.summary.ignoredExistingMovements,
    preservedManualCount: reconciliation.summary.preservedManualMovements,
    preservedReclassificationCount: reconciliation.summary.preservedReclassifications,
    addedMovementIds,
    initialClassifications: Object.fromEntries(
      reconciliation.addedMovements.map(({ id, classificacaoFinanceira }) => [id, classificacaoFinanceira]),
    ),
    status: 'ativo',
  }
}

export function inspectImportReversal(
  movements: readonly MovimentacaoFinanceira[],
  batch: ImportBatch,
): ImportReversalPreview {
  if (batch.status !== 'ativo') throw new Error('Esta importação já foi revertida.')
  const batchIds = new Set(batch.addedMovementIds)
  const removable = movements.filter((movement) =>
    batchIds.has(movement.id) && movement.dadosOriginais.origem !== 'manual')
  return {
    batch,
    removableMovementIds: removable.map(({ id }) => id),
    reclassifiedMovementIds: removable
      .filter(({ id, classificacaoFinanceira }) => batch.initialClassifications[id] !== classificacaoFinanceira)
      .map(({ id }) => id),
  }
}

export function reverseImportBatch(
  movements: readonly MovimentacaoFinanceira[],
  history: readonly ImportBatch[],
  importBatchId: string,
  confirmation: { readonly confirmed: true },
  now = new Date(),
): ImportReversalResult {
  if (confirmation.confirmed !== true) throw new Error('A reversão exige confirmação explícita.')
  const batch = history.find((item) => item.importBatchId === importBatchId)
  if (!batch) throw new Error('Lote de importação não encontrado.')
  const preview = inspectImportReversal(movements, batch)
  const idsToRemove = new Set(preview.removableMovementIds)
  return {
    movements: movements.filter((movement) => !idsToRemove.has(movement.id)),
    history: history.map((item) => item.importBatchId === importBatchId
      ? { ...item, status: 'revertido', revertedAt: now.toISOString() }
      : item),
    removedCount: preview.removableMovementIds.length,
    removedReclassifiedCount: preview.reclassifiedMovementIds.length,
  }
}
