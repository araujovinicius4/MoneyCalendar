import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { DayScreen, MonthScreen, YearScreen } from '../App'
import { createMonthSummary } from '../month-summary'
import { getAdjacentDay, todayDayPath, todayMonthPath, todayYearPath } from '../temporal-navigation'

const today = new Date(2026, 7, 15, 12)
const movements: readonly MovimentacaoFinanceira[] = [
  { id: 'billing', data: '2026-08-15', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  { id: 'expense', data: '2026-08-15', valorEmCentavos: 20_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: {} },
]

describe('navegação temporal fim a fim', () => {
  it('oferece ano anterior, próximo ano e Hoje', () => {
    const html = renderToStaticMarkup(<YearScreen year={2025} movements={[]} today={today} />)
    expect(html).toContain('href="/calendario/2024" aria-label="Ano anterior, 2024"')
    expect(html).toContain('href="/calendario/2026" aria-label="Hoje, abrir ano 2026"')
    expect(html).toContain('href="/calendario/2026" aria-label="Próximo ano, 2026"')
  })

  it('mantém mês anterior, próximo, Hoje e retorno ao ano exibido', () => {
    const december = renderToStaticMarkup(<MonthScreen year={2026} month={12} movements={[]} today={today} investmentPercentage={0.8} />)
    expect(december).toMatch(/href="\/calendario\/2026\/11"[^>]*aria-label="Mês anterior"/)
    expect(december).toMatch(/href="\/calendario\/2027\/1"[^>]*aria-label="Próximo mês"/)
    expect(december).toMatch(/href="\/calendario\/2026"[^>]*>Ver ano<\/a>/)
    expect(december).toMatch(/href="\/calendario\/2026\/8"[^>]*aria-label="Hoje, abrir Agosto de 2026"/)

    const january = renderToStaticMarkup(<MonthScreen year={2027} month={1} movements={[]} today={today} investmentPercentage={0.8} />)
    expect(january).toMatch(/href="\/calendario\/2026\/12"[^>]*aria-label="Mês anterior"/)
    expect(january).toMatch(/href="\/calendario\/2027"[^>]*>Ver ano<\/a>/)
  })

  it('calcula dias anterior e próximo atravessando mês e ano', () => {
    expect(getAdjacentDay(2026, 12, 31, 1)).toEqual({ year: 2027, month: 1, day: 1, href: '/calendario/2027/1/1' })
    expect(getAdjacentDay(2027, 1, 1, -1)).toEqual({ year: 2026, month: 12, day: 31, href: '/calendario/2026/12/31' })
    expect(getAdjacentDay(2026, 3, 1, -1)?.href).toBe('/calendario/2026/2/28')
  })

  it('respeita fevereiro de ano bissexto na navegação diária', () => {
    expect(getAdjacentDay(2024, 2, 28, 1)?.href).toBe('/calendario/2024/2/29')
    expect(getAdjacentDay(2024, 2, 29, 1)?.href).toBe('/calendario/2024/3/1')
    expect(getAdjacentDay(2024, 3, 1, -1)?.href).toBe('/calendario/2024/2/29')
  })

  it('exibe anterior, próximo, Hoje e retorno ao mês correto na tela diária', () => {
    const html = renderToStaticMarkup(<DayScreen year={2026} month={12} day={31} movements={[]} today={today} />)
    expect(html).toContain('href="/calendario/2026/12/30" aria-label="Dia anterior"')
    expect(html).toContain('href="/calendario/2027/1/1" aria-label="Próximo dia"')
    expect(html).toContain('href="/calendario/2026/8/15" aria-label="Hoje, abrir 15 de Agosto de 2026"')
    expect(html).toContain('href="/calendario/2026/12" aria-label="Voltar para Dezembro de 2026"')
  })

  it('gera os destinos Hoje para as três granularidades', () => {
    expect(todayYearPath(today)).toBe('/calendario/2026')
    expect(todayMonthPath(today)).toBe('/calendario/2026/8')
    expect(todayDayPath(today)).toBe('/calendario/2026/8/15')
  })

  it('mantém breadcrumbs coerentes e clicáveis conforme a profundidade', () => {
    const yearHtml = renderToStaticMarkup(<YearScreen year={2025} movements={[]} today={today} />)
    expect(yearHtml).toContain('href="/calendario/2026">Calendário</a><span>/</span><span aria-current="page">2025</span>')

    const monthHtml = renderToStaticMarkup(<MonthScreen year={2025} month={3} movements={[]} today={today} investmentPercentage={0.8} />)
    expect(monthHtml).toContain('href="/calendario/2025">2025</a><span>/</span><span aria-current="page">Março</span>')

    const dayHtml = renderToStaticMarkup(<DayScreen year={2025} month={3} day={15} movements={[]} today={today} />)
    expect(dayHtml).toContain('href="/calendario/2025">2025</a><span>/</span><a href="/calendario/2025/3">Março</a><span>/</span><span aria-current="page">15</span>')
  })

  it('destaca o período atual somente quando ano, mês e dia correspondem', () => {
    const currentYear = renderToStaticMarkup(<YearScreen year={2026} movements={[]} today={today} />)
    expect(currentYear).toContain('annual-year--current')
    expect(currentYear).toContain('mini-calendar--current')
    expect(currentYear).toContain('mini-day mini-day--today')
    const otherYear = renderToStaticMarkup(<YearScreen year={2025} movements={[]} today={today} />)
    expect(otherYear).not.toContain('annual-year--current')
    expect(otherYear).not.toContain('mini-calendar--current')
  })

  it('não altera movimentações nem indicadores durante a criação da navegação', () => {
    const before = JSON.stringify(movements)
    const summaryBefore = createMonthSummary(movements, 2026, 8, today)
    const html = renderToStaticMarkup(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />)
    const summaryAfter = createMonthSummary(movements, 2026, 8, today)
    expect(JSON.stringify(movements)).toBe(before)
    expect(summaryAfter).toEqual(summaryBefore)
    expect(html).toContain('aria-label="Ver movimentações que compõem o faturamento acumulado">R$ 1.000,00')
    expect(html).toContain('aria-label="Ver movimentações que compõem os gastos acumulados">R$ 200,00')
  })
})
