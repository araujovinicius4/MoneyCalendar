import type { ImportBatch, ImportReversalResult } from './import-history'
import { inspectImportReversal } from './import-history'
import type { MovimentacaoFinanceira } from '../domain/transactions'

interface ImportHistoryModalProps {
  readonly history: readonly ImportBatch[]
  readonly movements: readonly MovimentacaoFinanceira[]
  readonly onClose: () => void
  readonly onReverse: (importBatchId: string) => ImportReversalResult
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function ImportHistoryModal({ history, movements, onClose, onReverse }: ImportHistoryModalProps) {
  const reverse = (batch: ImportBatch) => {
    const preview = inspectImportReversal(movements, batch)
    const reclassifiedWarning = preview.reclassifiedMovementIds.length > 0
      ? `\n\nAtenção: ${preview.reclassifiedMovementIds.length} movimentações foram reclassificadas depois da importação e também serão removidas.`
      : ''
    const confirmed = window.confirm(
      `Reverter a importação "${batch.fileName}"?\n\n`
      + `${preview.removableMovementIds.length} movimentações serão removidas.`
      + '\nMovimentações manuais não serão afetadas.'
      + '\nRegistros que já existiam antes desta importação não serão removidos.'
      + reclassifiedWarning,
    )
    if (confirmed) onReverse(batch.importBatchId)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="import-modal history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title">
        <header className="import-modal__header">
          <div><p className="eyebrow">Auditoria</p><h2 id="history-title">Histórico de importações</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar histórico de importações">×</button>
        </header>
        {history.length === 0 ? <p className="history-empty">Nenhuma importação confirmada até agora.</p> : (
          <div className="history-list">
            {[...history].reverse().map((batch) => (
              <article className="history-item" key={batch.importBatchId}>
                <div className="history-item__main">
                  <strong>{batch.fileName}</strong>
                  <span>{dateFormatter.format(new Date(batch.importedAt))}</span>
                </div>
                <div className="history-item__counts">
                  <span><b>{batch.addedCount}</b> adicionadas</span>
                  <span><b>{batch.ignoredExistingCount}</b> ignoradas</span>
                </div>
                <span className={`history-status history-status--${batch.status}`}>{batch.status === 'ativo' ? 'Ativa' : 'Revertida'}</span>
                {batch.status === 'ativo' && <button className="history-reverse" type="button" onClick={() => reverse(batch)}>Reverter importação</button>}
              </article>
            ))}
          </div>
        )}
        <footer className="import-modal__footer"><button className="primary-button" type="button" onClick={onClose}>Fechar</button></footer>
      </section>
    </div>
  )
}
