import { describe, expect, it } from 'vitest'
import { getFinancialValueState } from '../financial-value-state'

describe('estado visual de valores financeiros', () => {
  it('classifica lucro negativo como negativo', () => {
    expect(getFinancialValueState(-500, 'profit')).toBe('negative')
  })

  it('classifica lucro positivo como positivo', () => {
    expect(getFinancialValueState(500, 'profit')).toBe('positive')
  })

  it('classifica zero como neutro', () => {
    expect(getFinancialValueState(0, 'profit')).toBe('neutral')
  })

  it('não transforma gasto positivo em estado positivo', () => {
    expect(getFinancialValueState(500, 'gastos')).toBe('informational')
  })
})
