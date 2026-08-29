import { useState, type FormEvent } from 'react'
import type { ClassificacaoFinanceira, TipoBancario } from '../domain/transactions'
import { createManualMovement, type ManualMovement } from './manual-movement'
import { getClassificacoesPermitidas, isClassificacaoPermitida } from './classification-options'

interface NewMovementModalProps {
  readonly date: string
  readonly movement?: ManualMovement
  readonly onClose: () => void
  readonly onSave: (movement: ManualMovement) => void
}

export function NewMovementModal({ date, movement, onClose, onSave }: NewMovementModalProps) {
  const [movementDate, setMovementDate] = useState(movement?.data ?? date)
  const [description, setDescription] = useState(movement?.dadosOriginais.descricaoOriginal ?? '')
  const [value, setValue] = useState(movement ? `${Math.floor(movement.valorEmCentavos / 100)}.${String(movement.valorEmCentavos % 100).padStart(2, '0')}` : '')
  const [bankingType, setBankingType] = useState<TipoBancario>(movement?.tipoBancario ?? 'saida')
  const [classification, setClassification] = useState<ClassificacaoFinanceira>(movement?.classificacaoFinanceira ?? 'nao_classificado')
  const [time, setTime] = useState(movement?.dadosOriginais.horario ?? '')
  const [note, setNote] = useState(movement?.dadosOriginais.observacao ?? '')
  const [error, setError] = useState('')
  const allowedClassifications = getClassificacoesPermitidas(bankingType)
  const hasHistoricalClassification = !isClassificacaoPermitida(bankingType, classification)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      onSave(createManualMovement({
        date: movementDate, description, value, bankingType,
        financialClassification: classification, time, note,
      }, movement ? () => movement.id : undefined))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a movimentação.')
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="import-modal movement-modal" role="dialog" aria-modal="true" aria-labelledby="movement-title">
        <header className="import-modal__header">
          <div><p className="eyebrow">Lançamento manual</p><h2 id="movement-title">{movement ? 'Editar movimentação' : 'Nova movimentação'}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <form className="movement-form" onSubmit={submit}>
          <label><span>Data</span><input type="date" value={movementDate} onChange={(event) => setMovementDate(event.currentTarget.value)} /></label>
          <label className="movement-form__wide"><span>Descrição</span><input value={description} onChange={(event) => setDescription(event.currentTarget.value)} required /></label>
          <label><span>Valor</span><input inputMode="decimal" placeholder="0,00" value={value} onChange={(event) => setValue(event.currentTarget.value)} required /></label>
          <label><span>Tipo bancário</span><select value={bankingType} onChange={(event) => {
            const nextType = event.currentTarget.value as TipoBancario
            setBankingType(nextType)
            if (!isClassificacaoPermitida(nextType, classification)) setClassification('nao_classificado')
          }}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
          <label><span>Classificação financeira</span><select value={classification} onChange={(event) => setClassification(event.currentTarget.value as ClassificacaoFinanceira)}>
            {hasHistoricalClassification && <option value={classification} disabled>{classification} (classificação histórica)</option>}
            {allowedClassifications.map((item) => <option value={item} key={item}>{item}</option>)}
          </select></label>
          <label><span>Horário (opcional)</span><input type="time" value={time} onChange={(event) => setTime(event.currentTarget.value)} /></label>
          <label className="movement-form__wide"><span>Observação (opcional)</span><textarea value={note} onChange={(event) => setNote(event.currentTarget.value)} rows={3} /></label>
          {error && <p className="import-error movement-form__wide" role="alert">{error}</p>}
          <footer className="import-modal__footer movement-form__wide"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">{movement ? 'Salvar alterações' : 'Salvar movimentação'}</button></footer>
        </form>
      </section>
    </div>
  )
}
