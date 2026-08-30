// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { MonthScreen } from '../App'
import { MONTH_INDICATOR_HELP } from '../month-indicator-help'

const movements: readonly MovimentacaoFinanceira[] = [
  { id: 'billing', data: '2026-08-10', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  { id: 'expense', data: '2026-08-11', valorEmCentavos: 10_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: {} },
]
const today = new Date(2026, 7, 15, 12)

describe('ajuda contextual do resumo mensal', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => container.remove())

  it('centraliza conteúdo completo para todos os indicadores mensais', () => {
    expect(Object.keys(MONTH_INDICATOR_HELP)).toHaveLength(17)
    for (const help of Object.values(MONTH_INDICATOR_HELP)) {
      expect(help.meaning).not.toBe('')
      expect(help.calculation).not.toBe('')
      expect(help.includes).not.toBe('')
      expect(help.excludes).not.toBe('')
    }
    expect(MONTH_INDICATOR_HELP.remainingDays.includes).toContain('segunda a sexta-feira')
    expect(MONTH_INDICATOR_HELP.remainingDays.excludes).toContain('feriados')
  })

  it('abre e fecha a ajuda reutilizada ao clicar', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />))

    const button = container.querySelector<HTMLButtonElement>('[aria-label="Ajuda sobre Orçamento operacional"]')
    expect(container.querySelectorAll('.indicator-help__button')).toHaveLength(17)
    expect(button).not.toBeNull()
    expect(button?.getAttribute('aria-expanded')).toBe('false')
    expect(container.textContent).not.toContain(MONTH_INDICATOR_HELP.operationalBudget.meaning)

    await act(async () => button?.click())
    expect(button?.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.indicator-help__popover--viewport-safe')).not.toBeNull()
    expect(container.textContent).toContain(MONTH_INDICATOR_HELP.operationalBudget.meaning)
    expect(container.textContent).toContain(MONTH_INDICATOR_HELP.operationalBudget.calculation)

    await act(async () => button?.click())
    expect(button?.getAttribute('aria-expanded')).toBe('false')
    expect(container.textContent).not.toContain(MONTH_INDICATOR_HELP.operationalBudget.meaning)
    await act(async () => root.unmount())
  })
})
