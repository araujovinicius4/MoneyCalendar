import { monthPath } from './routes'

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

export const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

export interface MiniCalendarDay {
  readonly number: number
  readonly isToday: boolean
}

export interface MiniCalendarMonth {
  readonly month: number
  readonly name: string
  readonly href: string
  readonly isCurrentMonth: boolean
  readonly daysInMonth: number
  readonly cells: readonly (MiniCalendarDay | null)[]
}

export function createMiniCalendar(year: number, month: number, today = new Date()): MiniCalendarMonth {
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const days = Array.from({ length: daysInMonth }, (_, index): MiniCalendarDay => ({
    number: index + 1,
    isToday: isCurrentMonth && index + 1 === today.getDate(),
  }))

  return {
    month,
    name: MONTHS[month - 1],
    href: monthPath(year, month),
    isCurrentMonth,
    daysInMonth,
    cells: [...Array<null>(firstWeekday).fill(null), ...days],
  }
}

export function createYearCalendar(year: number, today = new Date()): readonly MiniCalendarMonth[] {
  return Array.from({ length: 12 }, (_, index) => createMiniCalendar(year, index + 1, today))
}
