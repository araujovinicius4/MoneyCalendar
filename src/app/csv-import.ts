import {
  calcularEntradasBancarias,
  calcularSaidasBancarias,
} from '../domain/finance'
import {
  importarCsvNubank,
  resumirClassificacoesFinanceiras,
  type MovimentacaoFinanceira,
  type MovimentacaoNubank,
} from '../domain/transactions'

export interface CsvImportPreview {
  readonly movements: readonly MovimentacaoNubank[]
  readonly movementCount: number
  readonly bankingEntries: number
  readonly bankingExits: number
  readonly classificationSummary: ReturnType<typeof resumirClassificacoesFinanceiras>
}

/** A interface apenas orquestra as funções validadas do domínio. */
export function prepareCsvImport(content: string): CsvImportPreview {
  const movements = importarCsvNubank(content)
  return {
    movements,
    movementCount: movements.length,
    bankingEntries: calcularEntradasBancarias(movements),
    bankingExits: calcularSaidasBancarias(movements),
    classificationSummary: resumirClassificacoesFinanceiras(movements),
  }
}

export function confirmCsvImport(preview: CsvImportPreview): readonly MovimentacaoFinanceira[] {
  return [...preview.movements]
}
