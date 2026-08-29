import { dayPath, monthPath, yearPath } from './routes'

export interface CalendarDateDestination {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly href: string
}

export function getAdjacentDay(
  year: number,
  month: number,
  day: number,
  offset: -1 | 1,
): CalendarDateDestination | null {
  const date = new Date(0)
  date.setUTCHours(12, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day + offset)
  const adjacentYear = date.getUTCFullYear()
  if (adjacentYear < 1 || adjacentYear > 9999) return null
  const adjacentMonth = date.getUTCMonth() + 1
  const adjacentDay = date.getUTCDate()
  return {
    year: adjacentYear,
    month: adjacentMonth,
    day: adjacentDay,
    href: dayPath(adjacentYear, adjacentMonth, adjacentDay),
  }
}

export const todayYearPath = (today: Date) => yearPath(today.getFullYear())
export const todayMonthPath = (today: Date) => monthPath(today.getFullYear(), today.getMonth() + 1)
export const todayDayPath = (today: Date) => dayPath(today.getFullYear(), today.getMonth() + 1, today.getDate())
