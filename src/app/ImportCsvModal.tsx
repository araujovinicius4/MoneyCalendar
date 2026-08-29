import { useState, type ChangeEvent } from 'react'
import type { ClassificacaoFinanceira, MovimentacaoFinanceira } from '../domain/transactions'
import { confirmCsvImport, prepareCsvImport, type CsvImportPreview } from './csv-import'
import { reconcileImportedMovements, type ImportReconciliationResult, type ImportReconciliationSummary } from './reconcile-import'

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const PREVIEW_LIMIT = 6
const labels: Record<ClassificacaoFinanceira, string> = {
  faturamento: 'Faturamento', receita: 'Receitas', gasto: 'Gastos', investimento: 'Investimentos',
  resgate_investimento: 'Resgates de investimento',
  transferencia: 'Transferências', estorno: 'Estornos', nao_classificado: 'Não classificados',
}

export function friendlyCsvError(content: string, cause: unknown): string {
  if (!content.trim()) return 'O arquivo está vazio. Selecione um CSV Nubank com movimentações.'
  const message = cause instanceof Error ? cause.message : ''
  if (message.startsWith('Cabeçalho Nubank inválido')) return 'Cabeçalhos ausentes ou incompatíveis. Use um arquivo CSV exportado pelo Nubank.'
  if (message.startsWith('Data inválida')) return 'Há uma data inválida no CSV. Revise as datas e tente novamente.'
  if (message.startsWith('Valor inválido')) return 'Há um valor inválido no CSV. Revise os valores e tente novamente.'
  if (message.startsWith('CSV inválido')) return 'O CSV está inválido ou incompleto. Verifique o arquivo e tente novamente.'
  if (message.startsWith('Quantidade de colunas inválida')) return 'O arquivo é incompatível com o formato CSV esperado do Nubank.'
  return 'Não foi possível processar o arquivo. Verifique se ele é um CSV Nubank válido e tente novamente.'
}

interface ImportCsvModalProps {
  readonly existingMovements: readonly MovimentacaoFinanceira[]
  readonly onClose: () => void
  readonly onConfirm: (movements: readonly MovimentacaoFinanceira[], fileName: string, recognizedMovements: number) => ImportReconciliationResult
}

function ReconciliationCards({ summary, title }: { readonly summary: ImportReconciliationSummary; readonly title: string }) {
  return (
    <section className="reconciliation-summary" aria-labelledby="reconciliation-title">
      <h3 id="reconciliation-title">{title}</h3>
      <div>
        <span><strong>{summary.addedMovements}</strong> novas movimentações</span>
        <span><strong>{summary.ignoredExistingMovements}</strong> já existentes ignoradas</span>
        <span><strong>{summary.preservedManualMovements}</strong> manuais preservadas</span>
        <span><strong>{summary.preservedReclassifications}</strong> reclassificações preservadas</span>
      </div>
    </section>
  )
}

export function ImportCsvModal({ existingMovements, onClose, onConfirm }: ImportCsvModalProps) {
  const [preview, setPreview] = useState<CsvImportPreview | null>(null)
  const [simulation, setSimulation] = useState<ImportReconciliationResult | null>(null)
  const [result, setResult] = useState<ImportReconciliationResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setLoading] = useState(false)

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setPreview(null)
    setSimulation(null)
    setResult(null)
    setError('')
    setFileName(file?.name ?? '')
    if (!file) return
    setLoading(true)
    let content = ''
    try {
      content = await file.text()
      const nextPreview = prepareCsvImport(content)
      setPreview(nextPreview)
      setSimulation(reconcileImportedMovements(existingMovements, confirmCsvImport(nextPreview)))
    } catch (cause) {
      setError(friendlyCsvError(content, cause))
    } finally {
      setLoading(false)
    }
  }

  const confirm = () => {
    if (preview) setResult(onConfirm(confirmCsvImport(preview), fileName, preview.movementCount))
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" aria-describedby={error ? 'import-error' : undefined}>
        <header className="import-modal__header">
          <div><p className="eyebrow">Conciliação segura</p><h2 id="import-title">Importar CSV</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar importação CSV">×</button>
        </header>

        {result ? (
          <div className="import-result" role="status">
            <span className="import-result__icon" aria-hidden="true">✓</span>
            <h3>Importação concluída</h3>
            <p>{result.summary.addedMovements} novas movimentações foram adicionadas. Você pode fechar e continuar no período atual.</p>
            <ReconciliationCards summary={result.summary} title="Resultado da importação" />
          </div>
        ) : (
          <>
            <label className="file-picker">
              <span>Selecionar arquivo CSV Nubank</span>
              <input type="file" accept=".csv,text/csv" onChange={selectFile} autoFocus />
              <strong>{fileName || 'Nenhum arquivo selecionado'}</strong>
            </label>
            <p className="import-deduplication-note">Movimentações já conhecidas são conciliadas e não serão duplicadas.</p>
            {isLoading && <p className="import-loading" role="status">Processando arquivo…</p>}
            {error && <p className="import-error" id="import-error" role="alert">{error}</p>}

            {preview && simulation && (
              <div className="import-preview">
                <div className="import-totals">
                  <div><span>Arquivo</span><strong title={fileName}>{fileName}</strong></div>
                  <div><span>Movimentações reconhecidas</span><strong>{preview.movementCount}</strong></div>
                  <div><span>Entradas bancárias</span><strong>{moneyFormatter.format(preview.bankingEntries / 100)}</strong></div>
                  <div><span>Saídas bancárias</span><strong>{moneyFormatter.format(preview.bankingExits / 100)}</strong></div>
                </div>
                <div className="classification-summary" aria-label="Quantidade por classificação financeira">
                  {Object.entries(preview.classificationSummary).map(([classification, count]) => (
                    <span key={classification}>{labels[classification as ClassificacaoFinanceira]} <strong>{count}</strong></span>
                  ))}
                </div>
                <ReconciliationCards summary={simulation.summary} title="Resumo da conciliação" />
                {simulation.summary.addedMovements === 0 && <p className="import-no-new" role="status">Nenhuma movimentação nova será adicionada.</p>}
                <div className="preview-list" aria-label="Amostra das movimentações normalizadas">
                  {preview.movements.slice(0, PREVIEW_LIMIT).map((movement) => (
                    <div key={movement.id}>
                      <span>{movement.data}</span><strong>{movement.dadosOriginais.Descrição}</strong>
                      <span>{movement.tipoBancario}</span><span>{movement.classificacaoFinanceira}</span>
                      <span>{moneyFormatter.format(movement.valorEmCentavos / 100)}</span>
                    </div>
                  ))}
                </div>
                {preview.movementCount > PREVIEW_LIMIT && <p className="preview-limit">Exibindo as primeiras {PREVIEW_LIMIT} de {preview.movementCount} movimentações.</p>}
              </div>
            )}
          </>
        )}

        <footer className="import-modal__footer">
          {result ? <button className="primary-button" type="button" onClick={onClose} autoFocus>Fechar e continuar</button> : <>
            <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-button" type="button" disabled={!preview || isLoading} onClick={confirm}>Confirmar importação</button>
          </>}
        </footer>
      </section>
    </div>
  )
}
