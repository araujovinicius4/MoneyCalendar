import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  calcularFaturamento,
  calcularGastos,
  calcularIndiceAcumulacao,
  calcularInvestimentos,
} from '../../domain/finance'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { YearScreen } from '../App'
import { createMonthSummary } from '../month-summary'

const today = new Date(2026, 7, 15, 12)
const movements: readonly MovimentacaoFinanceira[] = [
  { id: 'jul-billing', data: '2026-07-01', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  { id: 'jul-expense', data: '2026-07-31', valorEmCentavos: 20_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: {} },
  { id: 'jul-investment', data: '2026-07-20', valorEmCentavos: 30_000, tipoBancario: 'saida', classificacaoFinanceira: 'investimento', dadosOriginais: {} },
  { id: 'jul-transfer-out', data: '2026-07-10', valorEmCentavos: 40_000, tipoBancario: 'saida', classificacaoFinanceira: 'transferencia', dadosOriginais: {} },
  { id: 'jul-transfer-in', data: '2026-07-11', valorEmCentavos: 50_000, tipoBancario: 'entrada', classificacaoFinanceira: 'transferencia', dadosOriginais: {} },
  { id: 'aug-billing', data: '2026-08-15', valorEmCentavos: 50_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  { id: 'aug-transfer', data: '2026-08-14', valorEmCentavos: 25_000, tipoBancario: 'entrada', classificacaoFinanceira: 'transferencia', dadosOriginais: {} },
  { id: 'aug-future-expense', data: '2026-08-20', valorEmCentavos: 99_900, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: {} },
  { id: 'sep-future', data: '2026-09-01', valorEmCentavos: 70_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
]

const html = renderToStaticMarkup(<YearScreen year={2026} movements={movements} today={today} />)
const monthCard = (name: string) => {
  const match = html.match(new RegExp(`<a[^>]*aria-label="Abrir ${name} de 2026"[\\s\\S]*?</a>`))
  if (!match) throw new Error(`Cartão de ${name} não encontrado`)
  return match[0]
}

describe('resumo financeiro compacto no calendário anual', () => {
  it('mantém os 12 meses e a navegação mensal', () => {
    expect((html.match(/aria-label="Abrir [^"]+ de 2026"/g) ?? [])).toHaveLength(12)
    expect(monthCard('Julho')).toContain('href="/calendario/2026/7"')
  })

  it('usa os totais e o índice produzidos pelas funções financeiras existentes', () => {
    const summary = createMonthSummary(movements, 2026, 7, today)
    expect(summary).not.toBeNull()
    if (!summary) return
    expect(summary.faturamento).toBe(calcularFaturamento(summary.movements))
    expect(summary.expenses).toBe(calcularGastos(summary.movements))
    expect(summary.investments).toBe(calcularInvestimentos(summary.movements))
    expect(summary.accumulationIndex).toBe(calcularIndiceAcumulacao(summary.movements))
    expect(monthCard('Julho')).toContain('aria-label="Faturamento do mês: R$ 1.000,00"')
    expect(monthCard('Julho')).toContain('aria-label="Gastos do mês: R$ 200,00"')
    expect(monthCard('Julho')).toContain('aria-label="Investimentos do mês: R$ 300,00"')
    expect(monthCard('Julho')).toContain('aria-label="Índice de acumulação do mês: 1,50"')
  })

  it('considera o mês passado inteiro e mantém a quantidade de movimentações', () => {
    expect(createMonthSummary(movements, 2026, 7, today)?.movements).toHaveLength(5)
    expect(monthCard('Julho')).toContain('5 mov.')
    expect(monthCard('Julho')).toContain('R$ 200,00')
  })

  it('ignora movimentações futuras no mês atual sem alterar sua contagem existente', () => {
    const august = createMonthSummary(movements, 2026, 8, today)
    expect(august?.movements.map(({ id }) => id)).toEqual(['aug-billing', 'aug-transfer'])
    expect(monthCard('Agosto')).toContain('3 mov.')
    expect(monthCard('Agosto')).toContain('aria-label="Gastos do mês: R$ 0,00"')
    expect(monthCard('Agosto')).toContain('aria-label="Índice de acumulação do mês: —"')
    expect(monthCard('Agosto')).not.toContain('R$ 999,00')
  })

  it('não exibe totais financeiros nos meses futuros', () => {
    expect(createMonthSummary(movements, 2026, 9, today)).toBeNull()
    expect(monthCard('Setembro')).toContain('1 mov.')
    expect(monthCard('Setembro')).not.toContain('mini-calendar__finance')
  })

  it('não transforma transferências em gastos ou faturamento', () => {
    const july = createMonthSummary(movements, 2026, 7, today)
    expect(july?.faturamento).toBe(100_000)
    expect(july?.expenses).toBe(20_000)
  })

  it('delega o período e os cálculos ao resumo existente, sem fórmula anual duplicada', () => {
    const source = import.meta.glob('../App.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const appSource = Object.values(source)[0]
    expect(appSource).toContain('createMonthSummary(movements, year, month.month, today)')
    expect(appSource).not.toMatch(/financialSummary\.investments\s*\/\s*financialSummary\.expenses/)
  })
})
