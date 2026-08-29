import { describe, expect, it } from 'vitest'
import { dayPath, monthPath, parseCalendarRoute, yearPath } from '../routes'

describe('rotas do calendário', () => {
  it('reconhece calendário anual', () => {
    expect(parseCalendarRoute('/calendario/2026')).toEqual({ page: 'year', year: 2026 })
  })

  it('reconhece calendário mensal', () => {
    expect(parseCalendarRoute('/calendario/2026/8')).toEqual({ page: 'month', year: 2026, month: 8 })
  })

  it('reconhece detalhes do dia', () => {
    expect(parseCalendarRoute('/calendario/2026/8/14')).toEqual({ page: 'day', year: 2026, month: 8, day: 14 })
  })

  it.each(['/calendario/2026/13', '/calendario/2026/2/30', '/outra-rota'])('rejeita rota inválida: %s', (path) => {
    expect(parseCalendarRoute(path)).toEqual({ page: 'not-found' })
  })

  it('monta a hierarquia de caminhos', () => {
    expect(yearPath(2026)).toBe('/calendario/2026')
    expect(monthPath(2026, 8)).toBe('/calendario/2026/8')
    expect(dayPath(2026, 8, 14)).toBe('/calendario/2026/8/14')
  })
})
