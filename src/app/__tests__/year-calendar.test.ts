import { describe, expect, it } from 'vitest'
import { createMiniCalendar, createYearCalendar, type MiniCalendarDay } from '../year-calendar'

describe('calendário anual', () => {
  it('gera os 12 meses do ano', () => {
    expect(createYearCalendar(2026)).toHaveLength(12)
  })

  it('gera a quantidade correta de dias em meses comuns', () => {
    expect(createMiniCalendar(2026, 1).daysInMonth).toBe(31)
    expect(createMiniCalendar(2026, 4).daysInMonth).toBe(30)
    expect(createMiniCalendar(2026, 2).daysInMonth).toBe(28)
  })

  it('gera 29 dias em fevereiro de ano bissexto', () => {
    expect(createMiniCalendar(2024, 2).daysInMonth).toBe(29)
  })

  it('fornece no mês clicável o destino da navegação mensal', () => {
    expect(createMiniCalendar(2026, 8).href).toBe('/calendario/2026/8')
  })

  it('destaca apenas o mês e o dia atuais no ano atual', () => {
    const calendar = createYearCalendar(2026, new Date(2026, 7, 14, 12))
    const highlightedMonths = calendar.filter(({ isCurrentMonth }) => isCurrentMonth)
    const highlightedDays = calendar
      .flatMap(({ cells }) => cells)
      .filter((day): day is MiniCalendarDay => day?.isToday === true)

    expect(highlightedMonths.map(({ month }) => month)).toEqual([8])
    expect(highlightedDays.map(({ number }) => number)).toEqual([14])
  })

  it('não destaca datas quando outro ano está sendo exibido', () => {
    const calendar = createYearCalendar(2025, new Date(2026, 7, 14, 12))
    expect(calendar.some(({ isCurrentMonth }) => isCurrentMonth)).toBe(false)
    expect(calendar.flatMap(({ cells }) => cells).some((day) => day?.isToday)).toBe(false)
  })
})
