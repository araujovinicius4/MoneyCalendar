import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import csvAnonimizado from '../../../NU_83369665_01AGO2026_06AGO2026.anonimizado.csv?raw'
import { calcularEntradasBancarias, calcularFaturamento, calcularGastos, calcularSaidasBancarias } from '../../domain/finance'
import { importarCsvNubank } from '../../domain/transactions'
import { loadMovements, saveMovements } from '../../infrastructure/storage'
import { DayScreen } from '../App'
import {
  createManualMovement,
  deleteManualMovementInMemory,
  updateManualMovementInMemory,
  type ManualMovementInput,
} from '../manual-movement'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const input: ManualMovementInput = {
  date: '2026-08-15', description: 'Original manual', value: '100.00',
  bankingType: 'entrada', financialClassification: 'receita', time: '10:00', note: 'Original',
}
const manual = createManualMovement(input, () => 'manual:fixed')
const edit = (overrides: Partial<ManualMovementInput> = {}) => {
  const normalized = createManualMovement({ ...input, ...overrides }, () => manual.id)
  return updateManualMovementInMemory([manual], normalized)
}

describe('edição e exclusão de movimentações manuais', () => {
  it('edita uma movimentação reutilizando validação e normalização', () => {
    const [edited] = edit({ description: 'Editada', value: '250,50', time: '14:30', note: 'Nova' })
    expect(edited).toMatchObject({
      id: 'manual:fixed', valorEmCentavos: 25_050,
      dadosOriginais: { origem: 'manual', descricaoOriginal: 'Editada', valorOriginal: '250.50', horario: '14:30', observacao: 'Nova' },
    })
  })

  it('preserva o mesmo ID interno', () => {
    const [edited] = edit({ description: 'Outro texto' })
    expect(edited.id).toBe(manual.id)
  })

  it('alterar valor atualiza os indicadores', () => {
    const [edited] = edit({ financialClassification: 'faturamento', value: '300.00' })
    expect(calcularFaturamento([edited])).toBe(30_000)
    expect(calcularFaturamento([edited])).not.toBe(calcularFaturamento([manual]))
  })

  it('alterar tipo bancário atualiza entradas e saídas sem deduzir classificação', () => {
    const [edited] = edit({ bankingType: 'saida' })
    expect(calcularEntradasBancarias([edited])).toBe(0)
    expect(calcularSaidasBancarias([edited])).toBe(10_000)
    expect(edited.classificacaoFinanceira).toBe('receita')
    expect(edited.dadosOriginais.valorAssinadoEmCentavos).toBe(-10_000)
  })

  it('alterar classificação atualiza somente indicadores financeiros correspondentes', () => {
    const [edited] = edit({ financialClassification: 'gasto' })
    expect(calcularGastos([edited])).toBe(10_000)
    expect(calcularEntradasBancarias([edited])).toBe(calcularEntradasBancarias([manual]))
    expect(calcularSaidasBancarias([edited])).toBe(calcularSaidasBancarias([manual]))
  })

  it('alterar data move a movimentação para o novo dia', () => {
    const [edited] = edit({ date: '2026-08-16' })
    const oldDay = renderToStaticMarkup(<DayScreen year={2026} month={8} day={15} movements={[edited]} />)
    const newDay = renderToStaticMarkup(<DayScreen year={2026} month={8} day={16} movements={[edited]} />)
    expect(oldDay).not.toContain('Original manual')
    expect(newDay).toContain('Original manual')
  })

  it('excluir remove a movimentação e atualiza os indicadores', () => {
    const remaining = deleteManualMovementInMemory([manual], manual.id)
    expect(remaining).toEqual([])
    expect(calcularEntradasBancarias(remaining)).toBe(0)
  })

  it('edição e exclusão sobrevivem ao reload', () => {
    const storage = new MemoryStorage()
    const edited = edit({ description: 'Persistida' })
    saveMovements(edited, storage)
    expect(loadMovements(storage)[0].dadosOriginais.descricaoOriginal).toBe('Persistida')
    saveMovements(deleteManualMovementInMemory(loadMovements(storage), manual.id), storage)
    expect(loadMovements(storage)).toEqual([])
  })

  it('movimentações importadas não podem ser editadas nem excluídas', () => {
    const imported = importarCsvNubank(csvAnonimizado)
    const attemptedReplacement = createManualMovement(input, () => imported[0].id)
    expect(() => updateManualMovementInMemory(imported, attemptedReplacement)).toThrow('Somente movimentações manuais')
    expect(() => deleteManualMovementInMemory(imported, imported[0].id)).toThrow('Somente movimentações manuais')
  })

  it('insere diretamente a movimentação já normalizada, sem uma segunda passagem', () => {
    let valueReads = 0
    const singlePassInput: ManualMovementInput = {
      ...input,
      description: 'Normalizada uma vez',
      get value() {
        valueReads += 1
        return '250,50'
      },
    }
    const normalized = createManualMovement(singlePassInput, () => manual.id)
    const [edited] = updateManualMovementInMemory([manual], normalized)

    expect(valueReads).toBe(1)
    expect(edited).toBe(normalized)
    expect(edited.id).toBe(manual.id)
    expect(edited.valorEmCentavos).toBe(25_050)
  })

  it('dados originais importados permanecem intactos e sem ações destrutivas na tela', () => {
    const imported = importarCsvNubank(csvAnonimizado)
    const before = JSON.stringify(imported)
    const html = renderToStaticMarkup(<DayScreen year={2026} month={8} day={1} movements={imported} />)
    expect(JSON.stringify(imported)).toBe(before)
    expect(html).not.toContain('>Editar</button>')
    expect(html).not.toContain('>Excluir</button>')
  })
})
