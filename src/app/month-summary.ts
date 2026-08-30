import {
  calcularAplicacoes,
  calcularEntradasBancarias,
  calcularDiasRestantesAtePrimeiroDiaUtilProximoMes,
  calcularFaturamento,
  calcularGastos,
  calcularIndiceAcumulacao,
  calcularInvestimentos,
  calcularLucro,
  calcularResgatesInvestimento,
  calcularMetaDiariaAtualDeGasto,
  calcularOrcamentoOperacional,
  calcularPercentualOperacional,
  calcularPercentualEfetivamenteGasto,
  calcularPercentualEfetivamenteInvestido,
  calcularResultadoBancario,
  calcularReceitas,
  calcularSaidasBancarias,
  calcularSaldoOperacional,
  calcularValorDestinadoInvestimentos,
} from '../domain/finance'
import type { MovimentacaoFinanceira } from '../domain/transactions'

export type MonthPeriod = 'past' | 'current' | 'future'

export interface MonthSummary {
  readonly period: MonthPeriod
  readonly movements: readonly MovimentacaoFinanceira[]
  readonly bankingEntries: number
  readonly bankingExits: number
  readonly bankingResult: number
  readonly faturamento: number
  readonly receita: number
  readonly expenses: number
  /** Faturamento menos gastos no período. */
  readonly profit: number
  /** Aplicações brutas no período. */
  readonly applications: number
  /** Resgates brutos no período. */
  readonly investmentRedemptions: number
  /** Investimentos líquidos: aplicações menos resgates. */
  readonly investments: number
  readonly percentualEfetivamenteGasto: number | null
  readonly percentualEfetivamenteInvestido: number | null
  readonly accumulationIndex: number | null
}

export interface OperationalMonthSummary {
  readonly investmentPercentage: number
  readonly investmentAllocation: number
  readonly operationalPercentage: number
  readonly operationalBudget: number
  readonly realizedExpenses: number
  readonly operationalBalance: number
  readonly remainingDays: number | null
  readonly currentDailySpendingTarget: number | null
}

const monthKey = (year: number, month: number) => year * 12 + month

export function selectMovementsForMonth(
  movements: readonly MovimentacaoFinanceira[],
  year: number,
  month: number,
  today = new Date(),
): { period: MonthPeriod; movements: readonly MovimentacaoFinanceira[] } {
  const selectedKey = monthKey(year, month)
  const currentKey = monthKey(today.getFullYear(), today.getMonth() + 1)
  const period: MonthPeriod = selectedKey < currentKey ? 'past' : selectedKey > currentKey ? 'future' : 'current'
  if (period === 'future') return { period, movements: [] }

  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return {
    period,
    movements: movements.filter((movement) =>
      movement.data.startsWith(prefix) && (period === 'past' || movement.data <= todayIso)
    ),
  }
}

/** Compõe o resumo chamando exclusivamente os cálculos do domínio. */
export function createMonthSummary(
  movements: readonly MovimentacaoFinanceira[],
  year: number,
  month: number,
  today = new Date(),
): MonthSummary | null {
  const selected = selectMovementsForMonth(movements, year, month, today)
  if (selected.period === 'future') return null

  return {
    period: selected.period,
    movements: selected.movements,
    bankingEntries: calcularEntradasBancarias(selected.movements),
    bankingExits: calcularSaidasBancarias(selected.movements),
    bankingResult: calcularResultadoBancario(selected.movements),
    faturamento: calcularFaturamento(selected.movements),
    receita: calcularReceitas(selected.movements),
    expenses: calcularGastos(selected.movements),
    profit: calcularLucro(selected.movements),
    applications: calcularAplicacoes(selected.movements),
    investmentRedemptions: calcularResgatesInvestimento(selected.movements),
    investments: calcularInvestimentos(selected.movements),
    percentualEfetivamenteGasto: calcularPercentualEfetivamenteGasto(selected.movements),
    percentualEfetivamenteInvestido: calcularPercentualEfetivamenteInvestido(selected.movements),
    accumulationIndex: calcularIndiceAcumulacao(selected.movements),
  }
}

/** Lucro realizado no ano, limitado até hoje quando o ano é o atual. */
export function createYearProfit(
  movements: readonly MovimentacaoFinanceira[],
  year: number,
  today = new Date(),
): number | null {
  if (year > today.getFullYear()) return null

  const prefix = `${year}-`
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const selected = movements.filter((movement) =>
    movement.data.startsWith(prefix) && (year < today.getFullYear() || movement.data <= todayIso)
  )
  return calcularLucro(selected)
}

export function createOperationalMonthSummary(
  summary: MonthSummary | null,
  investmentPercentage: number,
  today = new Date(),
): OperationalMonthSummary | null {
  if (summary === null) return null
  const remainingDays = summary.period === 'current'
    ? calcularDiasRestantesAtePrimeiroDiaUtilProximoMes(today)
    : null

  return {
    investmentPercentage,
    investmentAllocation: calcularValorDestinadoInvestimentos(summary.movements, investmentPercentage),
    operationalPercentage: calcularPercentualOperacional(investmentPercentage),
    operationalBudget: calcularOrcamentoOperacional(summary.movements, investmentPercentage),
    realizedExpenses: calcularGastos(summary.movements),
    operationalBalance: calcularSaldoOperacional(summary.movements, investmentPercentage),
    remainingDays,
    currentDailySpendingTarget: remainingDays === null
      ? null
      : calcularMetaDiariaAtualDeGasto(summary.movements, investmentPercentage, remainingDays),
  }
}
