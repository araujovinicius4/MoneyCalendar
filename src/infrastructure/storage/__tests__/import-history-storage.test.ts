import { describe, expect, it } from 'vitest'
import { importarCsvNubank } from '../../../domain/transactions'
import { createImportBatch, reverseImportBatch, type ImportBatch } from '../../../app/import-history'
import { reconcileImportedMovements } from '../../../app/reconcile-import'
import { loadImportHistory, saveImportHistory, STORAGE_KEYS } from '../moneycalendar-storage'

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const csv = [
  'Data,Valor,Identificador,Descrição',
  '10/08/2026,-10.00,A,Compra no débito',
  '11/08/2026,20.00,B,Transferência recebida pelo Pix',
].join('\n')
const reconciliation = reconcileImportedMovements([], importarCsvNubank(csv))
const active = createImportBatch('agosto.csv', 2, reconciliation, {
  now: new Date('2026-08-15T10:00:00.000Z'), generateId: () => 'batch:valid',
})

const storeRaw = (storage: Storage, batches: readonly unknown[], schemaVersion = 1) =>
  storage.setItem(STORAGE_KEYS.importHistory, JSON.stringify({ schemaVersion, batches }))

describe('persistência versionada do histórico de importações', () => {
  it('restaura lotes ativos e revertidos sem alterações', () => {
    const storage = new MemoryStorage()
    const reverted = reverseImportBatch(reconciliation.movements, [active], active.importBatchId, { confirmed: true }, new Date('2026-08-16T10:00:00.000Z')).history[0]
    saveImportHistory([active, { ...reverted, importBatchId: 'batch:reverted' }], storage)
    expect(loadImportHistory(storage)).toEqual([active, { ...reverted, importBatchId: 'batch:reverted' }])
  })

  it('mantém compatibilidade quando a instalação ainda não possui histórico', () => {
    expect(loadImportHistory(new MemoryStorage())).toEqual([])
  })

  it.each([
    ['ID do lote vazio', { ...active, importBatchId: '' }],
    ['ID de movimento vazio', { ...active, addedMovementIds: ['', active.addedMovementIds[1]], initialClassifications: { '': 'gasto', [active.addedMovementIds[1]]: 'transferencia' } }],
    ['IDs internos repetidos', { ...active, addedMovementIds: [active.addedMovementIds[0], active.addedMovementIds[0]], initialClassifications: { [active.addedMovementIds[0]]: 'gasto' } }],
    ['status inválido', { ...active, status: 'apagado' }],
    ['timestamp inválido', { ...active, importedAt: 'ontem' }],
    ['contagem negativa', { ...active, ignoredExistingCount: -1 }],
  ])('rejeita histórico com %s', (_case, invalid) => {
    const storage = new MemoryStorage()
    storeRaw(storage, [invalid])
    expect(loadImportHistory(storage)).toEqual([])
  })

  it('rejeita IDs de lotes duplicados e schema incompatível', () => {
    const storage = new MemoryStorage()
    storeRaw(storage, [active, active])
    expect(loadImportHistory(storage)).toEqual([])
    storeRaw(storage, [active], 2)
    expect(loadImportHistory(storage)).toEqual([])
  })

  it('ignora JSON corrompido sem quebrar a aplicação', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEYS.importHistory, '{inválido')
    expect(loadImportHistory(storage)).toEqual([])
  })

  it('não aceita classificações iniciais incompatíveis com o catálogo', () => {
    const storage = new MemoryStorage()
    const invalid = {
      ...active,
      initialClassifications: { ...active.initialClassifications, [active.addedMovementIds[0]]: 'salario' },
    } as unknown as ImportBatch
    storeRaw(storage, [invalid])
    expect(loadImportHistory(storage)).toEqual([])
  })
})
