// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { calcularIndiceAcumulacao } from '../../domain/finance'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { MonthScreen } from '../App'

const today = new Date(2026, 7, 14, 12)
const label = 'Ver memória de cálculo do Índice de acumulação'
const movement = (id: string, value: number, classification: 'gasto' | 'investimento'): MovimentacaoFinanceira => ({
  id, data: '2026-08-10', valorEmCentavos: value, tipoBancario: 'saida', classificacaoFinanceira: classification, dadosOriginais: { Descrição: id },
})
const base = [movement('Aporte', 6_000, 'investimento'), movement('Aluguel', 4_000, 'gasto')]

describe('memória de cálculo do índice de acumulação', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove() })
  const render = async (movements: readonly MovimentacaoFinanceira[]) => act(async () => root.render(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />))
  const trigger = () => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
  const open = async () => act(async () => trigger()?.click())

  it('abre com totais, resultado do domínio, percentual, frase e período', async () => {
    await render(base); await open()
    const text = container.querySelector('[role="dialog"]')?.textContent
    expect(text).toContain('Memória de cálculo do Índice de acumulação')
    expect(text).toContain('Investimentos líquidos acumuladosR$\u00a060,00')
    expect(text).toContain('Gastos acumuladosR$\u00a040,00')
    expect(text).toContain(`Índice de acumulação${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(calcularIndiceAcumulacao(base) ?? 0)}`)
    expect(text).toContain('Índice em percentual150,00%')
    expect(text).toContain('Você investiu R$ 1,50 para cada R$ 1,00 gasto.')
    expect(text).toContain('1º de agosto de 2026 até 14/08/2026')
    expect(text).toContain('> 1 → investiu mais do que gastou')
    expect(text).toContain('= 1 → investiu o mesmo que gastou')
    expect(text).toContain('< 1 → gastou mais do que investiu')
  })

  it('apresenta corretamente índices igual e menor que um', async () => {
    await render([movement('Aporte', 4_000, 'investimento'), movement('Aluguel', 4_000, 'gasto')]); await open()
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Índice de acumulação1,00')
    await render([movement('Aporte', 2_000, 'investimento'), movement('Aluguel', 4_000, 'gasto')])
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Índice de acumulação0,50')
  })

  it('preserva o estado indisponível quando não existem gastos', async () => {
    await render([movement('Aporte', 6_000, 'investimento')]); expect(trigger()?.textContent).toBe('—'); await open()
    const text = container.querySelector('[role="dialog"]')?.textContent
    expect(text).toContain('Gastos acumuladosR$\u00a00,00')
    expect(text).toContain('Índice de acumulação—')
    expect(text).toContain('não existem gastos no período')
  })

  it('atualiza imediatamente depois de uma reclassificação', async () => {
    await render(base); await open()
    const changed = base.map((item) => item.id === 'Aporte' ? { ...item, classificacaoFinanceira: 'gasto' as const } : item)
    await render(changed)
    const text = container.querySelector('[role="dialog"]')?.textContent
    expect(text).toContain('Investimentos líquidos acumuladosR$\u00a00,00')
    expect(text).toContain('Gastos acumuladosR$\u00a0100,00')
    expect(text).toContain('Índice de acumulação0,00')
  })

  it('reutiliza os detalhamentos de investimentos e gastos', async () => {
    await render(base); await open()
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('movimentações dos investimentos'))?.click())
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Aporte')
    expect(container.querySelector('[role="dialog"]')?.textContent).not.toContain('Aluguel')
    await act(async () => container.querySelector<HTMLButtonElement>('.primary-button')?.click())
    await open()
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('movimentações dos gastos'))?.click())
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Aluguel')
  })

  it('fecha por Escape, backdrop e botão, devolve foco e preserva a ajuda', async () => {
    await render(base); const origin = trigger(); origin?.focus(); await open()
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(document.activeElement).toBe(origin)
    await open(); await act(async () => container.querySelector<HTMLElement>('.modal-backdrop')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    await open(); await act(async () => container.querySelector<HTMLButtonElement>('.calculation-detail-modal .primary-button')?.click())
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    const help = container.querySelector<HTMLButtonElement>('[aria-label="Ajuda sobre Índice de acumulação do mês"]')
    await act(async () => help?.click()); expect(container.querySelector('.indicator-help__popover')).not.toBeNull()
  })
})
