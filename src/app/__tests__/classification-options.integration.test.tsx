// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { DayScreen } from '../App'
import { NewMovementModal } from '../NewMovementModal'

const setSelect = (select: HTMLSelectElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('opções reativas no formulário manual', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  const selects = () => container.querySelectorAll<HTMLSelectElement>('select')
  const optionValues = () => [...selects()[1].options].map(({ value }) => value)

  it('reage imediatamente ao tipo e limpa faturamento ao mudar entrada para saída', async () => {
    await act(async () => root.render(<NewMovementModal date="2026-08-15" onClose={() => undefined} onSave={() => undefined} />))
    await act(async () => setSelect(selects()[0], 'entrada'))
    expect(optionValues()).toEqual(['faturamento', 'receita', 'resgate_investimento', 'transferencia', 'estorno', 'nao_classificado'])
    await act(async () => setSelect(selects()[1], 'faturamento'))
    await act(async () => setSelect(selects()[0], 'saida'))
    expect(selects()[1].value).toBe('nao_classificado')
    expect(optionValues()).toEqual(['gasto', 'investimento', 'transferencia', 'nao_classificado'])
  })

  it('limpa gasto ao mudar saída para entrada e preserva transferência compatível', async () => {
    await act(async () => root.render(<NewMovementModal date="2026-08-15" onClose={() => undefined} onSave={() => undefined} />))
    await act(async () => setSelect(selects()[1], 'gasto'))
    await act(async () => setSelect(selects()[0], 'entrada'))
    expect(selects()[1].value).toBe('nao_classificado')
    await act(async () => setSelect(selects()[1], 'transferencia'))
    await act(async () => setSelect(selects()[0], 'saida'))
    expect(selects()[1].value).toBe('transferencia')
  })
})

describe('preservação de combinações históricas', () => {
  it('não altera uma entrada historicamente classificada como gasto', () => {
    const historical: MovimentacaoFinanceira = {
      id: 'historical', data: '2026-08-15', valorEmCentavos: 1_000,
      tipoBancario: 'entrada', classificacaoFinanceira: 'gasto', dadosOriginais: { origem: 'antiga' },
    }
    const before = JSON.stringify(historical)
    const html = renderToStaticMarkup(<DayScreen year={2026} month={8} day={15} movements={[historical]} />)
    expect(html).toContain('value="gasto" disabled="" selected=""')
    expect(html).toContain('Gasto (histórica)')
    expect(JSON.stringify(historical)).toBe(before)
  })
})
