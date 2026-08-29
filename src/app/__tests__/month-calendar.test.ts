import { describe, expect, it } from 'vitest'
import { createMonthCalendar, getAdjacentMonth, type MonthCalendarDay } from '../month-calendar'

describe('calendário mensal', () => {
  it('gera a quantidade correta de dias', () => {
    expect(createMonthCalendar(2026, 1).daysInMonth).toBe(31)
    expect(createMonthCalendar(2026, 4).daysInMonth).toBe(30)
    expect(createMonthCalendar(2026, 2).daysInMonth).toBe(28)
  })

  it('gera 29 dias em fevereiro de ano bissexto', () => {
    expect(createMonthCalendar(2024, 2).daysInMonth).toBe(29)
  })

  it('fornece em cada dia clicável o destino dos detalhes', () => {
    const day = createMonthCalendar(2026, 8).cells.find((cell) => cell?.number === 14)
    expect(day?.href).toBe('/calendario/2026/8/14')
  })

  it('navega do dezembro para janeiro do ano seguinte', () => {
    expect(getAdjacentMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1, href: '/calendario/2027/1' })
  })

  it('navega de janeiro para dezembro do ano anterior', () => {
    expect(getAdjacentMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12, href: '/calendario/2025/12' })
  })

  it('destaca apenas o dia atual no mês atual', () => {
    const calendar = createMonthCalendar(2026, 8, new Date(2026, 7, 14, 12))
    const highlightedDays = calendar.cells.filter(
      (day): day is MonthCalendarDay => day?.isToday === true,
    )
    expect(highlightedDays.map(({ number }) => number)).toEqual([14])
  })

  it('não destaca dia em outro mês', () => {
    const calendar = createMonthCalendar(2026, 9, new Date(2026, 7, 14, 12))
    expect(calendar.cells.some((day) => day?.isToday)).toBe(false)
  })
})
