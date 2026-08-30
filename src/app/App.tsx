import { Link, useCalendarRoute, usePathname } from './router'
import { monthPath, yearPath } from './routes'
import { useState, type ReactNode } from 'react'
import { createYearCalendar, MONTHS, WEEKDAYS as MINI_WEEKDAYS } from './year-calendar'
import { createMonthCalendar } from './month-calendar'
import type { ClassificacaoFinanceira, MovimentacaoFinanceira } from '../domain/transactions'
import {
  calcularEntradasBancarias,
  calcularFaturamento,
  calcularGastos,
  calcularIndiceAcumulacao,
  calcularInvestimentos,
  calcularLucro,
  calcularResultadoBancario,
  calcularReceitas,
  calcularSaidasBancarias,
} from '../domain/finance'
import { ImportCsvModal } from './ImportCsvModal'
import { createMonthSummary, createOperationalMonthSummary, createYearProfit } from './month-summary'
import { reclassifyMovementInMemory } from './reclassify-movement'
import {
  loadInvestmentPercentage,
  loadImportHistory,
  loadMovements,
  loadOnboardingDismissed,
  saveOnboardingDismissed,
  saveInvestmentPercentage,
  saveImportHistory,
  saveMovements,
} from '../infrastructure/storage'
import { NewMovementModal } from './NewMovementModal'
import {
  deleteManualMovementInMemory,
  isManualMovement,
  updateManualMovementInMemory,
  type ManualMovement,
} from './manual-movement'
import { reconcileImportedMovements } from './reconcile-import'
import { IndicatorHelp } from './IndicatorHelp'
import type { DayIndicatorId } from './day-indicator-help'
import { DAY_INDICATOR_HELP } from './day-indicator-help'
import { MONTH_INDICATOR_HELP, type MonthIndicatorId } from './month-indicator-help'
import { getAdjacentDay, todayDayPath, todayMonthPath, todayYearPath } from './temporal-navigation'
import { getClassificacoesPermitidas, isClassificacaoPermitida } from './classification-options'
import { createImportBatch, reverseImportBatch } from './import-history'
import { ImportHistoryModal } from './ImportHistoryModal'
import { AccumulatedIndicatorDetailModal } from './AccumulatedIndicatorDetailModal'
import { ACCUMULATED_INDICATOR_DEFINITIONS, createAccumulatedIndicatorDetail, type DetailedAccumulatedIndicator } from './accumulated-indicator-detail'
import { getMovementDescription } from './movement-presentation'
import { CalculationDetailModal } from './CalculationDetailModal'
import { createOperationalCalculationDetail, OPERATIONAL_CALCULATION_ACTION_LABELS, type OperationalCalculationId } from './operational-calculation-detail'
import { ACCUMULATION_INDEX_ACTION_LABEL, createAccumulationIndexCalculationDetail } from './accumulation-index-calculation-detail'
import { LandingPage, LoginScreen } from './PublicPages'
import { getFinancialValueClassName, type FinancialSemanticType } from './financial-value-state'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

function Shell({ children, onImport, onHistory }: { children: ReactNode; onImport: () => void; onHistory: () => void }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href={yearPath(new Date().getFullYear())} aria-label="MoneyCalendar, início">
          <span className="brand-mark">M</span>
          <span>MoneyCalendar</span>
        </Link>
        <span className="version">v2</span>
        <div className="topbar-actions">
          <button className="topbar-history" type="button" onClick={onHistory}>Histórico</button>
          <button className="topbar-import" type="button" onClick={onImport}>Importar CSV</button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}

function EmptyDataActions({ onImport, onAdd, addLabel = 'Adicionar movimentação' }: { readonly onImport?: () => void; readonly onAdd?: () => void; readonly addLabel?: string }) {
  return (
    <div className="empty-data-actions">
      <button type="button" onClick={onImport}>Importar CSV</button>
      <button type="button" onClick={onAdd}>{addLabel}</button>
    </div>
  )
}

function WelcomeGuide({ onClose, onImport, onAdd }: { readonly onClose: () => void; readonly onImport: () => void; readonly onAdd: () => void }) {
  return (
    <aside className="welcome-guide" aria-label="Primeiros passos">
      <button className="welcome-guide__close" type="button" onClick={onClose} aria-label="Fechar orientação inicial">×</button>
      <div><p className="eyebrow">Primeiros passos</p><h2>Comece com suas movimentações</h2></div>
      <p>Importe um CSV ou adicione movimentações manualmente. Depois, classifique-as como faturamento, receita, gasto, investimento, transferência ou estorno e acompanhe tudo por ano, mês e dia.</p>
      <EmptyDataActions onImport={onImport} onAdd={onAdd} addLabel="Adicionar movimentação manual" />
    </aside>
  )
}

