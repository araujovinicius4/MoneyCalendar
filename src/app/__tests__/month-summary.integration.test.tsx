import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { calcularEntradasBancarias, calcularGastos, calcularIndiceAcumulacao, calcularInvestimentos, calcularLucro, calcularPercentualEfetivamenteGasto, calcularPercentualEfetivamenteInvestido, calcularSaidasBancarias } from '../../domain/finance'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { MonthScreen } from '../App'
import { createMonthSummary } from '../month-summary'

const movements: readonly MovimentacaoFinanceira[] = [
  { id: 'jun', data: '2026-06-30', valorEmCentavos: 999_900, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  { id: 'jul-gasto', data: '2026-07-01', valorEmCentavos: 10_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: {} },
  { id: 'jul-investimento', data: '2026-07-20', valorEmCentavos: 20_000, tipoBancario: 'saida', classificacaoFinanceira: 'investimento', dadosOriginais: {} },
  { id: 'jul-transferencia', data: '2026-07-31', valorEmCentavos: 30_000, tipoBancario: 'saida', classificacaoFinanceira: 'transferencia', dadosOriginais: {} },
  { id: 'ago-hoje', data: '2026-08-14', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  { id: 'ago-futuro', data: '2026-08-15', valorEmCentavos: 800_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  { id: 'set', data: '2026-09-01', valorEmCentavos: 700_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
]
const today = new Date(2026, 7, 14, 12)

describe('resumo financeiro mensal integrado', () => {
  it('inclui apenas movimentações do mês correto', () => {
    expect(createMonthSummary(movements, 2026, 7, today)?.movements.map(({ id }) => id))
      .toEqual(['jul-gasto', 'jul-investimento', 'jul-transferencia'])
  })

  it('ignora dias futuros no mês atual', () => {
    const summary = createMonthSummary(movements, 2026, 8, today)
    expect(summary?.movements.map(({ id }) => id)).toEqual(['ago-hoje'])
    const html = renderToStaticMarkup(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />)
    expect(html).toContain('aria-label="Ver movimentações que compõem as entradas bancárias acumuladas">R$ 1.000,00')
    expect(html).not.toContain('R$ 9.000,00')
  })

  it('considera o mês passado inteiro, inclusive o último dia', () => {
    const summary = createMonthSummary(movements, 2026, 7, today)
    expect(summary?.period).toBe('past')
    expect(summary?.bankingExits).toBe(60_000)
    expect(summary?.movements.some(({ data }) => data === '2026-07-31')).toBe(true)
  })

  it('não exibe totais financeiros para meses futuros', () => {
    const html = renderToStaticMarkup(<MonthScreen year={2026} month={9} movements={movements} today={today} investmentPercentage={0.8} />)
    expect(html).toContain('Resumo do mês')
    expect(html).toContain('quando este mês começar')
    expect(html).not.toContain('Entradas bancárias acumuladas')
    expect(createMonthSummary(movements, 2026, 9, today)).toBeNull()
  })

  it('não inclui investimento nem transferência nos gastos', () => {
    const summary = createMonthSummary(movements, 2026, 7, today)
    expect(summary?.expenses).toBe(10_000)
    expect(summary?.investments).toBe(20_000)
  })

  it('preserva aplicações e resgates brutos e publica o investimento líquido', () => {
    const withRedemption: readonly MovimentacaoFinanceira[] = [
      ...movements,
      { id: 'jul-resgate', data: '2026-07-21', valorEmCentavos: 7_000, tipoBancario: 'entrada', classificacaoFinanceira: 'resgate_investimento', dadosOriginais: {} },
    ]
    const summary = createMonthSummary(withRedemption, 2026, 7, today)
    expect(summary?.applications).toBe(20_000)
    expect(summary?.investmentRedemptions).toBe(7_000)
    expect(summary?.investments).toBe(13_000)
  })

  it('exibe valores obtidos pelas funções do domínio', () => {
    const summary = createMonthSummary(movements, 2026, 7, today)
    expect(summary).not.toBeNull()
    if (!summary) return
    expect(summary.bankingEntries).toBe(calcularEntradasBancarias(summary.movements))
    expect(summary.bankingExits).toBe(calcularSaidasBancarias(summary.movements))
    expect(summary.expenses).toBe(calcularGastos(summary.movements))
    expect(summary.profit).toBe(calcularLucro(summary.movements))
    expect(summary.investments).toBe(calcularInvestimentos(summary.movements))
    expect(summary.percentualEfetivamenteGasto).toBe(calcularPercentualEfetivamenteGasto(summary.movements))
    expect(summary.percentualEfetivamenteInvestido).toBe(calcularPercentualEfetivamenteInvestido(summary.movements))
    expect(summary.accumulationIndex).toBe(calcularIndiceAcumulacao(summary.movements))
    const html = renderToStaticMarkup(<MonthScreen year={2026} month={7} movements={movements} today={today} investmentPercentage={0.8} />)
    expect(html).toContain('aria-label="Ver movimentações que compõem os gastos acumulados">R$ 100,00')
    expect(html).toContain('Lucro acumulado</dt><dd class="financial-value--negative">-R$ 100,00')
    expect(html).toContain('Investimentos líquidos acumulados')
    expect(html).toContain('aria-label="Ver movimentações que compõem os investimentos líquidos acumulados">R$ 200,00')
    expect(html.match(/— do faturamento/g)).toHaveLength(2)
    expect(html).toContain('aria-label="Ver memória de cálculo do Índice de acumulação">2,00 (200,00%)')
    expect(html).toContain('Você investiu R$ 2,00 para cada R$ 1,00 gasto.')
    expect(html).toContain('&gt; 1</b> investiu mais do que gastou')
    expect(html).toContain('= 1</b> investiu o mesmo que gastou')
    expect(html).toContain('&lt; 1</b> gastou mais do que investiu')
  })

  it('exibe os percentuais realizados junto aos valores e preserva os botões monetários', () => {
    const realizados: readonly MovimentacaoFinanceira[] = [
      { id: 'fat', data: '2026-07-01', valorEmCentavos: 40_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
      { id: 'gasto', data: '2026-07-02', valorEmCentavos: 10_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: {} },
      { id: 'inv', data: '2026-07-03', valorEmCentavos: 20_000, tipoBancario: 'saida', classificacaoFinanceira: 'investimento', dadosOriginais: {} },
    ]
    const html = renderToStaticMarkup(<MonthScreen year={2026} month={7} movements={realizados} today={today} investmentPercentage={0.1} />)
    expect(html).toContain('aria-label="Ver movimentações que compõem os gastos acumulados">R$ 100,00</button><span class="metric-supplemental">25,00% do faturamento</span>')
    expect(html).toContain('aria-label="Ver movimentações que compõem os investimentos líquidos acumulados">R$ 200,00</button><span class="metric-supplemental">50,00% do faturamento</span>')
    expect(createMonthSummary(realizados, 2026, 7, today)?.accumulationIndex).toBe(2)
  })
})
