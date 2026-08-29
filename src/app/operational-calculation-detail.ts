import type { MonthSummary, OperationalMonthSummary } from './month-summary'

export type OperationalCalculationId =
  | 'investmentAllocation'
  | 'operationalBudget'
  | 'operationalBalance'
  | 'dailyTarget'

export interface OperationalCalculationDetail {
  readonly id: string
  readonly title: string
  readonly formula: string
  readonly period: string
  readonly values: readonly { readonly label: string; readonly value: number | null; readonly format: 'money' | 'percent' | 'days' | 'decimal' }[]
  readonly result: number | null
  readonly resultLabel: string
  readonly resultFormat?: 'money' | 'percent' | 'days' | 'decimal'
  readonly explanation?: string
  readonly interpretation?: readonly string[]
  readonly relatedDetails?: readonly { readonly id: 'gastos' | 'investimentos'; readonly label: string }[]
  readonly canViewExpenses?: boolean
}

export function getMonthSummaryPeriodLabel(summary: MonthSummary, year: number, month: number, today: Date) {
  return periodLabel(summary, year, month, today)
}

export const OPERATIONAL_CALCULATION_ACTION_LABELS: Readonly<Record<OperationalCalculationId, string>> = {
  investmentAllocation: 'Ver memória de cálculo do valor destinado a investimentos',
  operationalBudget: 'Ver memória de cálculo do orçamento operacional',
  operationalBalance: 'Ver memória de cálculo do saldo operacional',
  dailyTarget: 'Ver memória de cálculo da meta diária atual de gasto',
}

const periodLabel = (summary: MonthSummary, year: number, month: number, today: Date) => {
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1))
  return summary.period === 'current'
    ? `1º de ${monthName} até ${new Intl.DateTimeFormat('pt-BR').format(today)}`
    : `${monthName} completo`
}

/** Monta somente a apresentação; todos os valores calculados vêm dos resumos financeiros. */
export function createOperationalCalculationDetail(
  id: OperationalCalculationId,
  summary: MonthSummary,
  operational: OperationalMonthSummary,
  year: number,
  month: number,
  today: Date,
): OperationalCalculationDetail {
  const common = { id, period: periodLabel(summary, year, month, today) }
  switch (id) {
    case 'investmentAllocation': return {
      ...common,
      title: 'Valor destinado a investimentos',
      formula: 'Valor destinado a investimentos = Faturamento acumulado × Percentual destinado a investimentos',
      values: [
        { label: 'Faturamento acumulado', value: summary.faturamento, format: 'money' },
        { label: 'Percentual destinado a investimentos', value: operational.investmentPercentage, format: 'percent' },
      ],
      result: operational.investmentAllocation,
      resultLabel: 'Valor destinado a investimentos',
    }
    case 'operationalBudget': return {
      ...common,
      title: 'Orçamento operacional',
      formula: 'Percentual operacional = 100% − Percentual destinado a investimentos\nOrçamento operacional = Faturamento acumulado × Percentual operacional',
      values: [
        { label: 'Faturamento acumulado', value: summary.faturamento, format: 'money' },
        { label: 'Percentual destinado a investimentos', value: operational.investmentPercentage, format: 'percent' },
        { label: 'Percentual operacional', value: operational.operationalPercentage, format: 'percent' },
      ],
      result: operational.operationalBudget,
      resultLabel: 'Orçamento operacional',
    }
    case 'operationalBalance': return {
      ...common,
      title: 'Saldo operacional',
      formula: 'Saldo operacional = Orçamento operacional − Gastos realizados',
      values: [
        { label: 'Orçamento operacional', value: operational.operationalBudget, format: 'money' },
        { label: 'Gastos realizados', value: operational.realizedExpenses, format: 'money' },
      ],
      result: operational.operationalBalance,
      resultLabel: 'Saldo operacional',
      canViewExpenses: true,
    }
    case 'dailyTarget': return {
      ...common,
      title: 'Meta diária atual de gasto',
      formula: 'Meta diária atual de gasto = Saldo operacional ÷ Dias restantes',
      values: [
        { label: 'Saldo operacional', value: operational.operationalBalance, format: 'money' },
        { label: 'Dias restantes', value: operational.remainingDays, format: 'days' },
      ],
      result: operational.currentDailySpendingTarget,
      resultLabel: 'Meta diária atual de gasto',
      explanation: operational.operationalBalance < 0
        ? 'A meta negativa indica que o orçamento operacional já foi ultrapassado. Para o cálculo atual, dia útil significa segunda a sexta-feira, sem considerar feriados.'
        : 'Para o cálculo atual, dia útil significa segunda a sexta-feira, sem considerar feriados.',
    }
  }
}