function Breadcrumbs({ year, month, day, today = new Date() }: { year: number; month?: number; day?: number; today?: Date }) {
  return (
    <nav className="breadcrumbs" aria-label="Navegação estrutural">
      <Link href={todayYearPath(today)}>Calendário</Link>
      <span>/</span>
      {month ? <Link href={yearPath(year)}>{year}</Link> : <span aria-current="page">{year}</span>}
      {month && <><span>/</span>{day ? <Link href={monthPath(year, month)}>{MONTHS[month - 1]}</Link> : <span aria-current="page">{MONTHS[month - 1]}</span>}</>}
      {day && <><span>/</span><span aria-current="page">{day}</span></>}
    </nav>
  )
}

export function YearScreen({ year, movements, today = new Date() }: { year: number; movements: readonly MovimentacaoFinanceira[]; today?: Date }) {
  const months = createYearCalendar(year, today)
  const annualProfit = createYearProfit(movements, year, today)

  return (
    <section className="page annual-page">
      <Breadcrumbs year={year} today={today} />
      <div className="page-heading annual-heading">
        <div><p className="eyebrow">Calendário anual</p><h1 className={year === today.getFullYear() ? 'annual-year--current' : undefined}>{year}</h1>{movements.length === 0 && <span className="annual-empty-note">Ainda não existem movimentações.</span>}{annualProfit !== null && <dl className="annual-profit"><div><dt>Lucro acumulado no ano</dt><dd className={getFinancialValueClassName(annualProfit, 'profit')}>{formatMoney(annualProfit)}</dd></div></dl>}</div>
        <nav className="period-navigation" aria-label="Navegar entre anos">
          {year > 1 && <Link href={yearPath(year - 1)} aria-label={`Ano anterior, ${year - 1}`}>← <span>{year - 1}</span></Link>}
          <Link href={todayYearPath(today)} aria-label={`Hoje, abrir ano ${today.getFullYear()}`}>Hoje</Link>
          {year < 9999 && <Link href={yearPath(year + 1)} aria-label={`Próximo ano, ${year + 1}`}><span>{year + 1}</span> →</Link>}
        </nav>
      </div>
      <div className="year-grid">
        {months.map((month) => {
          const movementCount = movements.filter((movement) => movement.data.startsWith(`${year}-${String(month.month).padStart(2, '0')}-`)).length
          const financialSummary = createMonthSummary(movements, year, month.month, today)
          return (
          <Link
            className={`mini-calendar${month.isCurrentMonth ? ' mini-calendar--current' : ''}`}
            href={month.href}
            aria-label={`Abrir ${month.name} de ${year}`}
            key={month.month}
          >
            <header className="mini-calendar__header">
              <strong>{month.name}</strong>
              <span>{movementCount > 0 ? `${movementCount} mov.` : String(month.month).padStart(2, '0')}</span>
            </header>
            <div className="mini-calendar__grid" aria-hidden="true">
              {MINI_WEEKDAYS.map((weekday, index) => <span className="mini-weekday" key={`${weekday}-${index}`}>{weekday}</span>)}
              {month.cells.map((day, index) => day === null
                ? <span key={`empty-${index}`} />
                : <span className={day.isToday ? 'mini-day mini-day--today' : 'mini-day'} key={day.number}>{day.number}</span>
              )}
            </div>
            {financialSummary && financialSummary.movements.length > 0 && (
              <div className="mini-calendar__finance" aria-label={`Resumo financeiro de ${month.name}`}>
                <span aria-label={`Faturamento do mês: ${formatMoney(financialSummary.faturamento)}`}><b>Fat.</b> {formatCompactMoney(financialSummary.faturamento)}</span>
                <span aria-label={`Gastos do mês: ${formatMoney(financialSummary.expenses)}`}><b>Gas.</b> {formatCompactMoney(financialSummary.expenses)}</span>
                <span className={getFinancialValueClassName(financialSummary.profit, 'profit')} aria-label={`Lucro do mês: ${formatMoney(financialSummary.profit)}`}><b>Luc.</b> {formatCompactMoney(financialSummary.profit)}</span>
                <span aria-label={`Investimentos do mês: ${formatMoney(financialSummary.investments)}`}><b>Inv.</b> {formatCompactMoney(financialSummary.investments)}</span>
                <span aria-label={`Índice de acumulação do mês: ${financialSummary.accumulationIndex === null ? '—' : decimalFormatter.format(financialSummary.accumulationIndex)}`}><b>IA</b> {financialSummary.accumulationIndex === null ? '—' : decimalFormatter.format(financialSummary.accumulationIndex)}</span>
              </div>
            )}
          </Link>
        )})}
      </div>
    </section>
  )
}

