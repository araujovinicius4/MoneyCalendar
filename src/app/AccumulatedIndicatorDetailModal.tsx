import { useEffect, useRef } from 'react'
import type { AccumulatedIndicatorDetail } from './accumulated-indicator-detail'
import { isManualMovement } from './manual-movement'
import { getMovementDescription } from './movement-presentation'

interface AccumulatedIndicatorDetailModalProps {
  readonly detail: AccumulatedIndicatorDetail
  readonly onClose: () => void
}

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percentFormatter = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateFormatter = new Intl.DateTimeFormat('pt-BR')
const classificationLabels = {
  faturamento: 'Faturamento', receita: 'Receita', gasto: 'Gasto', investimento: 'Investimento',
  resgate_investimento: 'Resgate de investimento',
  transferencia: 'Transferência', estorno: 'Estorno', nao_classificado: 'Não classificado',
} as const

export function AccumulatedIndicatorDetailModal({ detail, onClose }: AccumulatedIndicatorDetailModalProps) {
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButton.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      previousFocus?.focus()
    }
  }, [onClose])

  const title = detail.criterion.kind === 'resultadoBancario'
    ? `Composição do ${detail.label}`
    : `Movimentações que compõem ${detail.label}`
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="import-modal indicator-detail-modal" role="dialog" aria-modal="true" aria-labelledby="indicator-detail-title">
        <header className="import-modal__header">
          <div><p className="eyebrow">Composição do total</p><h2 id="indicator-detail-title">{title}</h2></div>
          <button ref={closeButton} className="icon-button" type="button" onClick={onClose} aria-label={`Fechar detalhamento de ${detail.label.toLowerCase()}`}>×</button>
        </header>
        <div className="indicator-detail-summary" role="status">
          <span>{detail.movements.length} {detail.movements.length === 1 ? 'movimentação' : 'movimentações'}</span>
          <strong>{moneyFormatter.format(detail.total / 100)}</strong>
        </div>
        {detail.bankingComposition && <section className="indicator-detail-composition" aria-label="Cálculo do resultado bancário acumulado">
          <div><span>Entradas bancárias acumuladas</span><strong>{moneyFormatter.format(detail.bankingComposition.entries / 100)}</strong></div>
          <div><span>Saídas bancárias acumuladas</span><strong>{moneyFormatter.format(detail.bankingComposition.exits / 100)}</strong></div>
          <div className="indicator-detail-composition__result"><span>Resultado bancário acumulado</span><strong>{moneyFormatter.format(detail.bankingComposition.result / 100)}</strong></div>
          <p>Resultado bancário = Entradas bancárias − Saídas bancárias</p>
        </section>}
        {detail.investmentComposition && <section className="indicator-detail-composition" aria-label="Composição dos investimentos líquidos acumulados">
          <div><span>Aplicações</span><strong>{moneyFormatter.format(detail.investmentComposition.applications / 100)}</strong></div>
          <div><span>Resgates</span><strong>{moneyFormatter.format(detail.investmentComposition.redemptions / 100)}</strong></div>
          <div className="indicator-detail-composition__result"><span>Investimentos líquidos</span><strong>{moneyFormatter.format(detail.investmentComposition.netInvestments / 100)}</strong></div>
          <p>Investimentos líquidos = {moneyFormatter.format(detail.investmentComposition.applications / 100)} − {moneyFormatter.format(detail.investmentComposition.redemptions / 100)} = {moneyFormatter.format(detail.investmentComposition.netInvestments / 100)}</p>
        </section>}
        {detail.realizedPercentageComposition && <section className="indicator-detail-composition" aria-label={`Cálculo de ${detail.realizedPercentageComposition.percentageLabel.toLowerCase()}`}>
          <div><span>{detail.realizedPercentageComposition.realizedLabel}</span><strong>{moneyFormatter.format(detail.realizedPercentageComposition.realizedValue / 100)}</strong></div>
          <div><span>Faturamento acumulado</span><strong>{moneyFormatter.format(detail.realizedPercentageComposition.faturamento / 100)}</strong></div>
          <div className="indicator-detail-composition__result"><span>{detail.realizedPercentageComposition.percentageLabel}</span><strong>{detail.realizedPercentageComposition.percentage === null ? '—' : percentFormatter.format(detail.realizedPercentageComposition.percentage)}</strong></div>
          <p>{detail.realizedPercentageComposition.formula}</p>
        </section>}
        <div className="indicator-detail-list" aria-label={title}>
          {detail.movements.length === 0 ? <p>Nenhuma movimentação compõe este total.</p> : detail.movements.map((movement) => (
            <article className="indicator-detail-item" key={movement.id}>
              <time dateTime={movement.data}>{dateFormatter.format(new Date(`${movement.data}T12:00:00`))}</time>
              <div><strong>{getMovementDescription(movement)}</strong><span>{movement.tipoBancario === 'entrada' ? 'Entrada' : 'Saída'} · {classificationLabels[movement.classificacaoFinanceira]} · {isManualMovement(movement) ? 'Manual' : 'Importada'}</span></div>
              <b>{moneyFormatter.format(movement.valorEmCentavos / 100)}</b>
            </article>
          ))}
        </div>
        <footer className="import-modal__footer"><button className="primary-button" type="button" onClick={onClose}>Fechar</button></footer>
      </section>
    </div>
  )
}
