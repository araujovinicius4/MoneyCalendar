import type { MonthSummary } from './month-summary'
import { getMonthSummaryPeriodLabel, type OperationalCalculationDetail } from './operational-calculation-detail'

export const ACCUMULATION_INDEX_ACTION_LABEL = 'Ver memória de cálculo do Índice de acumulação'

/** Apenas apresenta os totais e o resultado que o resumo já obteve do domínio. */
export function createAccumulationIndexCalculationDetail(
  summary: MonthSummary,
  year: number,
  month: number,
  today: Date,
): OperationalCalculationDetail {
  const index = summary.accumulationIndex
  return {
    id: 'accumulationIndex',
    title: 'Memória de cálculo do Índice de acumulação',
    formula: 'Índice de acumulação = Investimentos líquidos acumulados ÷ Gastos acumulados',
    period: getMonthSummaryPeriodLabel(summary, year, month, today),
    values: [
      { label: 'Investimentos líquidos acumulados', value: summary.investments, format: 'money' },
      { label: 'Gastos acumulados', value: summary.expenses, format: 'money' },
      { label: 'Índice em percentual', value: index, format: 'percent' },
    ],
    result: index,
    resultLabel: 'Índice de acumulação',
    resultFormat: 'decimal',
    explanation: index === null
      ? 'Não é possível calcular a razão porque não existem gastos no período.'
      : `Você investiu R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(index)} para cada R$ 1,00 gasto.`,
    interpretation: [
      '> 1 → investiu mais do que gastou',
      '= 1 → investiu o mesmo que gastou',
      '< 1 → gastou mais do que investiu',
    ],
    relatedDetails: [
      { id: 'investimentos', label: 'Ver movimentações dos investimentos acumulados' },
      { id: 'gastos', label: 'Ver movimentações dos gastos acumulados' },
    ],
  }
}