interface MonthScreenProps {
  readonly year: number
  readonly month: number
  readonly movements: readonly MovimentacaoFinanceira[]
  readonly today?: Date
  readonly investmentPercentage: number
  readonly onInvestmentPercentageChange?: (percentage: number) => void
  readonly onImport?: () => void
  readonly onAddMovement?: () => void
}

export function MonthScreen({ year, month, movements, today = new Date(), investmentPercentage, onInvestmentPercentageChange, onImport, onAddMovement }: MonthScreenProps) {
  const [openDetail, setOpenDetail] = useState<DetailedAccumulatedIndicator | null>(null)
  const [openCalculation, setOpenCalculation] = useState<OperationalCalculationId | 'accumulationIndex' | null>(null)
  const calendar = createMonthCalendar(year, month, today)
  const summary = createMonthSummary(movements, year, month, today)
  const operationalSummary = createOperationalMonthSummary(summary, investmentPercentage, today)
  const bankingMetrics = summary ? [
    { indicator: 'bankingEntries', label: 'Entradas bancárias acumuladas', value: formatMoney(summary.bankingEntries), rawValue: summary.bankingEntries, detail: 'bankingEntries' },
    { indicator: 'bankingExits', label: 'Saídas bancárias acumuladas', value: formatMoney(summary.bankingExits), rawValue: summary.bankingExits, detail: 'bankingExits' },
    { indicator: 'bankingResult', label: 'Resultado bancário acumulado', value: formatMoney(summary.bankingResult), rawValue: summary.bankingResult, detail: 'bankingResult' },
  ] as const : []
  const financialMetrics = summary ? [
    { indicator: 'profit', label: 'Lucro acumulado', value: formatMoney(summary.profit), rawValue: summary.profit },
    { indicator: 'faturamento', label: 'Faturamento acumulado', value: formatMoney(summary.faturamento), rawValue: summary.faturamento, detail: 'faturamento' },
    { indicator: 'gastos', label: 'Gastos acumulados', value: formatMoney(summary.expenses), rawValue: summary.expenses, supplementalValue: `${summary.percentualEfetivamenteGasto === null ? '—' : percentFormatter.format(summary.percentualEfetivamenteGasto)} do faturamento`, detail: 'gastos' },
    { indicator: 'investimentos', label: 'Investimentos líquidos acumulados', value: formatMoney(summary.investments), rawValue: summary.investments, supplementalValue: `${summary.percentualEfetivamenteInvestido === null ? '—' : percentFormatter.format(summary.percentualEfetivamenteInvestido)} do faturamento`, detail: 'investimentos' },
    { indicator: 'receita', label: 'Receita acumulada', value: formatMoney(summary.receita), rawValue: summary.receita, detail: 'receita' },
  ] as const : []
  const indicatorDetail = openDetail
    ? createAccumulatedIndicatorDetail(movements, year, month, openDetail, today)
    : null
  const calculationDetail = openCalculation && summary
    ? openCalculation === 'accumulationIndex'
      ? createAccumulationIndexCalculationDetail(summary, year, month, today)
      : operationalSummary
        ? createOperationalCalculationDetail(openCalculation, summary, operationalSummary, year, month, today)
        : null
    : null

  return (
    <section className="page month-page">
      <Breadcrumbs year={year} month={month} today={today} />
      <div className="page-heading month-heading">
        <div><p className="eyebrow">Calendário mensal</p><h1>{MONTHS[month - 1]} <span>{year}</span></h1></div>
        <div className="month-navigation" aria-label="Navegar entre meses">
          <Link className="month-navigation__link" href={calendar.previous.href} aria-label="Mês anterior">
            <span aria-hidden="true">←</span>
            <span className="month-navigation__label">{MONTHS[calendar.previous.month - 1]} {calendar.previous.year}</span>
          </Link>
          <Link className="month-navigation__year" href={yearPath(year)}>Ver ano</Link>
          <Link className="month-navigation__year" href={todayMonthPath(today)} aria-label={`Hoje, abrir ${MONTHS[today.getMonth()]} de ${today.getFullYear()}`}>Hoje</Link>
          <Link className="month-navigation__link month-navigation__link--next" href={calendar.next.href} aria-label="Próximo mês">
            <span className="month-navigation__label">{MONTHS[calendar.next.month - 1]} {calendar.next.year}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      <div className="calendar" aria-label={`${MONTHS[month - 1]} de ${year}`}>
        {WEEKDAYS.map((weekday) => <div className="weekday" key={weekday}>{weekday}</div>)}
        {calendar.cells.map((day, index) => day === null
          ? <div className="day-cell day-cell--empty" key={`empty-${index}`} />
          : <Link
              className={day.isToday ? 'day-cell day-cell--today' : 'day-cell'}
              href={day.href}
              aria-label={`${day.number} de ${MONTHS[month - 1]} de ${year}`}
              key={day.number}
            >
              <span>{day.number}</span>
              {movements.some((movement) => movement.data === `${year}-${String(month).padStart(2, '0')}-${String(day.number).padStart(2, '0')}`) && <i className="movement-dot" aria-label="Possui movimentações" />}
            </Link>
        )}
      </div>
      <section className="month-summary" aria-labelledby="month-summary-title">
        <header>
          <div><p className="eyebrow">Visão acumulada</p><h2 id="month-summary-title">Resumo do mês</h2></div>
          {summary?.period === 'current' && <span>Até hoje</span>}
        </header>
        {summary === null || summary.movements.length === 0 ? (
          <div className="month-summary__empty" role="status">
            <p>{summary === null ? 'Os totais financeiros ficarão disponíveis quando este mês começar.' : 'Nenhuma movimentação neste mês.'}</p>
            <EmptyDataActions onImport={onImport} onAdd={onAddMovement} />
          </div>
        ) : (
          <>
            <div className="month-summary__sections">
              <section className="month-summary__section" aria-labelledby="month-banking-title">
                <h3 id="month-banking-title">Dados bancários acumulados</h3>
                <dl className="month-summary__metrics month-summary__metrics--banking">
                  {bankingMetrics.map((metric) => <MonthlyMetric
                    {...metric}
                    onValueClick={'detail' in metric ? () => setOpenDetail(metric.detail) : undefined}
                    valueActionLabel={'detail' in metric ? ACCUMULATED_INDICATOR_DEFINITIONS[metric.detail].actionLabel : undefined}
                    key={metric.indicator}
                  />)}
                </dl>
              </section>
              <section className="month-summary__section" aria-labelledby="month-finance-title">
                <h3 id="month-finance-title">Desempenho financeiro do mês</h3>
                <dl className="month-summary__metrics month-summary__metrics--financial">
                  {financialMetrics.map((metric) => <MonthlyMetric
                    {...metric}
                    onValueClick={'detail' in metric ? () => setOpenDetail(metric.detail) : undefined}
                    valueActionLabel={'detail' in metric ? ACCUMULATED_INDICATOR_DEFINITIONS[metric.detail].actionLabel : undefined}
                    key={metric.indicator}
                  />)}
                  <MonthlyMetric
                    indicator="accumulationIndex"
                    label="Índice de acumulação do mês"
                    value={summary.accumulationIndex === null ? '—' : `${decimalFormatter.format(summary.accumulationIndex)} (${percentFormatter.format(summary.accumulationIndex)})`}
                    rawValue={summary.accumulationIndex}
                    className="accumulation-metric"
                    onValueClick={() => setOpenCalculation('accumulationIndex')}
                    valueActionLabel={ACCUMULATION_INDEX_ACTION_LABEL}
                  />
                </dl>
                <div className="accumulation-interpretation">
                  {summary.accumulationIndex === null
                    ? <p>Sem gastos no período, o índice não pode ser calculado.</p>
                    : <p>Você investiu R$ {decimalFormatter.format(summary.accumulationIndex)} para cada R$ 1,00 gasto.</p>}
                  <div><span><b>&gt; 1</b> investiu mais do que gastou</span><span><b>= 1</b> investiu o mesmo que gastou</span><span><b>&lt; 1</b> gastou mais do que investiu</span></div>
                </div>
              </section>
            </div>
            {operationalSummary && (
              <div className="operational-summary">
                <header>
                  <div><p className="eyebrow">Planejamento</p><h3>Planejamento operacional</h3></div>
                </header>
                <dl className="operational-summary__metrics">
                  <MonthlyMetric indicator="operationalBalance" label="Saldo operacional" value={formatMoney(operationalSummary.operationalBalance)} rawValue={operationalSummary.operationalBalance} onValueClick={() => setOpenCalculation('operationalBalance')} valueActionLabel={OPERATIONAL_CALCULATION_ACTION_LABELS.operationalBalance} />
                  <div className="month-metric metric-item investment-percentage">
                    <label><span>Percentual destinado a investimentos</span><span><input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={investmentPercentage * 100}
                        onChange={(event) => {
                          const percentage = Number(event.currentTarget.value) / 100
                          if (Number.isFinite(percentage) && percentage >= 0 && percentage <= 1) onInvestmentPercentageChange?.(percentage)
                        }}
                        aria-label="Percentual destinado a investimentos"
                      />%</span></label>
                    <IndicatorHelp help={MONTH_INDICATOR_HELP.investmentPercentage} label="Percentual destinado a investimentos" />
                  </div>
                  <MonthlyMetric indicator="operationalPercentage" label="Percentual operacional" value={percentFormatter.format(operationalSummary.operationalPercentage)} />
                  <MonthlyMetric indicator="investmentAllocation" label="Valor destinado a investimentos" value={formatMoney(operationalSummary.investmentAllocation)} rawValue={operationalSummary.investmentAllocation} onValueClick={() => setOpenCalculation('investmentAllocation')} valueActionLabel={OPERATIONAL_CALCULATION_ACTION_LABELS.investmentAllocation} />
                  <MonthlyMetric indicator="operationalBudget" label="Orçamento operacional" value={formatMoney(operationalSummary.operationalBudget)} rawValue={operationalSummary.operationalBudget} onValueClick={() => setOpenCalculation('operationalBudget')} valueActionLabel={OPERATIONAL_CALCULATION_ACTION_LABELS.operationalBudget} />
                  <MonthlyMetric indicator="realizedExpenses" label="Gastos realizados" value={formatMoney(operationalSummary.realizedExpenses)} rawValue={operationalSummary.realizedExpenses} />
                  {summary.period === 'current' && <>
                    <MonthlyMetric indicator="dailyTarget" label="Meta diária atual de gasto" value={operationalSummary.currentDailySpendingTarget === null ? '—' : formatMoney(operationalSummary.currentDailySpendingTarget)} rawValue={operationalSummary.currentDailySpendingTarget} className="daily-target" onValueClick={() => setOpenCalculation('dailyTarget')} valueActionLabel={OPERATIONAL_CALCULATION_ACTION_LABELS.dailyTarget} />
                    <MonthlyMetric indicator="remainingDays" label="Quantidade de dias restantes" value={`${operationalSummary.remainingDays} dias restantes`} className="daily-target remaining-days" />
                  </>}
                </dl>
              </div>
            )}
          </>
        )}
      </section>
      {indicatorDetail && <AccumulatedIndicatorDetailModal detail={indicatorDetail} onClose={() => setOpenDetail(null)} />}
      {calculationDetail && <CalculationDetailModal detail={calculationDetail} onClose={() => setOpenCalculation(null)} onViewExpenses={() => {
        setOpenCalculation(null)
        setOpenDetail('gastos')
      }} onViewRelatedDetail={(detail) => {
        setOpenCalculation(null)
        setOpenDetail(detail)
      }} />}
    </section>
  )
}

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const compactMoneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })
const percentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatMoney = (valueInCents: number) => moneyFormatter.format(valueInCents / 100)
const formatCompactMoney = (valueInCents: number) => compactMoneyFormatter.format(valueInCents / 100)
const classificationLabels: Record<MovimentacaoFinanceira['classificacaoFinanceira'], string> = {
  faturamento: 'Faturamento', receita: 'Receita', gasto: 'Gasto', investimento: 'Investimento',
  resgate_investimento: 'Resgate de investimento',
  transferencia: 'Transferência', estorno: 'Estorno', nao_classificado: 'Não classificado',
}

