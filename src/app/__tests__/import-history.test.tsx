import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { calcularEntradasBancarias, calcularGastos } from '../../domain/finance'
import { classificarMovimentacao, importarCsvNubank } from '../../domain/transactions'
import { DayScreen, MonthScreen, YearScreen } from '../App'
import { createImportBatch, inspectImportReversal, reverseImportBatch } from '../import-history'
import { createManualMovement } from '../manual-movement'
import { reconcileImportedMovements } from '../reconcile-import'

const csv = (rows: readonly string[]) => ['Data,Valor,Identificador,Descrição', ...rows].join('\n')
const rowsA = [
  '10/08/2026,-100.00,A-1,Compra no débito',
  '11/08/2026,200.00,A-2,Transferência recebida pelo Pix',
  '12/08/2026,-300.00,A-3,Aplicação RDB',
]
const rowsB = [...rowsA, '13/08/2026,-40.00,B-4,Compra no débito', '14/08/2026,50.00,B-5,Transferência recebida pelo Pix']
const optionsA = { now: new Date('2026-08-15T10:00:00.000Z'), generateId: () => 'batch:A' }
const optionsB = { now: new Date('2026-08-16T10:00:00.000Z'), generateId: () => 'batch:B' }

describe('lotes e reversão segura de importações', () => {
  it('cria lote com metadados e somente IDs efetivamente adicionados', () => {
    const imported = importarCsvNubank(csv(rowsA))
    const reconciliation = reconcileImportedMovements([], imported)
    const batch = createImportBatch('a.csv', imported.length, reconciliation, optionsA)
    expect(batch).toMatchObject({
      importBatchId: 'batch:A', importedAt: '2026-08-15T10:00:00.000Z', fileName: 'a.csv',
      recognizedMovements: 3, addedCount: 3, ignoredExistingCount: 0,
      preservedManualCount: 0, preservedReclassificationCount: 0, status: 'ativo',
    })
    expect(batch.addedMovementIds).toEqual(reconciliation.addedMovements.map(({ id }) => id))
    expect(Object.keys(batch.initialClassifications)).toEqual(batch.addedMovementIds)
  })

  it('não vincula ao lote movimentos ignorados ou manuais preservados', () => {
    const imported = importarCsvNubank(csv(rowsA))
    const manual = createManualMovement({ date: '2026-08-10', description: 'Manual', value: '10.00', bankingType: 'saida', financialClassification: 'gasto' }, () => 'manual:1')
    const reconciliation = reconcileImportedMovements([imported[0], manual], imported)
    const batch = createImportBatch('parcial.csv', 3, reconciliation, optionsA)
    expect(batch.addedMovementIds).toHaveLength(2)
    expect(batch.addedMovementIds).not.toContain(imported[0].id)
    expect(batch.addedMovementIds).not.toContain(manual.id)
    expect(batch.preservedManualCount).toBe(1)
    expect(batch.ignoredExistingCount).toBe(1)
  })

  it('trata importações sobrepostas e reverte cada lote isoladamente', () => {
    const firstReconciliation = reconcileImportedMovements([], importarCsvNubank(csv(rowsA)))
    const batchA = createImportBatch('a.csv', 3, firstReconciliation, optionsA)
    const secondReconciliation = reconcileImportedMovements(firstReconciliation.movements, importarCsvNubank(csv(rowsB)))
    const batchB = createImportBatch('b.csv', 5, secondReconciliation, optionsB)
    expect(batchA.addedMovementIds).toHaveLength(3)
    expect(batchB.addedMovementIds).toHaveLength(2)
    expect(batchB.ignoredExistingCount).toBe(3)

    const reversedB = reverseImportBatch(secondReconciliation.movements, [batchA, batchB], batchB.importBatchId, { confirmed: true })
    expect(reversedB.movements.map(({ id }) => id)).toEqual(firstReconciliation.movements.map(({ id }) => id))
    expect(reversedB.history.find(({ importBatchId }) => importBatchId === 'batch:A')?.status).toBe('ativo')
    expect(reversedB.history.find(({ importBatchId }) => importBatchId === 'batch:B')?.status).toBe('revertido')

    const reversedA = reverseImportBatch(reversedB.movements, reversedB.history, batchA.importBatchId, { confirmed: true })
    expect(reversedA.movements).toEqual([])
    expect(reversedA.history.every(({ status }) => status === 'revertido')).toBe(true)
  })

  it('preserva manuais, registros anteriores e movimentos de outros lotes', () => {
    const prior = importarCsvNubank(csv(['09/08/2026,99.00,PRIOR,Transferência recebida pelo Pix']))[0]
    const manual = createManualMovement({ date: '2026-08-09', description: 'Manual', value: '5.00', bankingType: 'entrada', financialClassification: 'receita' }, () => 'manual:prior')
    const reconciliation = reconcileImportedMovements([prior, manual], importarCsvNubank(csv(rowsA)))
    const batch = createImportBatch('a.csv', 3, reconciliation, optionsA)
    const reversed = reverseImportBatch(reconciliation.movements, [batch], batch.importBatchId, { confirmed: true })
    expect(reversed.movements).toEqual([prior, manual])
  })

  it('detecta reclassificação posterior e a remove somente após confirmação explícita', () => {
    const reconciliation = reconcileImportedMovements([], importarCsvNubank(csv(rowsA)))
    const batch = createImportBatch('a.csv', 3, reconciliation, optionsA)
    const target = reconciliation.movements[0]
    const reclassified = reconciliation.movements.map((movement) => movement.id === target.id
      ? classificarMovimentacao(movement, 'investimento') : movement)
    expect(inspectImportReversal(reclassified, batch).reclassifiedMovementIds).toEqual([target.id])
    expect(() => reverseImportBatch(reclassified, [batch], batch.importBatchId, { confirmed: false } as never)).toThrow('confirmação explícita')
    const reversed = reverseImportBatch(reclassified, [batch], batch.importBatchId, { confirmed: true })
    expect(reversed.removedReclassifiedCount).toBe(1)
    expect(reversed.movements).toEqual([])
  })

  it('mantém lote revertido para auditoria e impede segunda reversão', () => {
    const reconciliation = reconcileImportedMovements([], importarCsvNubank(csv(rowsA)))
    const batch = createImportBatch('a.csv', 3, reconciliation, optionsA)
    const reversed = reverseImportBatch(reconciliation.movements, [batch], batch.importBatchId, { confirmed: true })
    expect(reversed.history).toHaveLength(1)
    expect(reversed.history[0]).toMatchObject({ status: 'revertido' })
    expect(() => reverseImportBatch(reversed.movements, reversed.history, batch.importBatchId, { confirmed: true })).toThrow('já foi revertida')
  })

  it('permite reimportar depois da reversão em um novo lote sem reativar o antigo', () => {
    const imported = importarCsvNubank(csv(rowsA))
    const first = reconcileImportedMovements([], imported)
    const batchA = createImportBatch('a.csv', 3, first, optionsA)
    const reversed = reverseImportBatch(first.movements, [batchA], batchA.importBatchId, { confirmed: true })
    const reimported = reconcileImportedMovements(reversed.movements, importarCsvNubank(csv(rowsA)))
    const batchB = createImportBatch('a-novamente.csv', 3, reimported, optionsB)
    expect(batchB.addedMovementIds).toHaveLength(3)
    expect(batchB.importBatchId).not.toBe(batchA.importBatchId)
    expect(reversed.history[0].status).toBe('revertido')
    expect(batchB.status).toBe('ativo')
  })

  it('atualiza indicadores e telas usando a coleção após reversão', () => {
    const reconciliation = reconcileImportedMovements([], importarCsvNubank(csv(rowsA)))
    const batch = createImportBatch('a.csv', 3, reconciliation, optionsA)
    expect(calcularGastos(reconciliation.movements)).toBe(10_000)
    expect(calcularEntradasBancarias(reconciliation.movements)).toBe(20_000)
    const reversed = reverseImportBatch(reconciliation.movements, [batch], batch.importBatchId, { confirmed: true })
    expect(calcularGastos(reversed.movements)).toBe(0)
    expect(calcularEntradasBancarias(reversed.movements)).toBe(0)
    const today = new Date(2026, 7, 15, 12)
    expect(renderToStaticMarkup(<DayScreen year={2026} month={8} day={10} movements={reversed.movements} today={today} />)).toContain('Nenhuma movimentação neste dia')
    expect(renderToStaticMarkup(<MonthScreen year={2026} month={8} movements={reversed.movements} today={today} investmentPercentage={0.8} />)).toContain('Nenhuma movimentação neste mês')
    expect(renderToStaticMarkup(<YearScreen year={2026} movements={reversed.movements} today={today} />)).not.toContain('mini-calendar__finance')
  })

  it('mantém reversão e cálculos fora dos componentes React', () => {
    const sources = import.meta.glob('../ImportHistoryModal.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const source = Object.values(sources)[0]
    expect(source).toContain('inspectImportReversal(movements, batch)')
    expect(source).not.toContain('calcularFaturamento')
    expect(source).not.toContain('calcularGastos')
    expect(source).not.toContain('.filter(')
  })
})
