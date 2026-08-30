// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { DayScreen } from '../App'
import { DAY_INDICATOR_HELP } from '../day-indicator-help'

const movements: readonly MovimentacaoFinanceira[] = [
  { id: 'entry', data: '2026-08-15', valorEmCentavos: 10_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: { descricao: 'Venda' } },
  { id: 'expense', data: '2026-08-15', valorEmCentavos: 2_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: { descricao: 'Despesa' } },
]

describe('ajuda contextual dos indicadores diários', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => container.remove())

  it('mantém uma configuração central completa para todos os indicadores', () => {
    expect(Object.keys(DAY_INDICATOR_HELP)).toHaveLength(9)
    for (const help of Object.values(DAY_INDICATOR_HELP)) {
      expect(help.meaning).not.toBe('')
      expect(help.calculation).not.toBe('')
      expect(help.includes).not.toBe('')
      expect(help.excludes).not.toBe('')
    }
  })

  it('abre e fecha a explicação pelo ícone de ajuda', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<DayScreen year={2026} month={8} day={15} movements={movements} />))

    const buttons = container.querySelectorAll<HTMLButtonElement>('.indicator-help__button')
    expect(buttons).toHaveLength(9)
    const entryHelp = buttons[0]
    expect(entryHelp.getAttribute('aria-expanded')).toBe('false')
    expect(container.textContent).not.toContain(DAY_INDICATOR_HELP.bankingEntries.meaning)

    await act(async () => entryHelp.click())
    expect(entryHelp.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.indicator-help__popover--viewport-safe')).not.toBeNull()
    expect(container.textContent).toContain(DAY_INDICATOR_HELP.bankingEntries.meaning)
    expect(container.textContent).toContain(DAY_INDICATOR_HELP.bankingEntries.calculation)
    expect(container.textContent).toContain(DAY_INDICATOR_HELP.bankingEntries.includes)
    expect(container.textContent).toContain(DAY_INDICATOR_HELP.bankingEntries.excludes)

    await act(async () => entryHelp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(entryHelp.getAttribute('aria-expanded')).toBe('false')
    expect(container.textContent).not.toContain(DAY_INDICATOR_HELP.bankingEntries.meaning)

    await act(async () => entryHelp.click())
    await act(async () => entryHelp.click())
    expect(entryHelp.getAttribute('aria-expanded')).toBe('false')
    expect(container.textContent).not.toContain(DAY_INDICATOR_HELP.bankingEntries.meaning)
    await act(async () => root.unmount())
  })

})