const primaryIndicators = new Set<FinancialSemanticType>(['profit', 'operationalBalance'])
const coreIndicators = new Set<FinancialSemanticType>(['faturamento', 'gastos'])
const supportingIndicators = new Set<FinancialSemanticType>(['investimentos', 'bankingResult'])

function getIndicatorHierarchyClassName(indicator: FinancialSemanticType): string {
  if (primaryIndicators.has(indicator)) return 'metric-item--primary'
  if (coreIndicators.has(indicator)) return 'metric-item--core'
  if (supportingIndicators.has(indicator)) return 'metric-item--supporting'
  return 'metric-item--secondary'
}

function DailyMetric({ indicator, label, value, rawValue }: { readonly indicator: DayIndicatorId; readonly label: string; readonly value: string; readonly rawValue: number | null }) {
  return (
    <div className={`metric-item metric-item--${indicator} ${getIndicatorHierarchyClassName(indicator)}`}>
      <dt>{label}</dt><dd className={getFinancialValueClassName(rawValue, indicator)}>{value}</dd>
      <IndicatorHelp help={DAY_INDICATOR_HELP[indicator]} label={label} />
    </div>
  )
}

function MonthlyMetric({ indicator, label, value, rawValue = null, supplementalValue, className = '', onValueClick, valueActionLabel }: { readonly indicator: MonthIndicatorId; readonly label: string; readonly value: string; readonly rawValue?: number | null; readonly supplementalValue?: string; readonly className?: string; readonly onValueClick?: () => void; readonly valueActionLabel?: string }) {
  return (
    <div className={`month-metric metric-item metric-item--${indicator} ${getIndicatorHierarchyClassName(indicator)} ${className}`.trim()}>
      <dt>{label}</dt><dd className={getFinancialValueClassName(rawValue, indicator as FinancialSemanticType)}>{onValueClick
        ? <button className="metric-value-button" type="button" onClick={onValueClick} aria-label={valueActionLabel}>{value}</button>
        : value}{supplementalValue && <span className="metric-supplemental">{supplementalValue}</span>}</dd>
      <IndicatorHelp help={MONTH_INDICATOR_HELP[indicator]} label={label} />
    </div>
  )
}

