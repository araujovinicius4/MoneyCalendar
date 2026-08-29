// @vitest-environment jsdom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { MonthScreen } from '../App'

const today = new Date(2026, 7, 15, 12)
const movements: readonly MovimentacaoFinanceira[] = [
  { id: 'faturamento', data: '2026-08-10', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  { id: 'expense', data: '2026-08-12', valorEmCentavos: 10_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: {} },
  { id: 'investment', data: '2026-08-13', valorEmCentavos: 20_000, tipoBancario: 'saida', classificacaoFinanceira: 'investimento', dadosOriginais: {} },
]

function ControlledMonthScreen() {
  const [percentage, setPercentage] = useState(0.8)
  return <MonthScreen
    year={2026}
    month={8}
    movements={movements}
    today={today}
    investmentPercentage={percentage}
    onInvestmentPercentageChange={setPercentage}
  />
}

const metricValue = (container: HTMLElement, label: string) => {
  const term = [...container.querySelectorAll('dt')].find((element) => element.textContent === label)
  return term?.nextElementSibling?.textContent
}

describe('alteração interativa do percentual de investimentos', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('recalcula somente os dependentes em 80% → 70% → 35% sem reload', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<ControlledMonthScreen />))

    const input = container.querySelector<HTMLInputElement>('input[aria-label="Percentual destinado a investimentos"]')
    expect(input?.value).toBe('80')
    expect(metricValue(container, 'Valor destinado a investimentos')).toBe('R$ 800,00')
    expect(metricValue(container, 'Percentual operacional')).toBe('20,00%')
    expect(metricValue(container, 'Orçamento operacional')).toBe('R$ 200,00')
    expect(metricValue(container, 'Saldo operacional')).toBe('R$ 100,00')
    expect(metricValue(container, 'Meta diária atual de gasto')).toBe('R$ 5,56')

    const independentBefore = {
      faturamento: metricValue(container, 'Faturamento acumulado'),
      percentualEfetivamenteGasto: metricValue(container, 'Gastos acumulados'),
      percentualEfetivamenteInvestido: metricValue(container, 'Investimentos líquidos acumulados'),
      realizedExpenses: metricValue(container, 'Gastos realizados'),
      investments: metricValue(container, 'Investimentos líquidos acumulados'),
      accumulationIndex: metricValue(container, 'Índice de acumulação do mês'),
      bankingEntries: metricValue(container, 'Entradas bancárias acumuladas'),
      bankingExits: metricValue(container, 'Saídas bancárias acumuladas'),
      bankingResult: metricValue(container, 'Resultado bancário acumulado'),
      remainingDays: container.querySelector('.remaining-days dd')?.textContent,
    }

    await act(async () => {
      if (!input) throw new Error('Campo de percentual não encontrado')
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(input, '70')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(input?.value).toBe('70')
    expect(metricValue(container, 'Valor destinado a investimentos')).toBe('R$ 700,00')
    expect(metricValue(container, 'Percentual operacional')).toBe('30,00%')
    expect(metricValue(container, 'Orçamento operacional')).toBe('R$ 300,00')
    expect(metricValue(container, 'Saldo operacional')).toBe('R$ 200,00')
    expect(metricValue(container, 'Meta diária atual de gasto')).toBe('R$ 11,11')

    expect({
      faturamento: metricValue(container, 'Faturamento acumulado'),
      percentualEfetivamenteGasto: metricValue(container, 'Gastos acumulados'),
      percentualEfetivamenteInvestido: metricValue(container, 'Investimentos líquidos acumulados'),
      realizedExpenses: metricValue(container, 'Gastos realizados'),
      investments: metricValue(container, 'Investimentos líquidos acumulados'),
      accumulationIndex: metricValue(container, 'Índice de acumulação do mês'),
      bankingEntries: metricValue(container, 'Entradas bancárias acumuladas'),
      bankingExits: metricValue(container, 'Saídas bancárias acumuladas'),
      bankingResult: metricValue(container, 'Resultado bancário acumulado'),
      remainingDays: container.querySelector('.remaining-days dd')?.textContent,
    }).toEqual(independentBefore)

    await act(async () => {
      if (!input) throw new Error('Campo de percentual não encontrado')
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(input, '35')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(input?.value).toBe('35')
    expect(metricValue(container, 'Valor destinado a investimentos')).toBe('R$ 350,00')
    expect(metricValue(container, 'Percentual operacional')).toBe('65,00%')
    expect(metricValue(container, 'Orçamento operacional')).toBe('R$ 650,00')
    expect(metricValue(container, 'Saldo operacional')).toBe('R$ 550,00')
    expect(metricValue(container, 'Meta diária atual de gasto')).toBe('R$ 30,56')
    expect({
      faturamento: metricValue(container, 'Faturamento acumulado'),
      percentualEfetivamenteGasto: metricValue(container, 'Gastos acumulados'),
      percentualEfetivamenteInvestido: metricValue(container, 'Investimentos líquidos acumulados'),
      realizedExpenses: metricValue(container, 'Gastos realizados'),
      investments: metricValue(container, 'Investimentos líquidos acumulados'),
      accumulationIndex: metricValue(container, 'Índice de acumulação do mês'),
      bankingEntries: metricValue(container, 'Entradas bancárias acumuladas'),
      bankingExits: metricValue(container, 'Saídas bancárias acumuladas'),
      bankingResult: metricValue(container, 'Resultado bancário acumulado'),
      remainingDays: container.querySelector('.remaining-days dd')?.textContent,
    }).toEqual(independentBefore)

    await act(async () => root.unmount())
  })
})
