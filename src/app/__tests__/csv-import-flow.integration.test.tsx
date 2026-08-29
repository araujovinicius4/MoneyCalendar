// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import csvAnonimizado from '../../../NU_83369665_01AGO2026_06AGO2026.anonimizado.csv?raw'
import { classificarMovimentacao, importarCsvNubank, type MovimentacaoFinanceira } from '../../domain/transactions'
import { loadMovements, saveMovements, STORAGE_KEYS } from '../../infrastructure/storage'
import { App } from '../App'
import { friendlyCsvError } from '../ImportCsvModal'
import { createManualMovement } from '../manual-movement'

const imported = importarCsvNubank(csvAnonimizado)

function existingCollection(): readonly MovimentacaoFinanceira[] {
  const target = imported.find(({ classificacaoFinanceira }) => classificacaoFinanceira === 'transferencia')
  if (!target) throw new Error('Transferência esperada')
  const reclassified = classificarMovimentacao(target, 'receita')
  const manual = createManualMovement({
    date: '2026-08-15', description: 'Manual preservada', value: '10.00',
    bankingType: 'saida', financialClassification: 'gasto',
  }, () => 'manual:preservada')
  return [...imported.map((movement) => movement.id === target.id ? reclassified : movement), manual]
}

async function selectCsv(container: HTMLElement, content: string, name = 'nubank.csv') {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('Seletor de arquivo não encontrado')
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [{ name, text: async () => content }],
  })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

const findButton = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(text))

describe('experiência completa de importação CSV', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    window.history.replaceState(null, '', '/calendario/2026/8')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    localStorage.clear()
    container.remove()
  })

  it('mostra prévia e conciliação sem alterar estado ou storage antes da confirmação', async () => {
    const existing = existingCollection()
    saveMovements(existing)
    const storedBefore = localStorage.getItem(STORAGE_KEYS.movements)
    await act(async () => root.render(<App />))
    await act(async () => findButton(container, 'Importar CSV')?.click())
    await selectCsv(container, csvAnonimizado, 'movimentacoes-agosto.csv')

    expect(container.textContent).toContain('movimentacoes-agosto.csv')
    expect(container.textContent).toContain('Movimentações reconhecidas')
    expect(container.textContent).toContain(String(imported.length))
    expect(container.textContent).toContain('Entradas bancárias')
    expect(container.textContent).toContain('Saídas bancárias')
    expect(container.querySelector('[aria-label="Quantidade por classificação financeira"]')).not.toBeNull()
    expect(container.querySelectorAll('.preview-list > div')).toHaveLength(6)
    expect(container.textContent).toContain('Resumo da conciliação')
    expect(container.textContent).toContain('0 novas movimentações')
    expect(container.textContent).toContain(`${imported.length} já existentes ignoradas`)
    expect(container.textContent).toContain('1 manuais preservadas')
    expect(container.textContent).toContain('1 reclassificações preservadas')
    expect(container.textContent).toContain('Nenhuma movimentação nova será adicionada')
    expect(localStorage.getItem(STORAGE_KEYS.movements)).toBe(storedBefore)
    expect(loadMovements()).toEqual(existing)
  })

  it('confirma a conciliação, persiste sem duplicar e mostra o resultado correto', async () => {
    const existing = existingCollection()
    saveMovements(existing)
    await act(async () => root.render(<App />))
    await act(async () => findButton(container, 'Importar CSV')?.click())
    await selectCsv(container, csvAnonimizado)
    await act(async () => findButton(container, 'Confirmar importação')?.click())

    expect(container.textContent).toContain('Importação concluída')
    expect(container.textContent).toContain('Resultado da importação')
    expect(container.textContent).toContain('0 novas movimentações')
    expect(container.textContent).toContain(`${imported.length} já existentes ignoradas`)
    expect(container.textContent).toContain('1 manuais preservadas')
    expect(container.textContent).toContain('1 reclassificações preservadas')
    expect(findButton(container, 'Fechar e continuar')).toBeDefined()

    const persisted = loadMovements()
    expect(persisted).toHaveLength(existing.length)
    expect(persisted.filter(({ id }) => id === 'manual:preservada')).toHaveLength(1)
    expect(persisted.find(({ id }) => id === imported.find(({ classificacaoFinanceira }) => classificacaoFinanceira === 'transferencia')?.id)?.classificacaoFinanceira).toBe('receita')
  })

  it('adiciona uma coleção nova somente depois da confirmação', async () => {
    await act(async () => root.render(<App />))
    await act(async () => findButton(container, 'Importar CSV')?.click())
    await selectCsv(container, csvAnonimizado)
    expect(loadMovements()).toEqual([])
    await act(async () => findButton(container, 'Confirmar importação')?.click())
    expect(loadMovements()).toHaveLength(imported.length)
    expect(container.textContent).toContain(`${imported.length} novas movimentações`)
  })

  it('cancelar antes da confirmação preserva integralmente os dados', async () => {
    const existing = existingCollection()
    saveMovements(existing)
    const before = localStorage.getItem(STORAGE_KEYS.movements)
    await act(async () => root.render(<App />))
    await act(async () => findButton(container, 'Importar CSV')?.click())
    await selectCsv(container, `${csvAnonimizado.trim()}\n07/08/2026,125.00,NOVO,Transferência recebida pelo Pix\n`)
    await act(async () => findButton(container, 'Cancelar')?.click())
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.movements)).toBe(before)
    expect(loadMovements()).toEqual(existing)
  })

  it('traduz erros de CSV em mensagens compreensíveis sem detalhes técnicos', async () => {
    await act(async () => root.render(<App />))
    await act(async () => findButton(container, 'Importar CSV')?.click())
    await selectCsv(container, 'Data,Valor\n31/02/2026,abc\n', 'invalido.csv')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Cabeçalhos ausentes ou incompatíveis')
    expect(container.textContent).not.toContain('Error:')

    expect(friendlyCsvError('', new Error('qualquer'))).toContain('arquivo está vazio')
    expect(friendlyCsvError('x', new Error('Data inválida na linha 2'))).toContain('data inválida')
    expect(friendlyCsvError('x', new Error('Valor inválido na linha 2'))).toContain('valor inválido')
    expect(friendlyCsvError('x', new Error('Quantidade de colunas inválida na linha 2'))).toContain('incompatível')
    expect(friendlyCsvError('x', new Error('detalhe interno'))).not.toContain('detalhe interno')
  })

  it('apenas orquestra o importador e a conciliação existentes na camada React', () => {
    const sources = import.meta.glob('../ImportCsvModal.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const source = Object.values(sources)[0]
    expect(source).toContain('prepareCsvImport(content)')
    expect(source).toContain('reconcileImportedMovements(existingMovements')
    expect(source).not.toContain('obterIdentidadeBancariaNubank')
    expect(source).not.toContain('calcularFaturamento')
    expect(source).not.toContain('.reduce(')
  })
})
