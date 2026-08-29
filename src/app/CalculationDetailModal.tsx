import { useEffect, useRef } from 'react'
import type { OperationalCalculationDetail } from './operational-calculation-detail'

interface Props {
  readonly detail: OperationalCalculationDetail
  readonly onClose: () => void
  readonly onViewExpenses?: () => void
  readonly onViewRelatedDetail?: (id: 'gastos' | 'investimentos') => void
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const formatValue = (value: number | null, format: 'money' | 'percent' | 'days' | 'decimal') => {
  if (value === null) return '—'
  if (format === 'money') return money.format(value / 100)
  if (format === 'percent') return percent.format(value)
  if (format === 'decimal') return decimal.format(value)
  return `${value} ${value === 1 ? 'dia' : 'dias'}`
}

export function CalculationDetailModal({ detail, onClose, onViewExpenses, onViewRelatedDetail }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus() }
  }, [onClose])

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <section className="import-modal calculation-detail-modal" role="dialog" aria-modal="true" aria-labelledby="calculation-detail-title">
      <header className="import-modal__header">
        <div><p className="eyebrow">Memória de cálculo</p><h2 id="calculation-detail-title">{detail.title}</h2></div>
        <button ref={closeButton} className="icon-button" type="button" onClick={onClose} aria-label={`Fechar memória de cálculo de ${detail.title.toLowerCase()}`}>×</button>
      </header>
      <p className="calculation-detail-period"><strong>Período considerado:</strong> {detail.period}</p>
      <section className="calculation-detail-formula" aria-label="Fórmula"><strong>Fórmula</strong>{detail.formula.split('\n').map((line) => <p key={line}>{line}</p>)}</section>
      <dl className="calculation-detail-values">
        {detail.values.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{formatValue(item.value, item.format)}</dd></div>)}
        <div className="calculation-detail-result"><dt>{detail.resultLabel}</dt><dd>{formatValue(detail.result, detail.resultFormat ?? 'money')}</dd></div>
      </dl>
      {detail.explanation && <p className="calculation-detail-explanation">{detail.explanation}</p>}
      {detail.interpretation && <div className="calculation-detail-interpretation" aria-label="Interpretação do índice">{detail.interpretation.map((line) => <span key={line}>{line}</span>)}</div>}
      {detail.relatedDetails && onViewRelatedDetail && <div className="calculation-detail-related">{detail.relatedDetails.map((action) => <button className="secondary-button" type="button" key={action.id} onClick={() => onViewRelatedDetail(action.id)}>{action.label}</button>)}</div>}
      {detail.canViewExpenses && onViewExpenses && <button className="secondary-button calculation-detail-expenses" type="button" onClick={onViewExpenses}>Ver movimentações dos gastos realizados</button>}
      <footer className="import-modal__footer"><button className="primary-button" type="button" onClick={onClose}>Fechar</button></footer>
    </section>
  </div>
}
