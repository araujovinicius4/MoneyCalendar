import { dayPath, monthPath } from './routes'

export interface MonthCalendarDay {
  readonly number: number
  readonly href: string
  readonly isToday: boolean
}

export interface AdjacentMonth {
  readonly year: number
  readonly month: number
  readonly href: string
}

export interface MonthCalendar {
  readonly year: number
  readonly month: number
  readonly daysInMonth: number
  readonly cells: readonly (MonthCalendarDay | null)[]
  readonly previous: AdjacentMonth
  readonly next: AdjacentMonth
}

export function getAdjacentMonth(year: number, month: number, offset: -1 | 1): AdjacentMonth {
  const date = new Date(year, month - 1 + offset, 1)
  const adjacentYear = date.getFullYear()
  const adjacentMonth = date.getMonth() + 1
  return {
    year: adjacentYear,
    month: adjacentMonth,
    href: monthPath(adjacentYear, adjacentMonth),
  }
}

export function createMonthCalendar(year: number, month: number, today = new Date()): MonthCalendar {
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const days = Array.from({ length: daysInMonth }, (_, index): MonthCalendarDay => ({
    number: index + 1,
    href: dayPath(year, month, index + 1),
    isToday: isCurrentMonth && index + 1 === today.getDate(),
  }))

  return {
    year,
    month,
    daysInMonth,
    cells: [...Array<null>(firstWeekday).fill(null), ...days],
    previous: getAdjacentMonth(year, month, -1),
    next: getAdjacentMonth(year, month, 1),
  }
}
