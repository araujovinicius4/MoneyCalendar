export type FinancialValueState = 'positive' | 'negative' | 'neutral' | 'informational'

export type FinancialSemanticType =
  | 'profit'
  | 'bankingResult'
  | 'operationalBalance'
  | 'faturamento'
  | 'receita'
  | 'gastos'
  | 'investimentos'
  | 'bankingEntries'
  | 'bankingExits'
  | 'accumulationIndex'
  | 'investmentAllocation'
  | 'operationalBudget'
  | 'realizedExpenses'
  | 'dailyTarget'
  | 'remainingDays'
  | 'operationalPercentage'
  | 'investmentPercentage'

const favorableWhenPositive: ReadonlySet<FinancialSemanticType> = new Set([
  'profit',
  'bankingResult',
  'operationalBalance',
])

/** Traduz valor e significado financeiro em um estado visual compartilhado. */
export function getFinancialValueState(
  value: number | null,
  semanticType: FinancialSemanticType,
): FinancialValueState {
  if (value === null || !Number.isFinite(value)) return 'informational'
  if (value < 0) return 'negative'
  if (value === 0) return 'neutral'
  return favorableWhenPositive.has(semanticType) ? 'positive' : 'informational'
}

export const getFinancialValueClassName = (value: number | null, semanticType: FinancialSemanticType) =>
  `financial-value--${getFinancialValueState(value, semanticType)}`
