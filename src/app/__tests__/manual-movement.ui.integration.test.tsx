// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '../../infrastructure/storage'
import { App } from '../App'

const setInput = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

const setSelect = (select: HTMLSelectElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('cadastro manual pela interface', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    window.history.replaceState(null, '', '/calendario/2026/8/15')
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    container.remove()
  })

  it('abre o modal, salva, recalcula e persiste a nova movimentação', async () => {
    const root = createRoot(container)
    await act(async () => root.render(<App />))

    const newButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Nova movimentação'))
    await act(async () => newButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe('2026-08-15')
    const textInputs = dialog?.querySelectorAll<HTMLInputElement>('input:not([type="date"]):not([type="time"])')
    const selects = dialog?.querySelectorAll<HTMLSelectElement>('select')

    await act(async () => {
      if (!textInputs || !selects) throw new Error('Campos do formulário não encontrados')
      setInput(textInputs[0], 'Serviço manual')
      setInput(textInputs[1], '123,45')
      setSelect(selects[0], 'entrada')
      setSelect(selects[1], 'faturamento')
    })
    const saveButton = [...(dialog?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.includes('Salvar movimentação'))
    await act(async () => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.textContent).toContain('Serviço manual')
    expect(container.textContent).toContain('R$ 123,45')
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.movements) ?? '[]') as Array<Record<string, unknown>>
    expect(persisted).toHaveLength(1)
    expect(persisted[0]).toMatchObject({
      data: '2026-08-15', valorEmCentavos: 12_345,
      tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento',
      dadosOriginais: { origem: 'manual', descricaoOriginal: 'Serviço manual', valorOriginal: '123.45' },
    })
    expect(container.querySelector('.transaction-row--entrada')).not.toBeNull()
    expect(container.querySelector('[aria-label="Editar Serviço manual"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Excluir Serviço manual"]')).not.toBeNull()

    const originalId = persisted[0].id
    const editButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Editar')
    await act(async () => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    const editDialog = container.querySelector<HTMLElement>('[role="dialog"]')
    const editInputs = editDialog?.querySelectorAll<HTMLInputElement>('input:not([type="date"]):not([type="time"])')
    await act(async () => {
      if (!editInputs) throw new Error('Campos de edição não encontrados')
      setInput(editInputs[0], 'Serviço editado')
      setInput(editInputs[1], '200,00')
    })
    const editSaveButton = [...(editDialog?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.includes('Salvar alterações'))
    await act(async () => editSaveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    const editedPersisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.movements) ?? '[]') as Array<Record<string, unknown>>
    expect(editedPersisted[0]).toMatchObject({ id: originalId, valorEmCentavos: 20_000, dadosOriginais: { descricaoOriginal: 'Serviço editado' } })
    expect(container.textContent).toContain('Serviço editado')

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const deleteButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Excluir')
    await act(async () => deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(confirm).toHaveBeenCalledOnce()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.movements) ?? '[]')).toEqual([])
    expect(container.textContent).not.toContain('Serviço editado')

    await act(async () => root.unmount())
  })
})
