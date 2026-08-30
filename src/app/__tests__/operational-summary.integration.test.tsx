import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  calcularMetaDiariaAtualDeGasto,
  calcularOrcamentoOperacional,
  calcularSaldoOperacional,
  calcularValorDestinadoInvestimentos,
} from '../../domain/finance'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { MonthScreen } from '../App'
import { createMonthSummary, createOperationalMonthSummary } from '../month-summary'

const today = new Date(2026, 7, 14, 12)
const movements: readonly MovimentacaoFinanceira[] = [
  { id: 'faturamento', data: '2026-08-10', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  { id: 'expense', data: '2026-08-12', valorEmCentavos: 10_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: {} },
  { id: 'investment', data: '2026-08-13', valorEmCentavos: 20_000, tipoBancario: 'saida', classificacaoFinanceira: 'investimento', dadosOriginais: {} },
  { id: 'transfer', data: '2026-08-14', valorEmCentavos: 30_000, tipoBancario: 'saida', classificacaoFinanceira: 'transferencia', dadosOriginais: {} },
]

describe('indicadores operacionais mensais integrados', () => {
  const monthly = createMonthSummary(movements, 2026, 8, today)

  it('inicia com percentual de 80% e usa o domínio nos valores operacionais', () => {
    const operational = createOperationalMonthSummary(monthly, 0.8, today)
    expect(operational?.investmentAllocation).toBe(calcularValorDestinadoInvestimentos(movements, 0.8))
    expect(operational?.operationalBudget).toBe(calcularOrcamentoOperacional(movements, 0.8))
    expect(operational?.operationalBalance).toBe(calcularSaldoOperacional(movements, 0.8))
    const html = renderToStaticMarkup(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />)
    expect(html).toContain('value="80"')
    expect(html).toContain('aria-label="Ver memória de cálculo do valor destinado a investimentos">R$ 800,00')
    expect(html).toContain('aria-label="Ver memória de cálculo do orçamento operacional">R$ 200,00')
  })

  it('recalcula pelo domínio quando o percentual é alterado', () => {
    const operational = createOperationalMonthSummary(monthly, 0.5, today)
    expect(operational?.investmentAllocation).toBe(50_000)
    expect(operational?.operationalBudget).toBe(50_000)
    const html = renderToStaticMarkup(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.5} />)
    expect(html).toContain('value="50"')
    expect(html).toContain('aria-label="Ver memória de cálculo do orçamento operacional">R$ 500,00')
  })

  it('reage imediatamente a 80%, 70% e 35% sem alterar indicadores independentes', () => {
    const at80 = createOperationalMonthSummary(monthly, 0.8, today)
    const at70 = createOperationalMonthSummary(monthly, 0.7, today)
    const at35 = createOperationalMonthSummary(monthly, 0.35, today)
    expect(monthly).not.toBeNull()
    expect(at80).not.toBeNull()
    expect(at70).not.toBeNull()
    expect(at35).not.toBeNull()
    if (!monthly || !at80 || !at70 || !at35) return

    expect([at80.investmentAllocation, at70.investmentAllocation, at35.investmentAllocation]).toEqual([80_000, 70_000, 35_000])
    expect(at80.operationalPercentage).toBeCloseTo(0.2)
    expect(at70.operationalPercentage).toBeCloseTo(0.3)
    expect(at35.operationalPercentage).toBeCloseTo(0.65)
    expect(at80.operationalBudget).toBeCloseTo(20_000)
    expect(at70.operationalBudget).toBeCloseTo(30_000)
    expect(at35.operationalBudget).toBeCloseTo(65_000)
    expect(at80.operationalBalance).toBeCloseTo(10_000)
    expect(at70.operationalBalance).toBeCloseTo(20_000)
    expect(at35.operationalBalance).toBeCloseTo(55_000)
    expect(at80.currentDailySpendingTarget).not.toBe(at70.currentDailySpendingTarget)
    expect(at70.currentDailySpendingTarget).not.toBe(at35.currentDailySpendingTarget)

    expect(at80.realizedExpenses).toBe(at70.realizedExpenses)
    expect(at70.realizedExpenses).toBe(at35.realizedExpenses)
    expect(at80.remainingDays).toBe(at70.remainingDays)
    expect(at70.remainingDays).toBe(at35.remainingDays)
    expect(monthly.faturamento).toBe(100_000)
    expect(monthly.expenses).toBe(10_000)
    expect(monthly.investments).toBe(20_000)
    expect(monthly.bankingEntries).toBe(100_000)
    expect(monthly.bankingExits).toBe(60_000)
    expect(monthly.bankingResult).toBe(40_000)
    expect(monthly.accumulationIndex).toBe(2)

    const html70 = renderToStaticMarkup(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.7} />)
    const html35 = renderToStaticMarkup(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.35} />)
    expect(html70).toContain('value="70"')
    expect(html70).toContain('Percentual operacional</dt><dd class="financial-value--informational">30,00%')
    expect(html70).toContain('aria-label="Ver memória de cálculo do orçamento operacional">R$ 300,00')
    expect(html35).toContain('value="35"')
    expect(html35).toContain('Percentual operacional</dt><dd class="financial-value--informational">65,00%')
    expect(html35).toContain('aria-label="Ver memória de cálculo do orçamento operacional">R$ 650,00')
  })

  it('calcula saldo e meta diária com os dias restantes fornecidos pelo domínio', () => {
    const operational = createOperationalMonthSummary(monthly, 0.8, today)
    expect(operational?.remainingDays).toBe(19)
    expect(operational?.operationalBalance).toBeCloseTo(10_000)
    expect(operational?.currentDailySpendingTarget).toBe(calcularMetaDiariaAtualDeGasto(movements, 0.8, 19))
    const html = renderToStaticMarkup(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />)
    expect(html).toContain('19 dias restantes')
    expect(html).toContain('Meta diária atual de gasto')
  })

  it('não exibe meta diária em meses passados nem indicadores em meses futuros', () => {
    const pastHtml = renderToStaticMarkup(<MonthScreen year={2026} month={7} movements={movements} today={today} investmentPercentage={0.8} />)
    const futureHtml = renderToStaticMarkup(<MonthScreen year={2026} month={9} movements={movements} today={today} investmentPercentage={0.8} />)
    expect(pastHtml).toContain('Nenhuma movimentação neste mês.')
    expect(pastHtml).not.toContain('Planejamento operacional')
    expect(pastHtml).not.toContain('Meta diária atual de gasto')
    expect(futureHtml).not.toContain('Planejamento operacional')
  })

  it('mantém faturamento zerado quando existem apenas entradas não classificadas como faturamento', () => {
    const semFaturamento: readonly MovimentacaoFinanceira[] = [
      { id: 'entry', data: '2026-08-10', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'transferencia', dadosOriginais: {} },
    ]
    const summary = createMonthSummary(semFaturamento, 2026, 8, today)
    const operational = createOperationalMonthSummary(summary, 0.8, today)
    expect(operational?.investmentAllocation).toBe(0)
    expect(operational?.operationalBudget).toBe(0)
  })

  it('preserva saldo operacional e meta diária negativos', () => {
    const deficit: readonly MovimentacaoFinanceira[] = [
      { id: 'faturamento', data: '2026-08-10', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
      { id: 'expense', data: '2026-08-11', valorEmCentavos: 30_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: {} },
    ]
    const operational = createOperationalMonthSummary(createMonthSummary(deficit, 2026, 8, today), 0.8, today)
    expect(operational?.operationalBalance).toBeCloseTo(-10_000)
    expect(operational?.currentDailySpendingTarget).toBeLessThan(0)
    const html = renderToStaticMarkup(<MonthScreen year={2026} month={8} movements={deficit} today={today} investmentPercentage={0.8} />)
    expect(html).toContain('aria-label="Ver memória de cálculo do saldo operacional">-R$ 100,00')
  })
})