interface DayScreenProps {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly movements: readonly MovimentacaoFinanceira[]
  readonly today?: Date
  readonly onReclassify?: (movementId: string, classification: ClassificacaoFinanceira) => void
  readonly onNewMovement?: () => void
  readonly onEditMovement?: (movement: ManualMovement) => void
  readonly onDeleteMovement?: (movementId: string) => void
  readonly onImport?: () => void
}

export function DayScreen({ year, month, day, movements, today = new Date(), onReclassify, onNewMovement, onEditMovement, onDeleteMovement, onImport }: DayScreenProps) {
  const selectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const dailyMovements = movements.filter((movement) => movement.data === selectedDate)
  const fullDate = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
  const accumulationIndex = calcularIndiceAcumulacao(dailyMovements)
  const previousDay = getAdjacentDay(year, month, day, -1)
  const nextDay = getAdjacentDay(year, month, day, 1)
  const bankingMetrics = [
    { indicator: 'bankingEntries', label: 'Entradas bancárias do dia', value: formatMoney(calcularEntradasBancarias(dailyMovements)), rawValue: calcularEntradasBancarias(dailyMovements) },
    { indicator: 'bankingExits', label: 'Saídas bancárias do dia', value: formatMoney(calcularSaidasBancarias(dailyMovements)), rawValue: calcularSaidasBancarias(dailyMovements) },
    { indicator: 'bankingResult', label: 'Resultado bancário do dia', value: formatMoney(calcularResultadoBancario(dailyMovements)), rawValue: calcularResultadoBancario(dailyMovements) },
  ] as const
  const financialMetrics = [
    { indicator: 'profit', label: 'Lucro do dia', value: formatMoney(calcularLucro(dailyMovements)), rawValue: calcularLucro(dailyMovements) },
    { indicator: 'faturamento', label: 'Faturamento do dia', value: formatMoney(calcularFaturamento(dailyMovements)), rawValue: calcularFaturamento(dailyMovements) },
    { indicator: 'gastos', label: 'Gastos do dia', value: formatMoney(calcularGastos(dailyMovements)), rawValue: calcularGastos(dailyMovements) },
    { indicator: 'investimentos', label: 'Investimentos do dia', value: formatMoney(calcularInvestimentos(dailyMovements)), rawValue: calcularInvestimentos(dailyMovements) },
    { indicator: 'receita', label: 'Receita do dia', value: formatMoney(calcularReceitas(dailyMovements)), rawValue: calcularReceitas(dailyMovements) },
    { indicator: 'accumulationIndex', label: 'Índice de acumulação do dia', value: accumulationIndex === null ? '—' : percentFormatter.format(accumulationIndex), rawValue: accumulationIndex },
  ] as const

  return (
    <section className="page day-page">
      <Breadcrumbs year={year} month={month} day={day} today={today} />
      <div className="page-heading day-heading">
        <div>
          <p className="eyebrow">Detalhes do dia</p>
          <h1 className="day-title">{fullDate}</h1>
        </div>
        <nav className="period-navigation day-navigation" aria-label="Navegar entre dias">
          {previousDay && <Link href={previousDay.href} aria-label="Dia anterior">← <span>Anterior</span></Link>}
          <Link href={monthPath(year, month)} aria-label={`Voltar para ${MONTHS[month - 1]} de ${year}`}>Ver mês</Link>
          <Link href={todayDayPath(today)} aria-label={`Hoje, abrir ${today.getDate()} de ${MONTHS[today.getMonth()]} de ${today.getFullYear()}`}>Hoje</Link>
          {nextDay && <Link href={nextDay.href} aria-label="Próximo dia"><span>Próximo</span> →</Link>}
        </nav>
      </div>

      <div className="day-summary" aria-label="Indicadores do dia">
        <section className="summary-card">
          <header><span className="summary-card__mark summary-card__mark--bank" /><h2>Dados bancários do dia</h2></header>
          <dl className="metric-grid">
            {bankingMetrics.map((metric) => <DailyMetric {...metric} key={metric.indicator} />)}
          </dl>
        </section>
        <section className="summary-card">
          <header><span className="summary-card__mark summary-card__mark--finance" /><h2>Classificação financeira do dia</h2></header>
          <dl className="metric-grid metric-grid--financial">
            {financialMetrics.map((metric) => <DailyMetric {...metric} key={metric.indicator} />)}
          </dl>
        </section>
      </div>

      <section className="transactions-section">
        <header className="transactions-header">
          <div><p className="eyebrow">Atividade</p><h2>Movimentações do dia</h2></div>
          <button className="new-transaction-button" type="button" onClick={onNewMovement}>
            <span aria-hidden="true">+</span> Nova movimentação
          </button>
        </header>
        {dailyMovements.length === 0 ? (
          <div className="transactions-empty" role="status">
            <div className="empty-icon" aria-hidden="true"><span /></div>
            <h3>Nenhuma movimentação neste dia</h3>
            <p>As movimentações aparecerão aqui quando houver dados.</p>
            <button className="empty-import-button" type="button" onClick={onImport}>Importar CSV</button>
          </div>
        ) : (
          <div className="transaction-list">
            {dailyMovements.map((movement) => (
              <article className={`transaction-row transaction-row--${movement.tipoBancario}`} aria-label={`${getMovementDescription(movement)}, ${movement.tipoBancario}`} key={movement.id}>
                <div className="transaction-row__description">
                  <strong>{getMovementDescription(movement)}</strong>
                  <label className="classification-control">
                    <span>Classificação financeira</span>
                    <select
                      value={movement.classificacaoFinanceira}
                      onChange={(event) => onReclassify?.(movement.id, event.currentTarget.value as ClassificacaoFinanceira)}
                      aria-label={`Classificação financeira de ${getMovementDescription(movement)}`}
                    >
                      {!isClassificacaoPermitida(movement.tipoBancario, movement.classificacaoFinanceira) && (
                        <option value={movement.classificacaoFinanceira} disabled>{classificationLabels[movement.classificacaoFinanceira]} (histórica)</option>
                      )}
                      {getClassificacoesPermitidas(movement.tipoBancario).map((classification) => (
                        <option value={classification} key={classification}>{classificationLabels[classification]}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <span className={`transaction-type transaction-type--${movement.tipoBancario}`}>{movement.tipoBancario === 'entrada' ? 'Entrada' : 'Saída'}</span>
                <strong className={`transaction-value transaction-value--${movement.tipoBancario}`}>
                  {movement.tipoBancario === 'saida' ? '−' : '+'}{formatMoney(movement.valorEmCentavos)}
                </strong>
                {isManualMovement(movement) && <div className="transaction-actions">
                  <button type="button" onClick={() => onEditMovement?.(movement)} aria-label={`Editar ${getMovementDescription(movement)}`}>Editar</button>
                  <button className="transaction-actions__delete" type="button" onClick={() => onDeleteMovement?.(movement.id)} aria-label={`Excluir ${getMovementDescription(movement)}`}>Excluir</button>
                </div>}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function NotFoundScreen() {
  const currentYear = new Date().getFullYear()
  return (
    <section className="page not-found">
      <p className="eyebrow">Página não encontrada</p>
      <h1>Este calendário não existe.</h1>
      <Link className="primary-link" href={yearPath(currentYear)}>Abrir {currentYear}</Link>
    </section>
  )
}

export function App() {
  const pathname = usePathname()
  if (pathname === '/' || pathname === '') return <LandingPage />
  if (pathname === '/login') return <LoginScreen onPrototypeLogin={(email) => {
    window.sessionStorage.setItem('moneycalendar:prototype-session', JSON.stringify({ email }))
    const year = new Date().getFullYear()
    window.history.pushState(null, '', yearPath(year))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }} />
  return <CalendarApplication />
}

function CalendarApplication() {
  const route = useCalendarRoute()
  const [movements, setMovements] = useState<readonly MovimentacaoFinanceira[]>(loadMovements)
  const [investmentPercentage, setInvestmentPercentage] = useState(loadInvestmentPercentage)
  const [importHistory, setImportHistory] = useState(loadImportHistory)
  const [showWelcome, setShowWelcome] = useState(() => !loadOnboardingDismissed())
  const [isImportOpen, setImportOpen] = useState(false)
  const [isHistoryOpen, setHistoryOpen] = useState(false)
  const [manualMovementDate, setManualMovementDate] = useState<string | null>(null)
  const [editingMovement, setEditingMovement] = useState<ManualMovement | null>(null)
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const openNewMovement = (date: string) => {
    setEditingMovement(null)
    setManualMovementDate(date)
  }
  const saveManualMovement = (movement: ManualMovement) => {
    setMovements((current) => {
      const updated = editingMovement
        ? updateManualMovementInMemory(current, movement)
        : [...current, movement]
      saveMovements(updated)
      return updated
    })
    setManualMovementDate(null)
    setEditingMovement(null)
  }
  return (
    <Shell onImport={() => setImportOpen(true)} onHistory={() => setHistoryOpen(true)}>
      {showWelcome && movements.length === 0 && <WelcomeGuide
        onClose={() => {
          saveOnboardingDismissed()
          setShowWelcome(false)
        }}
        onImport={() => setImportOpen(true)}
        onAdd={() => openNewMovement(todayIso)}
      />}
      {route.page === 'year' && <YearScreen year={route.year} movements={movements} />}
      {route.page === 'month' && <MonthScreen
        year={route.year}
        month={route.month}
        movements={movements}
        investmentPercentage={investmentPercentage}
        onImport={() => setImportOpen(true)}
        onAddMovement={() => {
          const isCurrentMonth = route.year === today.getFullYear() && route.month === today.getMonth() + 1
          openNewMovement(`${route.year}-${String(route.month).padStart(2, '0')}-${String(isCurrentMonth ? today.getDate() : 1).padStart(2, '0')}`)
        }}
        onInvestmentPercentageChange={(percentage) => {
          saveInvestmentPercentage(percentage)
          setInvestmentPercentage(percentage)
        }}
      />}
      {route.page === 'day' && <DayScreen
        year={route.year}
        month={route.month}
        day={route.day}
        movements={movements}
        onImport={() => setImportOpen(true)}
        onReclassify={(movementId, classification) =>
          setMovements((current) => {
            const reclassified = reclassifyMovementInMemory(current, movementId, classification)
            saveMovements(reclassified)
            return reclassified
          })
        }
        onNewMovement={() => openNewMovement(`${route.year}-${String(route.month).padStart(2, '0')}-${String(route.day).padStart(2, '0')}`)}
        onEditMovement={(movement) => {
          setEditingMovement(movement)
          setManualMovementDate(movement.data)
        }}
        onDeleteMovement={(movementId) => {
          if (!window.confirm('Excluir esta movimentação manual?')) return
          setMovements((current) => {
            const updated = deleteManualMovementInMemory(current, movementId)
            saveMovements(updated)
            return updated
          })
        }}
      />}
      {route.page === 'not-found' && <NotFoundScreen />}
      {isImportOpen && <ImportCsvModal
        existingMovements={movements}
        onClose={() => setImportOpen(false)}
        onConfirm={(importedMovements, fileName, recognizedMovements) => {
          const reconciled = reconcileImportedMovements(movements, importedMovements)
          const batch = createImportBatch(fileName, recognizedMovements, reconciled)
          saveMovements(reconciled.movements)
          setMovements(reconciled.movements)
          setImportHistory((currentHistory) => {
            const updatedHistory = [...currentHistory, batch]
            saveImportHistory(updatedHistory)
            return updatedHistory
          })
          return reconciled
        }}
      />}
      {isHistoryOpen && <ImportHistoryModal
        history={importHistory}
        movements={movements}
        onClose={() => setHistoryOpen(false)}
        onReverse={(importBatchId) => {
          const reversed = reverseImportBatch(movements, importHistory, importBatchId, { confirmed: true })
          saveMovements(reversed.movements)
          saveImportHistory(reversed.history)
          setMovements(reversed.movements)
          setImportHistory(reversed.history)
          return reversed
        }}
      />}
      {manualMovementDate && <NewMovementModal
        date={manualMovementDate}
        movement={editingMovement ?? undefined}
        onClose={() => {
          setManualMovementDate(null)
          setEditingMovement(null)
        }}
        onSave={saveManualMovement}
      />}
    </Shell>
  )
}
