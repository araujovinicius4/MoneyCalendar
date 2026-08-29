import { describe, expect, it } from 'vitest'
import csvAnonimizado from '../../../../NU_83369665_01AGO2026_06AGO2026.anonimizado.csv?raw'
import { calcularEntradasBancarias, calcularOrcamentoOperacional, calcularSaldoOperacional } from '../../../domain/finance'
import { CLASSIFICACOES_FINANCEIRAS, importarCsvNubank, type MovimentacaoFinanceira } from '../../../domain/transactions'
import { createMonthSummary, createOperationalMonthSummary } from '../../../app/month-summary'
import { reclassifyMovementInMemory } from '../../../app/reclassify-movement'
import {
  DEFAULT_INVESTMENT_PERCENTAGE,
  loadInvestmentPercentage,
  loadMovements,
  loadOnboardingDismissed,
  saveInvestmentPercentage,
  saveMovements,
  saveOnboardingDismissed,
  STORAGE_KEYS,
} from '../moneycalendar-storage'

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const validMovement: MovimentacaoFinanceira = {
  id: 'valid-id',
  data: '2024-02-29',
  valorEmCentavos: 12_345,
  tipoBancario: 'entrada',
  classificacaoFinanceira: 'receita',
  dadosOriginais: { origem: 'manual', descricaoOriginal: 'Movimentação válida' },
}

function storeRawMovements(storage: Storage, movements: readonly unknown[]) {
  storage.setItem(STORAGE_KEYS.movements, JSON.stringify(movements))
}

