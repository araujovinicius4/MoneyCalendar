import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  calcularEntradasBancarias,
  calcularFaturamento,
  calcularGastos,
  calcularReceitas,
  calcularSaidasBancarias,
} from '../../domain/finance'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { DayScreen, MonthScreen } from '../App'
import { createMonthSummary, createOperationalMonthSummary } from '../month-summary'
import { reclassifyMovementInMemory } from '../reclassify-movement'

const originalData = Object.freeze({
  valorOriginal: '100.00',
  descricaoOriginal: 'Pix recebido',
  identificadorExterno: 'pix-entrada',
  origem: 'nubank',
})
const movements: readonly MovimentacaoFinanceira[] = [
  { id: 'entrada', data: '2026-08-14', valorEmCentavos: 10_000, tipoBancario: 'entrada', classificacaoFinanceira: 'transferencia', dadosOriginais: originalData },
  { id: 'saida', data: '2026-08-14', valorEmCentavos: 4_000, tipoBancario: 'saida', classificacaoFinanceira: 'transferencia', dadosOriginais: { descricaoOriginal: 'Pix enviado' } },
]
const today = new Date(2026, 7, 14, 12)

describe('reclassificação manual em memória', () => {
  it('faz uma transferência de entrada passar a integrar o faturamento', () => {
    const reclassified = reclassifyMovementInMemory(movements, 'entrada', 'faturamento')
    expect(calcularFaturamento(movements)).toBe(0)
    expect(calcularFaturamento(reclassified)).toBe(10_000)
  })

  it('faz uma transferência de saída passar a integrar os gastos', () => {
    const reclassified = reclassifyMovementInMemory(movements, 'saida', 'gasto')
    expect(calcularGastos(movements)).toBe(0)
    expect(calcularGastos(reclassified)).toBe(4_000)
  })

  it('faz uma transferência de entrada passar a integrar receita sem virar faturamento', () => {
    const reclassified = reclassifyMovementInMemory(movements, 'entrada', 'receita')
    expect(calcularReceitas(reclassified)).toBe(10_000)
    expect(calcularFaturamento(reclassified)).toBe(0)
  })

  it('faturamento afeta indicadores operacionais, mas receita não', () => {
    const comoReceita = reclassifyMovementInMemory(movements, 'entrada', 'receita')
    const asBilling = reclassifyMovementInMemory(movements, 'entrada', 'faturamento')
    const originalSummary = createMonthSummary(movements, 2026, 8, today)
    const receitaSummary = createMonthSummary(comoReceita, 2026, 8, today)
    const billingSummary = createMonthSummary(asBilling, 2026, 8, today)
    const originalOperational = createOperationalMonthSummary(originalSummary, 0.8, today)
    const receitaOperational = createOperationalMonthSummary(receitaSummary, 0.8, today)
    const billingOperational = createOperationalMonthSummary(billingSummary, 0.8, today)

    expect(receitaOperational?.operationalBudget).toBe(originalOperational?.operationalBudget)
    expect(receitaOperational?.operationalBalance).toBe(originalOperational?.operationalBalance)
    expect(receitaOperational?.currentDailySpendingTarget).toBe(originalOperational?.currentDailySpendingTarget)
    expect(billingOperational?.operationalBudget).not.toBe(originalOperational?.operationalBudget)
    expect(billingOperational?.operationalBalance).not.toBe(originalOperational?.operationalBalance)
    expect(billingOperational?.currentDailySpendingTarget).not.toBe(originalOperational?.currentDailySpendingTarget)

    expect(calcularEntradasBancarias(comoReceita)).toBe(calcularEntradasBancarias(asBilling))
    expect(calcularSaidasBancarias(comoReceita)).toBe(calcularSaidasBancarias(asBilling))
  })

  it('não altera os totais nem os tipos bancários', () => {
    const reclassified = reclassifyMovementInMemory(
      reclassifyMovementInMemory(movements, 'entrada', 'faturamento'),
      'saida',
      'gasto',
    )
    expect(calcularEntradasBancarias(reclassified)).toBe(calcularEntradasBancarias(movements))
    expect(calcularSaidasBancarias(reclassified)).toBe(calcularSaidasBancarias(movements))
    expect(reclassified.map(({ tipoBancario }) => tipoBancario)).toEqual(['entrada', 'saida'])
  })

  it('preserva por referência todos os dados originais da movimentação', () => {
    const [reclassified] = reclassifyMovementInMemory(movements, 'entrada', 'faturamento')
    expect(reclassified.dadosOriginais).toBe(originalData)
    expect(reclassified.dadosOriginais).toEqual({
      valorOriginal: '100.00',
      descricaoOriginal: 'Pix recebido',
      identificadorExterno: 'pix-entrada',
      origem: 'nubank',
    })
    expect(reclassified).toMatchObject({ valorEmCentavos: 10_000, tipoBancario: 'entrada' })
  })

  it('atualiza os indicadores diários e mensais a partir da mesma coleção', () => {
    const reclassified = reclassifyMovementInMemory(
      reclassifyMovementInMemory(movements, 'entrada', 'faturamento'),
      'saida',
      'gasto',
    )
    const monthSummary = createMonthSummary(reclassified, 2026, 8, today)
    expect(monthSummary?.faturamento).toBe(10_000)
    expect(monthSummary?.expenses).toBe(4_000)

    const dayHtml = renderToStaticMarkup(<DayScreen year={2026} month={8} day={14} movements={reclassified} />)
    const monthHtml = renderToStaticMarkup(<MonthScreen year={2026} month={8} movements={reclassified} today={today} investmentPercentage={0.8} />)
    expect(dayHtml).toContain('Faturamento do dia</dt><dd class="financial-value--informational">R$ 100,00')
    expect(dayHtml).toContain('Gastos do dia</dt><dd class="financial-value--informational">R$ 40,00')
    expect(monthHtml).toContain('aria-label="Ver movimentações que compõem o faturamento acumulado">R$ 100,00')
    expect(monthHtml).toContain('aria-label="Ver movimentações que compõem os gastos acumulados">R$ 40,00')
  })

  it('exibe a classificação atual e todas as opções permitidas', () => {
    const html = renderToStaticMarkup(<DayScreen year={2026} month={8} day={14} movements={movements} />)
    for (const classification of ['faturamento', 'receita', 'gasto', 'investimento', 'transferencia', 'estorno', 'nao_classificado']) {
      expect(html).toContain(`value="${classification}"`)
    }
    expect(html).toContain('value="transferencia" selected=""')
  })
})
