// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import csvAnonimizado from '../../../NU_83369665_01AGO2026_06AGO2026.anonimizado.csv?raw'
import { loadImportHistory, loadMovements, saveMovements, STORAGE_KEYS } from '../../infrastructure/storage'
import { App } from '../App'
import { createManualMovement } from '../manual-movement'

const csv = [
  'Data,Valor,Identificador,Descrição',
  '10/08/2026,-100.00,IMPORT-1,Compra no débito',
].join('\n')

const findButton = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(text))

async function selectCsv(container: HTMLElement, contents = csv, name = 'lote-agosto.csv') {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('Seletor não encontrado')
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name, text: async () => contents }] })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const setSelect = (select: HTMLSelectElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('histórico e reversão pela interface', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    window.history.replaceState(null, '', '/calendario/2026/8/10')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await act(async () => root.unmount())
    localStorage.clear()
    container.remove()
  })

  it('registra, restaura e reverte um lote com confirmação de reclassificação', async () => {
    const manual = createManualMovement({
      date: '2026-08-09', description: 'Manual preservada', value: '20.00',
      bankingType: 'entrada', financialClassification: 'receita',
    }, () => 'manual:preservada')
    saveMovements([manual])
    await act(async () => root.render(<App />))

    await act(async () => findButton(container, 'Importar CSV')?.click())
    await selectCsv(container)
    await act(async () => findButton(container, 'Confirmar importação')?.click())
    expect(loadImportHistory()).toHaveLength(1)
    expect(loadImportHistory()[0]).toMatchObject({
      fileName: 'lote-agosto.csv', recognizedMovements: 1, addedCount: 1,
      ignoredExistingCount: 0, preservedManualCount: 1, status: 'ativo',
    })
    expect(loadImportHistory()[0].addedMovementIds).toHaveLength(1)
    await act(async () => findButton(container, 'Fechar e continuar')?.click())

    expect(container.textContent).toContain('Gastos do dia')
    expect(container.textContent).toContain('R$ 100,00')
    const classification = container.querySelector<HTMLSelectElement>('[aria-label="Classificação financeira de Compra no débito"]')
    if (!classification) throw new Error('Classificação não encontrada')
    await act(async () => setSelect(classification, 'investimento'))

    await act(async () => findButton(container, 'Histórico')?.click())
    expect(container.textContent).toContain('Histórico de importações')
    expect(container.textContent).toContain('lote-agosto.csv')
    expect(container.textContent).toContain('1 adicionadas')
    expect(container.textContent).toContain('0 ignoradas')
    expect(container.textContent).toContain('Ativa')

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await act(async () => findButton(container, 'Reverter importação')?.click())
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0][0]).toContain('1 movimentações serão removidas')
    expect(confirm.mock.calls[0][0]).toContain('Movimentações manuais não serão afetadas')
    expect(confirm.mock.calls[0][0]).toContain('1 movimentações foram reclassificadas')
    expect(container.textContent).toContain('Revertida')
    expect(findButton(container, 'Reverter importação')).toBeUndefined()
    expect(loadImportHistory()[0].status).toBe('revertido')
    expect(loadMovements()).toEqual([manual])

    await act(async () => findButton(container, 'Fechar')?.click())
    expect(container.textContent).toContain('Nenhuma movimentação neste dia')
    expect(container.textContent).toContain('Gastos do dia')
    expect(container.textContent).toContain('R$ 0,00')

    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(<App />))
    await act(async () => findButton(container, 'Histórico')?.click())
    expect(container.textContent).toContain('lote-agosto.csv')
    expect(container.textContent).toContain('Revertida')
  })

  it('exibe o lote ativo após confirmar, restaura no reload e mantém o lote revertido no histórico', async () => {
    await act(async () => root.render(<App />))

    await act(async () => container.querySelector<HTMLButtonElement>('.topbar-import')?.click())
    await selectCsv(container, csvAnonimizado, 'agosto-anonimizado.csv')
    await act(async () => findButton(container, 'Confirmar importação')?.click())
    const activeBatch = loadImportHistory()[0]
    const persistedAfterImport = JSON.parse(localStorage.getItem(STORAGE_KEYS.movements) ?? '[]') as Array<{ id: string }>
    expect(activeBatch.addedMovementIds.length).toBeGreaterThan(0)
    expect(activeBatch.addedMovementIds.every((id) => persistedAfterImport.some((movement) => movement.id === id))).toBe(true)
    await act(async () => findButton(container, 'Fechar e continuar')?.click())

    await act(async () => container.querySelector<HTMLButtonElement>('.topbar-history')?.click())
    expect(container.querySelectorAll('.history-item')).toHaveLength(1)
    expect(container.textContent).toContain('agosto-anonimizado.csv')
    expect(container.textContent).toContain('Ativa')

    await act(async () => findButton(container, 'Fechar')?.click())
    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(<App />))

    await act(async () => container.querySelector<HTMLButtonElement>('.topbar-history')?.click())
    expect(container.querySelectorAll('.history-item')).toHaveLength(1)
    expect(container.textContent).toContain('agosto-anonimizado.csv')
    expect(container.textContent).toContain('Ativa')

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await act(async () => findButton(container, 'Reverter importação')?.click())
    expect(container.querySelectorAll('.history-item')).toHaveLength(1)
    expect(container.textContent).toContain('Revertida')
    expect(findButton(container, 'Reverter importação')).toBeUndefined()
    const persistedAfterReversal = JSON.parse(localStorage.getItem(STORAGE_KEYS.movements) ?? '[]') as Array<{ id: string }>
    expect(activeBatch.addedMovementIds.every((id) => !persistedAfterReversal.some((movement) => movement.id === id))).toBe(true)
    expect(loadMovements()).toEqual([])

    localStorage.setItem('moneycalendar:v1:movements', JSON.stringify(persistedAfterImport))

    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(<App />))
    await act(async () => container.querySelector<HTMLButtonElement>('.topbar-history')?.click())
    expect(container.querySelectorAll('.history-item')).toHaveLength(1)
    expect(container.textContent).toContain('agosto-anonimizado.csv')
    expect(container.textContent).toContain('Revertida')
    expect(loadMovements()).toEqual([])
    expect(container.textContent).toContain('Nenhuma movimentação neste dia')
  })

  it('não reverte quando a confirmação é cancelada', async () => {
    await act(async () => root.render(<App />))
    await act(async () => findButton(container, 'Importar CSV')?.click())
    await selectCsv(container)
    await act(async () => findButton(container, 'Confirmar importação')?.click())
    await act(async () => findButton(container, 'Fechar e continuar')?.click())
    await act(async () => findButton(container, 'Histórico')?.click())
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await act(async () => findButton(container, 'Reverter importação')?.click())
    expect(loadMovements()).toHaveLength(1)
    expect(loadImportHistory()[0].status).toBe('ativo')
    expect(container.textContent).toContain('Ativa')
  })
})
