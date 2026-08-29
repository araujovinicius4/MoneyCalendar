import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import csvAnonimizado from '../../../NU_83369665_01AGO2026_06AGO2026.anonimizado.csv?raw'
import {
  calcularEntradasBancarias,
  calcularFaturamento,
  calcularGastos,
  calcularIndiceAcumulacao,
  calcularInvestimentos,
  calcularReceitas,
} from '../../domain/finance'
import { importarCsvNubank } from '../../domain/transactions'
import { loadMovements, saveMovements } from '../../infrastructure/storage'
import { DayScreen } from '../App'
import { createManualMovement, normalizeManualValue, type ManualMovementInput } from '../manual-movement'
import { createMonthSummary, createOperationalMonthSummary } from '../month-summary'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const today = new Date(2026, 7, 15, 12)
const baseInput: ManualMovementInput = {
  date: '2026-08-15', description: 'Movimentação manual', value: '1000,00',
  bankingType: 'entrada', financialClassification: 'nao_classificado',
}
const create = (overrides: Partial<ManualMovementInput> = {}, id = 'manual:test') =>
  createManualMovement({ ...baseInput, ...overrides }, () => id)

describe('cadastro manual integrado ao motor financeiro', () => {
  it('cria uma entrada manual normalizada e com identificador interno', () => {
    const movement = create({ time: '09:30', note: 'Observação' })
    expect(movement).toMatchObject({
      id: 'manual:test', data: '2026-08-15', valorEmCentavos: 100_000,
      tipoBancario: 'entrada', classificacaoFinanceira: 'nao_classificado',
      dadosOriginais: { origem: 'manual', descricaoOriginal: 'Movimentação manual', valorOriginal: '1000.00', valorAssinadoEmCentavos: 100_000, horario: '09:30', observacao: 'Observação' },
    })
    expect(movement.dadosOriginais).not.toHaveProperty('identificadorExterno')
  })

  it('normaliza saída com sinal negativo no valor original e magnitude positiva no domínio', () => {
    expect(normalizeManualValue('25,90', 'saida')).toEqual({ valueInCents: 2_590, signedValueInCents: -2_590, signedOriginalValue: '-25.90' })
    const movement = create({ value: '25,90', bankingType: 'saida' })
    expect(movement.valorEmCentavos).toBe(2_590)
    expect(movement.dadosOriginais.valorOriginal).toBe('-25.90')
    expect(movement.dadosOriginais.valorAssinadoEmCentavos).toBe(-2_590)
  })

  it('faturamento manual afeta os indicadores operacionais', () => {
    const billing = create({ financialClassification: 'faturamento' })
    const summary = createMonthSummary([billing], 2026, 8, today)
    const operational = createOperationalMonthSummary(summary, 0.8, today)
    expect(calcularFaturamento([billing])).toBe(100_000)
    expect(operational?.investmentAllocation).toBe(80_000)
    expect(operational?.operationalBudget).toBeCloseTo(20_000)
  })

  it('receita manual aumenta Receita, mas não Faturamento nem indicadores operacionais', () => {
    const receita = create({ financialClassification: 'receita' })
    const emptyOperational = createOperationalMonthSummary(createMonthSummary([], 2026, 8, today), 0.8, today)
    const receitaOperational = createOperationalMonthSummary(createMonthSummary([receita], 2026, 8, today), 0.8, today)
    expect(calcularReceitas([receita])).toBe(100_000)
    expect(calcularFaturamento([receita])).toBe(0)
    expect(receitaOperational?.operationalBudget).toBe(emptyOperational?.operationalBudget)
    expect(receitaOperational?.operationalBalance).toBe(emptyOperational?.operationalBalance)
    expect(receitaOperational?.currentDailySpendingTarget).toBe(emptyOperational?.currentDailySpendingTarget)
  })

  it('gasto manual altera Gastos, saldo operacional e meta diária', () => {
    const expense = create({ value: '100,00', bankingType: 'saida', financialClassification: 'gasto' })
    const emptyOperational = createOperationalMonthSummary(createMonthSummary([], 2026, 8, today), 0.8, today)
    const expenseOperational = createOperationalMonthSummary(createMonthSummary([expense], 2026, 8, today), 0.8, today)
    expect(calcularGastos([expense])).toBe(10_000)
    expect(expenseOperational?.operationalBalance).not.toBe(emptyOperational?.operationalBalance)
    expect(expenseOperational?.currentDailySpendingTarget).not.toBe(emptyOperational?.currentDailySpendingTarget)
    expect(expenseOperational?.operationalBalance).toBe(-10_000)
  })

  it('investimento manual altera Investimentos e o Índice de acumulação', () => {
    const expense = create({ value: '100,00', bankingType: 'saida', financialClassification: 'gasto' }, 'manual:expense')
    const investment = create({ value: '200,00', bankingType: 'saida', financialClassification: 'investimento' }, 'manual:investment')
    expect(calcularInvestimentos([expense, investment])).toBe(20_000)
    expect(calcularIndiceAcumulacao([expense, investment])).toBe(2)
  })

  it('aparece somente no dia correto', () => {
    const movement = create({ description: 'Somente hoje' })
    const correctDay = renderToStaticMarkup(<DayScreen year={2026} month={8} day={15} movements={[movement]} />)
    const anotherDay = renderToStaticMarkup(<DayScreen year={2026} month={8} day={14} movements={[movement]} />)
    expect(correctDay).toContain('Somente hoje')
    expect(anotherDay).not.toContain('Somente hoje')
  })

  it('sobrevive ao reload pela camada de storage', () => {
    const storage = new MemoryStorage()
    const movement = create()
    saveMovements([movement], storage)
    expect(loadMovements(storage)).toEqual([movement])
  })

  it('adicionar manualmente não modifica movimentações importadas existentes', () => {
    const imported = importarCsvNubank(csvAnonimizado)
    const snapshot = JSON.stringify(imported)
    const updated = [...imported, create()]
    expect(JSON.stringify(imported)).toBe(snapshot)
    expect(updated.slice(0, imported.length)).toEqual(imported)
    expect(updated).toHaveLength(imported.length + 1)
  })

  it('mantém tipo bancário e classificação financeira independentes', () => {
    const entryExpense = create({ bankingType: 'entrada', financialClassification: 'gasto' })
    expect(calcularEntradasBancarias([entryExpense])).toBe(100_000)
    expect(calcularGastos([entryExpense])).toBe(100_000)
    expect(entryExpense).toMatchObject({ tipoBancario: 'entrada', classificacaoFinanceira: 'gasto' })
  })

  it.each([
    [{ description: '' }, 'descrição'],
    [{ value: '0' }, 'maior que zero'],
    [{ value: 'abc' }, 'valor monetário'],
    [{ date: '2026-02-30' }, 'data válida'],
  ] as const)('rejeita movimentação inconsistente: %o', (overrides, message) => {
    expect(() => create(overrides)).toThrow(message)
  })
})
