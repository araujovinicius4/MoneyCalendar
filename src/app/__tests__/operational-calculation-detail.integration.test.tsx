// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { MonthScreen } from '../App'

const today = new Date(2026, 7, 14, 12)
const movements: readonly MovimentacaoFinanceira[] = [
  { id: 'billing', data: '2026-08-10', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  { id: 'expense', data: '2026-08-12', valorEmCentavos: 30_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: { Descrição: 'Aluguel' } },
]

const labels = {
  investmentAllocation: 'Ver memória de cálculo do valor destinado a investimentos',
  operationalBudget: 'Ver memória de cálculo do orçamento operacional',
  operationalBalance: 'Ver memória de cálculo do saldo operacional',
  dailyTarget: 'Ver memória de cálculo da meta diária atual de gasto',
} as const

describe('memória de cálculo operacional', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove() })
  const render = async (percentage = 0.8, items = movements) => act(async () => root.render(<MonthScreen year={2026} month={8} movements={items} today={today} investmentPercentage={percentage} />))
  const open = async (id: keyof typeof labels) => act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${labels[id]}"]`)?.click())

  it('mostra faturamento, percentual e resultado exato da destinação a investimentos', async () => {
    await render(); const trigger = container.querySelector<HTMLButtonElement>(`[aria-label="${labels.investmentAllocation}"]`); trigger?.focus(); await open('investmentAllocation')
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('Faturamento acumuladoR$\u00a01.000,00')
    expect(dialog?.textContent).toContain('Percentual destinado a investimentos80,00%')
    expect(dialog?.textContent).toContain('Valor destinado a investimentosR$\u00a0800,00')
    expect(dialog?.textContent).toContain('1º de agosto de 2026 até 14/08/2026')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(document.activeElement).toBe(trigger)
  })

  it('mostra todos os componentes do orçamento e se atualiza com o percentual', async () => {
    await render(0.8); await open('operationalBudget')
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Percentual operacional20,00%')
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Orçamento operacionalR$\u00a0200,00')
    await render(0.5)
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Percentual operacional50,00%')
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Orçamento operacionalR$\u00a0500,00')
  })

  it('mostra saldo, gastos e reutiliza o detalhamento das movimentações', async () => {
    await render(); await open('operationalBalance')
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('Orçamento operacionalR$\u00a0200,00')
    expect(dialog?.textContent).toContain('Gastos realizadosR$\u00a0300,00')
    expect(dialog?.textContent).toContain('Saldo operacional-R$\u00a0100,00')
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Ver movimentações'))?.click())
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Aluguel')
  })

  it('preserva meta negativa, explica o déficit e apresenta dias e regra de dia útil', async () => {
    await render(); await open('dailyTarget')
    const text = container.querySelector('[role="dialog"]')?.textContent
    expect(text).toContain('Saldo operacional-R$\u00a0100,00')
    expect(text).toContain('Dias restantes19 dias')
    expect(text).toContain('Meta diária atual de gasto-R$\u00a05,26')
    expect(text).toContain('orçamento operacional já foi ultrapassado')
    expect(text).toContain('segunda a sexta-feira, sem considerar feriados')
  })

  it('fecha por backdrop e botão e mantém a ajuda contextual', async () => {
    await render(); expect(container.querySelector('[aria-label="Ajuda sobre Saldo operacional"]')).not.toBeNull()
    await open('operationalBalance')
    await act(async () => container.querySelector<HTMLElement>('.modal-backdrop')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    await open('dailyTarget')
    await act(async () => container.querySelector<HTMLButtonElement>('.calculation-detail-modal .primary-button')?.click())
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('recalcula a memória aberta quando uma reclassificação muda faturamento ou gastos', async () => {
    await render(); await open('operationalBalance')
    const reclassified = movements.map((item) => item.id === 'expense' ? { ...item, classificacaoFinanceira: 'investimento' as const } : item)
    await render(0.8, reclassified)
    const text = container.querySelector('[role="dialog"]')?.textContent
    expect(text).toContain('Gastos realizadosR$\u00a00,00')
    expect(text).toContain('Saldo operacionalR$\u00a0200,00')
  })
})