describe('persistência local versionada', () => {
  it('faz uma importação CSV sobreviver a uma nova inicialização', () => {
    const storage = new MemoryStorage()
    const imported = importarCsvNubank(csvAnonimizado)
    saveMovements(imported, storage)
    const restoredAfterReload = loadMovements(storage)
    expect(restoredAfterReload).toEqual(imported)
    expect(restoredAfterReload).toHaveLength(24)
  })

  it('faz uma reclassificação manual sobreviver a uma nova inicialização', () => {
    const storage = new MemoryStorage()
    const imported = importarCsvNubank(csvAnonimizado)
    const movement = imported.find(({ classificacaoFinanceira }) => classificacaoFinanceira === 'transferencia')
    if (!movement) throw new Error('Transferência esperada na fixture')
    const reclassified = reclassifyMovementInMemory(imported, movement.id, 'receita')
    saveMovements(reclassified, storage)
    expect(loadMovements(storage).find(({ id }) => id === movement.id)?.classificacaoFinanceira).toBe('receita')
  })

  it('faz o percentual sobreviver a uma nova inicialização', () => {
    const storage = new MemoryStorage()
    saveInvestmentPercentage(0.7, storage)
    expect(loadInvestmentPercentage(storage)).toBe(0.7)
  })

  it('recalcula derivados pelo domínio depois da restauração sem persistir derivados', () => {
    const storage = new MemoryStorage()
    const imported = importarCsvNubank(csvAnonimizado)
    saveMovements(imported, storage)
    saveInvestmentPercentage(0.7, storage)
    const restored = loadMovements(storage)
    const percentage = loadInvestmentPercentage(storage)
    const today = new Date(2026, 7, 15, 12)
    const month = createMonthSummary(restored, 2026, 8, today)
    const operational = createOperationalMonthSummary(month, percentage, today)

    expect(month?.bankingEntries).toBe(calcularEntradasBancarias(restored.filter(({ data }) => data <= '2026-08-15')))
    expect(operational?.operationalBudget).toBe(calcularOrcamentoOperacional(month?.movements ?? [], 0.7))
    expect(operational?.operationalBalance).toBe(calcularSaldoOperacional(month?.movements ?? [], 0.7))
    expect([...storage.values.keys()]).toEqual([STORAGE_KEYS.movements, STORAGE_KEYS.investmentPercentage])
  })

  it('preserva integralmente dados originais, tipo bancário e classificação', () => {
    const storage = new MemoryStorage()
    const imported = importarCsvNubank(csvAnonimizado)
    saveMovements(imported, storage)
    const restored = loadMovements(storage)
    expect(restored.map(({ dadosOriginais }) => dadosOriginais)).toEqual(imported.map(({ dadosOriginais }) => dadosOriginais))
    expect(restored.map(({ tipoBancario }) => tipoBancario)).toEqual(imported.map(({ tipoBancario }) => tipoBancario))
    expect(restored.map(({ classificacaoFinanceira }) => classificacaoFinanceira)).toEqual(imported.map(({ classificacaoFinanceira }) => classificacaoFinanceira))
  })

  it('storage vazio ou limpo inicia com estado seguro', () => {
    const storage = new MemoryStorage()
    expect(loadMovements(storage)).toEqual([])
    expect(loadInvestmentPercentage(storage)).toBe(DEFAULT_INVESTMENT_PERCENTAGE)
    saveMovements(importarCsvNubank(csvAnonimizado), storage)
    saveInvestmentPercentage(0.4, storage)
    storage.clear()
    expect(loadMovements(storage)).toEqual([])
    expect(loadInvestmentPercentage(storage)).toBe(0.8)
  })

  it('ignora JSON corrompido, schema inválido e versões antigas', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.movements, '{inválido')
    storage.setItem(STORAGE_KEYS.investmentPercentage, '2')
    storage.setItem('moneycalendar:v1:movements', JSON.stringify(importarCsvNubank(csvAnonimizado)))
    expect(loadMovements(storage)).toEqual([])
    expect(loadInvestmentPercentage(storage)).toBe(DEFAULT_INVESTMENT_PERCENTAGE)

    storage.setItem(STORAGE_KEYS.movements, JSON.stringify([{ id: 'incompleto' }]))
    storage.setItem(STORAGE_KEYS.investmentPercentage, '"70%"')
    expect(loadMovements(storage)).toEqual([])
    expect(loadInvestmentPercentage(storage)).toBe(DEFAULT_INVESTMENT_PERCENTAGE)
  })

  it('restaura uma data real válida, incluindo ano bissexto, sem alterar os dados', () => {
    const storage = new MemoryStorage()
    storeRawMovements(storage, [validMovement])
    expect(loadMovements(storage)).toEqual([validMovement])
  })

  it.each(['2026-02-31', '2026-99-99', '2025-02-29'])(
    'rejeita a data inexistente %s',
    (data) => {
      const storage = new MemoryStorage()
      storeRawMovements(storage, [{ ...validMovement, data }])
      expect(loadMovements(storage)).toEqual([])
    },
  )

  it('rejeita ID interno vazio ou composto apenas por espaços', () => {
    for (const id of ['', '   ']) {
      const storage = new MemoryStorage()
      storeRawMovements(storage, [{ ...validMovement, id }])
      expect(loadMovements(storage)).toEqual([])
    }
  })

  it('rejeita a coleção inteira quando existem IDs internos duplicados', () => {
    const storage = new MemoryStorage()
    storeRawMovements(storage, [validMovement, { ...validMovement, data: '2024-03-01' }])
    expect(loadMovements(storage)).toEqual([])
  })

  it('rejeita tipo bancário fora de entrada e saida', () => {
    const storage = new MemoryStorage()
    storeRawMovements(storage, [{ ...validMovement, tipoBancario: 'credito' }])
    expect(loadMovements(storage)).toEqual([])
  })

  it('rejeita classificação que não pertence ao catálogo do domínio', () => {
    const storage = new MemoryStorage()
    storeRawMovements(storage, [{ ...validMovement, classificacaoFinanceira: 'salario' }])
    expect(loadMovements(storage)).toEqual([])
  })

  it('aceita pelo catálogo do domínio todas as classificações oficiais', () => {
    const storage = new MemoryStorage()
    const movements = CLASSIFICACOES_FINANCEIRAS.map((classificacaoFinanceira, index) => ({
      ...validMovement,
      id: `catalog-${index}`,
      classificacaoFinanceira,
    }))
    storeRawMovements(storage, movements)
    expect(loadMovements(storage)).toEqual(movements)
  })

  it('nenhum arquivo do domínio acessa localStorage', () => {
    const sources = import.meta.glob('../../../domain/**/*.ts', {
      query: '?raw', import: 'default', eager: true,
    }) as Record<string, string>
    expect(Object.keys(sources).length).toBeGreaterThan(0)
    for (const source of Object.values(sources)) expect(source).not.toContain('localStorage')
  })

  it('persiste separadamente apenas o fechamento da orientação inicial', () => {
    const storage = new MemoryStorage()
    expect(loadOnboardingDismissed(storage)).toBe(false)
    saveOnboardingDismissed(storage)
    expect(loadOnboardingDismissed(storage)).toBe(true)
    expect(storage.getItem(STORAGE_KEYS.onboardingDismissed)).toBe('true')
  })

  it('ignora estado inválido ou falha de gravação da orientação', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.onboardingDismissed, '{inválido')
    expect(loadOnboardingDismissed(storage)).toBe(false)
    const unavailable: Storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => { throw new Error('indisponível') },
    }
    expect(() => saveOnboardingDismissed(unavailable)).not.toThrow()
  })
})
