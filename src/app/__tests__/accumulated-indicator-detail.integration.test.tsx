// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ClassificacaoFinanceira, MovimentacaoFinanceira, TipoBancario } from '../../domain/transactions'
import { calcularEntradasBancarias, calcularFaturamento, calcularGastos, calcularInvestimentos, calcularReceitas, calcularResultadoBancario, calcularSaidasBancarias } from '../../domain/finance'
import { MonthScreen } from '../App'
import { createAccumulatedIndicatorDetail } from '../accumulated-indicator-detail'

const today = new Date(2026, 7, 15, 12)
const movement = (id: string, data: string, value: number, classification: ClassificacaoFinanceira, bankingType: TipoBancario = 'saida'): MovimentacaoFinanceira => ({
  id, data, valorEmCentavos: value, tipoBancario: bankingType, classificacaoFinanceira: classification,
  dadosOriginais: { Descrição: id, origem: id.startsWith('manual') ? 'manual' : 'nubank' },
})
const movements: readonly MovimentacaoFinanceira[] = [
  movement('gasto atual', '2026-08-10', 12_345, 'gasto'),
  movement('investimento atual', '2026-08-11', 20_000, 'investimento'),
  movement('faturamento atual', '2026-08-09', 30_000, 'faturamento', 'entrada'),
  movement('receita atual', '2026-08-08', 4_000, 'receita', 'entrada'),
  movement('gasto futuro', '2026-08-20', 5_000, 'gasto'),
  movement('gasto julho', '2026-07-31', 7_000, 'gasto'),
  movement('transferência de entrada', '2026-08-12', 9_000, 'transferencia', 'entrada'),
]

const actionLabels = {
  bankingEntries: 'Ver movimentações que compõem as entradas bancárias acumuladas',
  bankingExits: 'Ver movimentações que compõem as saídas bancárias acumuladas',
  bankingResult: 'Ver composição do resultado bancário acumulado',
  faturamento: 'Ver movimentações que compõem o faturamento acumulado',
  receita: 'Ver movimentações que compõem a receita acumulada',
  gastos: 'Ver movimentações que compõem os gastos acumulados',
  investimentos: 'Ver movimentações que compõem os investimentos líquidos acumulados',
} as const
const detailButton = (container: HTMLElement, indicator: keyof typeof actionLabels) =>
  container.querySelector<HTMLButtonElement>(`[aria-label="${actionLabels[indicator]}"]`)

