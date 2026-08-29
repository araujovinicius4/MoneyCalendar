// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { saveMovements, STORAGE_KEYS } from '../../infrastructure/storage'
import { App } from '../App'
import { createManualMovement } from '../manual-movement'

const findButton = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(text))

describe('primeiro uso e estados vazios', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    localStorage.clear()
    container.remove()
  })

  it('orienta o primeiro uso e mantém os 12 meses navegáveis sem zeros financeiros', async () => {
    window.history.replaceState(null, '', '/calendario/2026')
    await act(async () => root.render(<App />))

    expect(container.textContent).toContain('Comece com suas movimentações')
    expect(container.textContent).toContain('Importe um CSV ou adicione movimentações manualmente')
    expect(container.textContent).toContain('faturamento, receita, gasto, investimento, transferência ou estorno')
    expect(findButton(container, 'Importar CSV')).toBeDefined()
    expect(findButton(container, 'Adicionar movimentação manual')).toBeDefined()
    expect(container.querySelectorAll('.mini-calendar')).toHaveLength(12)
    expect(container.querySelector('[href="/calendario/2026/8"]')).not.toBeNull()
    expect(container.querySelectorAll('.mini-calendar__finance')).toHaveLength(0)
    expect(container.textContent).toContain('Ainda não existem movimentações')
  })

  it('preserva o calendário mensal e substitui totais zerados por um estado vazio acionável', async () => {
    window.history.replaceState(null, '', '/calendario/2026/8')
    await act(async () => root.render(<App />))

    expect(container.querySelector('[aria-label="Agosto de 2026"]')).not.toBeNull()
    expect(container.querySelector('[href="/calendario/2026/8/15"]')).not.toBeNull()
    expect(container.textContent).toContain('Resumo do mês')
    expect(container.textContent).toContain('Nenhuma movimentação neste mês.')
    expect(container.textContent).not.toContain('Entradas bancárias acumuladas')
    expect(findButton(container, 'Importar CSV')).toBeDefined()
    expect(findButton(container, 'Adicionar movimentação')).toBeDefined()
  })

  it('mantém data, navegação, cadastro e importação acessíveis no dia vazio', async () => {
    window.history.replaceState(null, '', '/calendario/2026/8/15')
    await act(async () => root.render(<App />))

    expect(container.textContent).toContain('sábado, 15 de agosto de 2026')
    expect(container.textContent).toContain('Nenhuma movimentação neste dia')
    expect(findButton(container, 'Nova movimentação')).toBeDefined()
    expect(container.querySelector('.transactions-empty .empty-import-button')).not.toBeNull()
    expect(container.querySelector('[aria-label="Dia anterior"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Próximo dia"]')).not.toBeNull()
  })

  it('fecha a orientação por teclado/click e não a reapresenta após nova inicialização', async () => {
    window.history.replaceState(null, '', '/calendario/2026')
    await act(async () => root.render(<App />))
    const close = container.querySelector<HTMLButtonElement>('[aria-label="Fechar orientação inicial"]')
    expect(close).not.toBeNull()
    await act(async () => close?.click())
    expect(container.textContent).not.toContain('Comece com suas movimentações')
    expect(localStorage.getItem(STORAGE_KEYS.onboardingDismissed)).toBe('true')

    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(<App />))
    expect(container.textContent).not.toContain('Comece com suas movimentações')
    expect(container.querySelectorAll('.mini-calendar')).toHaveLength(12)
  })

  it('não exibe estados vazios indevidos quando existem movimentações no período', async () => {
    const movement = createManualMovement({
      date: '2026-08-15', description: 'Movimentação existente', value: '100.00',
      bankingType: 'entrada', financialClassification: 'faturamento',
    }, () => 'manual:existing')
    saveMovements([movement])
    window.history.replaceState(null, '', '/calendario/2026/8/15')
    await act(async () => root.render(<App />))

    expect(container.textContent).toContain('Movimentação existente')
    expect(container.textContent).not.toContain('Comece com suas movimentações')
    expect(container.textContent).not.toContain('Nenhuma movimentação neste dia')
    expect(container.textContent).toContain('Faturamento do dia')
    expect(container.textContent).toContain('R$ 100,00')
  })
})
