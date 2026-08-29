export type CalendarRoute =
  | { page: 'year'; year: number }
  | { page: 'month'; year: number; month: number }
  | { page: 'day'; year: number; month: number; day: number }
  | { page: 'not-found' }

const toInteger = (value: string | undefined) =>
  value !== undefined && /^\d+$/.test(value) ? Number(value) : null

export function parseCalendarRoute(pathname: string): CalendarRoute {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/')
  if (parts[0] !== 'calendario' || parts.length < 2 || parts.length > 4) {
    return { page: 'not-found' }
  }

  const year = toInteger(parts[1])
  const month = toInteger(parts[2])
  const day = toInteger(parts[3])
  if (year === null || year < 1 || year > 9999) return { page: 'not-found' }
  if (parts.length === 2) return { page: 'year', year }
  if (month === null || month < 1 || month > 12) return { page: 'not-found' }
  if (parts.length === 3) return { page: 'month', year, month }
  if (day === null || day < 1 || day > new Date(year, month, 0).getDate()) {
    return { page: 'not-found' }
  }
  return { page: 'day', year, month, day }
}

export const yearPath = (year: number) => `/calendario/${year}`
export const monthPath = (year: number, month: number) => `${yearPath(year)}/${month}`
export const dayPath = (year: number, month: number, day: number) => `${monthPath(year, month)}/${day}`