describe('detalhamento dos indicadores acumulados', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('compõe investimentos líquidos com aplicações e resgates', () => {
    const detail = createAccumulatedIndicatorDetail([
      movement('aplicação', '2026-08-10', 20_000, 'investimento'),
      movement('resgate', '2026-08-11', 8_000, 'resgate_investimento', 'entrada'),
    ], 2026, 8, 'investimentos', today)
    expect(detail?.movements.map(({ id }) => id)).toEqual(['aplicação', 'resgate'])
    expect(detail?.total).toBe(12_000)
    expect(detail?.investmentComposition).toEqual({ applications: 20_000, redemptions: 8_000, netInvestments: 12_000 })
  })

  it('exibe normalmente investimento líquido e percentual negativos', async () => {
    const negativeInvestments = [
      movement('faturamento', '2026-08-09', 100_000, 'faturamento', 'entrada'),
      movement('aplicação', '2026-08-10', 5_000, 'investimento'),
      movement('resgate', '2026-08-11', 12_000, 'resgate_investimento', 'entrada'),
    ]
    await act(async () => root.render(<MonthScreen year={2026} month={8} movements={negativeInvestments} today={today} investmentPercentage={0.8} />))
    expect(detailButton(container, 'investimentos')?.textContent).toBe('-R$ 70,00')
    expect(detailButton(container, 'investimentos')?.parentElement?.textContent).toContain('-7,00% do faturamento')

    await act(async () => detailButton(container, 'investimentos')?.click())
    const dialogText = container.querySelector<HTMLElement>('[role="dialog"]')?.textContent
    expect(dialogText).toContain('AplicaçõesR$ 50,00')
    expect(dialogText).toContain('ResgatesR$ 120,00')
    expect(dialogText).toContain('Investimentos líquidos = R$ 50,00 − R$ 120,00 = -R$ 70,00')
  })

  it('abre gastos e investimentos com somente a classificação e o período que compõem cada total', async () => {
    await act(async () => root.render(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />))

    const expensesButton = detailButton(container, 'gastos')
    expect(expensesButton?.tagName).toBe('BUTTON')
    expect(expensesButton?.textContent).toBe('R$ 123,45')
    expensesButton?.focus()
    await act(async () => expensesButton?.click())

    const expensesDialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(expensesDialog?.textContent).toContain('gasto atual')
    expect(expensesDialog?.textContent).not.toContain('investimento atual')
    expect(expensesDialog?.textContent).not.toContain('gasto futuro')
    expect(expensesDialog?.textContent).not.toContain('gasto julho')
    expect(expensesDialog?.textContent).not.toContain('transferência de entrada')
    expect(expensesDialog?.textContent).toContain('1 movimentação')
    expect(expensesDialog?.textContent).toContain('Gastos acumuladosR$ 123,45')
    expect(expensesDialog?.textContent).toContain('Faturamento acumuladoR$ 300,00')
    expect(expensesDialog?.textContent).toContain('Percentual efetivamente gasto41,15%')
    expect(expensesDialog?.textContent).toContain('Percentual efetivamente gasto = Gastos acumulados ÷ Faturamento acumulado')
    expect(expensesDialog?.querySelector('.indicator-detail-summary strong')?.textContent).toBe(expensesButton?.textContent)
    expect(document.activeElement?.getAttribute('aria-label')).toContain('Fechar detalhamento')

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(expensesButton)

    await act(async () => detailButton(container, 'investimentos')?.click())
    const investmentsDialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(investmentsDialog?.textContent).toContain('investimento atual')
    expect(investmentsDialog?.textContent).not.toContain('gasto atual')
    expect(investmentsDialog?.querySelector('.indicator-detail-summary strong')?.textContent).toBe('R$ 200,00')
    expect(investmentsDialog?.textContent).toContain('Faturamento acumuladoR$ 300,00')
    expect(investmentsDialog?.textContent).toContain('Percentual efetivamente investido66,67%')
    expect(investmentsDialog?.textContent).toContain('AplicaçõesR$ 200,00')
    expect(investmentsDialog?.textContent).toContain('ResgatesR$ 0,00')
    expect(investmentsDialog?.textContent).toContain('Investimentos líquidos = R$ 200,00 − R$ 0,00 = R$ 200,00')
    expect(investmentsDialog?.textContent).toContain('Percentual efetivamente investido = Investimentos líquidos acumulados ÷ Faturamento acumulado')
    await act(async () => investmentsDialog?.querySelector<HTMLButtonElement>('.primary-button')?.click())
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('detalha faturamento e receita exclusivamente pela classificação financeira', async () => {
    await act(async () => root.render(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />))

    await act(async () => detailButton(container, 'faturamento')?.click())
    let dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('Movimentações que compõem Faturamento acumulado')
    expect(dialog?.textContent).toContain('faturamento atual')
    expect(dialog?.textContent).not.toContain('receita atual')
    expect(dialog?.textContent).not.toContain('transferência de entrada')
    expect(dialog?.querySelector('.indicator-detail-summary strong')?.textContent).toBe(detailButton(container, 'faturamento')?.textContent)
    await act(async () => dialog?.querySelector<HTMLButtonElement>('.primary-button')?.click())

    await act(async () => detailButton(container, 'receita')?.click())
    dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('Movimentações que compõem Receita acumulada')
    expect(dialog?.textContent).toContain('receita atual')
    expect(dialog?.textContent).not.toContain('faturamento atual')
    expect(dialog?.querySelector('.indicator-detail-summary strong')?.textContent).toBe(detailButton(container, 'receita')?.textContent)
  })

  it('detalha entradas e saídas somente pelo tipo bancário, independentemente da classificação', async () => {
    await act(async () => root.render(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />))

    await act(async () => detailButton(container, 'bankingEntries')?.click())
    let dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('Movimentações que compõem Entradas bancárias acumuladas')
    expect(dialog?.textContent).toContain('faturamento atual')
    expect(dialog?.textContent).toContain('receita atual')
    expect(dialog?.textContent).toContain('transferência de entrada')
    expect(dialog?.textContent).not.toContain('gasto atual')
    expect(dialog?.textContent).not.toContain('investimento atual')
    expect(dialog?.querySelector('.indicator-detail-summary strong')?.textContent).toBe(detailButton(container, 'bankingEntries')?.textContent)
    await act(async () => dialog?.querySelector<HTMLButtonElement>('.primary-button')?.click())

    await act(async () => detailButton(container, 'bankingExits')?.click())
    dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('Movimentações que compõem Saídas bancárias acumuladas')
    expect(dialog?.textContent).toContain('gasto atual')
    expect(dialog?.textContent).toContain('investimento atual')
    expect(dialog?.textContent).not.toContain('faturamento atual')
    expect(dialog?.textContent).not.toContain('transferência de entrada')
    expect(dialog?.querySelector('.indicator-detail-summary strong')?.textContent).toBe(detailButton(container, 'bankingExits')?.textContent)
  })

  it('apresenta a composição derivada do resultado e todas as movimentações bancárias do período', async () => {
    await act(async () => root.render(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />))
    const resultButton = detailButton(container, 'bankingResult')
    await act(async () => resultButton?.click())

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('Composição do Resultado bancário acumulado')
    expect(dialog?.textContent).toContain('Resultado bancário = Entradas bancárias − Saídas bancárias')
    expect(dialog?.querySelector('.indicator-detail-composition div:nth-child(1) strong')?.textContent).toBe(detailButton(container, 'bankingEntries')?.textContent)
    expect(dialog?.querySelector('.indicator-detail-composition div:nth-child(2) strong')?.textContent).toBe(detailButton(container, 'bankingExits')?.textContent)
    expect(dialog?.querySelector('.indicator-detail-composition__result strong')?.textContent).toBe(resultButton?.textContent)
    expect(dialog?.querySelector('.indicator-detail-summary strong')?.textContent).toBe(resultButton?.textContent)
    expect(dialog?.textContent).toContain('faturamento atual')
    expect(dialog?.textContent).toContain('receita atual')
    expect(dialog?.textContent).toContain('transferência de entrada')
    expect(dialog?.textContent).toContain('gasto atual')
    expect(dialog?.textContent).toContain('investimento atual')
    expect(dialog?.textContent).not.toContain('gasto futuro')
    expect(dialog?.textContent).not.toContain('gasto julho')
  })

  it('atualiza indicador e detalhamento aberto quando a classificação muda', async () => {
    await act(async () => root.render(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />))
    await act(async () => detailButton(container, 'gastos')?.click())

    const reclassified = movements.map((item) => item.id === 'gasto atual'
      ? { ...item, classificacaoFinanceira: 'investimento' as const }
      : item)
    await act(async () => root.render(<MonthScreen year={2026} month={8} movements={reclassified} today={today} investmentPercentage={0.8} />))

    expect(detailButton(container, 'gastos')?.textContent).toBe('R$ 0,00')
    expect(container.querySelector('.indicator-detail-summary strong')?.textContent).toBe('R$ 0,00')
    expect(container.querySelector('[role="dialog"]')?.textContent).not.toContain('gasto atual')
    await act(async () => container.querySelector<HTMLElement>('.modal-backdrop')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(detailButton(container, 'investimentos')?.textContent).toBe('R$ 323,45')
  })

  it('reclassifica entre faturamento e receita sem alterar os detalhamentos bancários', async () => {
    await act(async () => root.render(<MonthScreen year={2026} month={8} movements={movements} today={today} investmentPercentage={0.8} />))
    const entriesBefore = detailButton(container, 'bankingEntries')?.textContent
    const exitsBefore = detailButton(container, 'bankingExits')?.textContent
    const resultBefore = detailButton(container, 'bankingResult')?.textContent
    await act(async () => detailButton(container, 'faturamento')?.click())

    const reclassified = movements.map((item) => item.id === 'faturamento atual'
      ? { ...item, classificacaoFinanceira: 'receita' as const }
      : item)
    await act(async () => root.render(<MonthScreen year={2026} month={8} movements={reclassified} today={today} investmentPercentage={0.8} />))

    expect(detailButton(container, 'faturamento')?.textContent).toBe('R$ 0,00')
    expect(container.querySelector('.indicator-detail-summary strong')?.textContent).toBe('R$ 0,00')
    expect(container.querySelector('[role="dialog"]')?.textContent).not.toContain('faturamento atual')
    expect(detailButton(container, 'receita')?.textContent).toBe('R$ 340,00')
    expect(detailButton(container, 'bankingEntries')?.textContent).toBe(entriesBefore)
    expect(detailButton(container, 'bankingExits')?.textContent).toBe(exitsBefore)
    expect(detailButton(container, 'bankingResult')?.textContent).toBe(resultBefore)
  })

  it('deriva lista e total das funções do domínio sem oferecer detalhe para mês futuro', () => {
    const expenses = createAccumulatedIndicatorDetail(movements, 2026, 8, 'gastos', today)
    const investments = createAccumulatedIndicatorDetail(movements, 2026, 8, 'investimentos', today)
    const billing = createAccumulatedIndicatorDetail(movements, 2026, 8, 'faturamento', today)
    const income = createAccumulatedIndicatorDetail(movements, 2026, 8, 'receita', today)
    const entries = createAccumulatedIndicatorDetail(movements, 2026, 8, 'bankingEntries', today)
    const exits = createAccumulatedIndicatorDetail(movements, 2026, 8, 'bankingExits', today)
    const bankingResult = createAccumulatedIndicatorDetail(movements, 2026, 8, 'bankingResult', today)
    const pastExpenses = createAccumulatedIndicatorDetail(movements, 2026, 7, 'gastos', today)
    expect(expenses?.total).toBe(calcularGastos(expenses?.movements ?? []))
    expect(investments?.total).toBe(calcularInvestimentos(investments?.movements ?? []))
    expect(billing?.total).toBe(calcularFaturamento(billing?.movements ?? []))
    expect(income?.total).toBe(calcularReceitas(income?.movements ?? []))
    expect(entries?.total).toBe(calcularEntradasBancarias(entries?.movements ?? []))
    expect(exits?.total).toBe(calcularSaidasBancarias(exits?.movements ?? []))
    expect(bankingResult?.total).toBe(calcularResultadoBancario(bankingResult?.movements ?? []))
    expect(bankingResult?.bankingComposition).toEqual({
      entries: calcularEntradasBancarias(bankingResult?.movements ?? []),
      exits: calcularSaidasBancarias(bankingResult?.movements ?? []),
      result: calcularResultadoBancario(bankingResult?.movements ?? []),
    })
    expect(pastExpenses?.movements.map(({ id }) => id)).toEqual(['gasto julho'])
    expect(pastExpenses?.total).toBe(7_000)
    expect(createAccumulatedIndicatorDetail(movements, 2026, 9, 'gastos', today)).toBeNull()
  })
})
