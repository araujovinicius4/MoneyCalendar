import {
  calcularAplicacoes, calcularEntradasBancarias, calcularFaturamento, calcularGastos, calcularInvestimentos,
  calcularReceitas, calcularSaidasBancarias,
  calcularResgatesInvestimento,
  calcularResultadoBancario,
  calcularPercentualEfetivamenteGasto, calcularPercentualEfetivamenteInvestido,
} from '../domain/finance'
import type { ClassificacaoFinanceira, MovimentacaoFinanceira, TipoBancario } from '../domain/transactions'
import { selectMovementsForMonth, type MonthPeriod } from './month-summary'

export type DetailedAccumulatedIndicator =
  | 'bankingEntries' | 'bankingExits' | 'bankingResult'
  | 'faturamento' | 'receita' | 'gastos' | 'investimentos'

export type AccumulatedIndicatorCriterion =
  | { readonly kind: 'classificacaoFinanceira'; readonly value: ClassificacaoFinanceira }
  | { readonly kind: 'tipoBancario'; readonly value: TipoBancario }
  | { readonly kind: 'resultadoBancario' }
  | { readonly kind: 'investimentosLiquidos' }

interface AccumulatedIndicatorDefinition {
  readonly label: string
  readonly actionLabel: string
  readonly criterion: AccumulatedIndicatorCriterion
  readonly calculateTotal: (movements: readonly MovimentacaoFinanceira[]) => number
}

export const ACCUMULATED_INDICATOR_DEFINITIONS: Readonly<Record<DetailedAccumulatedIndicator, AccumulatedIndicatorDefinition>> = {
  bankingEntries: {
    label: 'Entradas bancárias acumuladas',
    actionLabel: 'Ver movimentações que compõem as entradas bancárias acumuladas',
    criterion: { kind: 'tipoBancario', value: 'entrada' }, calculateTotal: calcularEntradasBancarias,
  },
  bankingExits: {
    label: 'Saídas bancárias acumuladas',
    actionLabel: 'Ver movimentações que compõem as saídas bancárias acumuladas',
    criterion: { kind: 'tipoBancario', value: 'saida' }, calculateTotal: calcularSaidasBancarias,
  },
  bankingResult: {
    label: 'Resultado bancário acumulado',
    actionLabel: 'Ver composição do resultado bancário acumulado',
    criterion: { kind: 'resultadoBancario' }, calculateTotal: calcularResultadoBancario,
  },
  faturamento: {
    label: 'Faturamento acumulado',
    actionLabel: 'Ver movimentações que compõem o faturamento acumulado',
    criterion: { kind: 'classificacaoFinanceira', value: 'faturamento' }, calculateTotal: calcularFaturamento,
  },
  receita: {
    label: 'Receita acumulada',
    actionLabel: 'Ver movimentações que compõem a receita acumulada',
    criterion: { kind: 'classificacaoFinanceira', value: 'receita' }, calculateTotal: calcularReceitas,
  },
  gastos: {
    label: 'Gastos acumulados',
    actionLabel: 'Ver movimentações que compõem os gastos acumulados',
    criterion: { kind: 'classificacaoFinanceira', value: 'gasto' }, calculateTotal: calcularGastos,
  },
  investimentos: {
    label: 'Investimentos líquidos acumulados',
    actionLabel: 'Ver movimentações que compõem os investimentos líquidos acumulados',
    criterion: { kind: 'investimentosLiquidos' }, calculateTotal: calcularInvestimentos,
  },
}

export interface AccumulatedIndicatorDetail {
  readonly indicator: DetailedAccumulatedIndicator
  readonly label: string
  readonly criterion: AccumulatedIndicatorCriterion
  readonly period: MonthPeriod
  readonly movements: readonly MovimentacaoFinanceira[]
  readonly total: number
  readonly bankingComposition?: {
    readonly entries: number
    readonly exits: number
    readonly result: number
  }
  readonly investmentComposition?: {
    readonly applications: number
    readonly redemptions: number
    readonly netInvestments: number
  }
  readonly realizedPercentageComposition?: {
    readonly realizedLabel: string
    readonly realizedValue: number
    readonly faturamento: number
    readonly percentageLabel: string
    readonly percentage: number | null
    readonly formula: string
  }
}

export function createAccumulatedIndicatorDetail(
  movements: readonly MovimentacaoFinanceira[], year: number, month: number,
  indicator: DetailedAccumulatedIndicator, today = new Date(),
): AccumulatedIndicatorDetail | null {
  const selected = selectMovementsForMonth(movements, year, month, today)
  if (selected.period === 'future') return null

  const definition = ACCUMULATED_INDICATOR_DEFINITIONS[indicator]
  const criterion = definition.criterion
  const filteredMovements = criterion.kind === 'resultadoBancario'
    ? selected.movements
    : criterion.kind === 'investimentosLiquidos'
      ? selected.movements.filter((movement) => movement.classificacaoFinanceira === 'investimento' || movement.classificacaoFinanceira === 'resgate_investimento')
    : criterion.kind === 'classificacaoFinanceira'
      ? selected.movements.filter((movement) => movement.classificacaoFinanceira === criterion.value)
      : selected.movements.filter((movement) => movement.tipoBancario === criterion.value)
  const total = definition.calculateTotal(filteredMovements)
  return {
    indicator, label: definition.label, criterion: definition.criterion, period: selected.period,
    movements: filteredMovements, total,
    bankingComposition: criterion.kind === 'resultadoBancario' ? {
      entries: calcularEntradasBancarias(filteredMovements),
      exits: calcularSaidasBancarias(filteredMovements),
      result: total,
    } : undefined,
    investmentComposition: indicator === 'investimentos' ? {
      applications: calcularAplicacoes(selected.movements),
      redemptions: calcularResgatesInvestimento(selected.movements),
      netInvestments: total,
    } : undefined,
    realizedPercentageComposition: indicator === 'gastos' || indicator === 'investimentos' ? {
      realizedLabel: indicator === 'gastos' ? 'Gastos acumulados' : 'Investimentos líquidos acumulados',
      realizedValue: total,
      faturamento: calcularFaturamento(selected.movements),
      percentageLabel: indicator === 'gastos' ? 'Percentual efetivamente gasto' : 'Percentual efetivamente investido',
      percentage: indicator === 'gastos'
        ? calcularPercentualEfetivamenteGasto(selected.movements)
        : calcularPercentualEfetivamenteInvestido(selected.movements),
      formula: indicator === 'gastos'
        ? 'Percentual efetivamente gasto = Gastos acumulados ÷ Faturamento acumulado'
        : 'Percentual efetivamente investido = Investimentos líquidos acumulados ÷ Faturamento acumulado',
    } : undefined,
  }
}
