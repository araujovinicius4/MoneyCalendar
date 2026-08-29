import { describe, expect, it } from 'vitest'
import csvAnonimizado from '../../../NU_83369665_01AGO2026_06AGO2026.anonimizado.csv?raw'
import { classificarMovimentacao, importarCsvNubank } from '../../domain/transactions'
import { loadMovements, saveMovements } from '../../infrastructure/storage'
import { createManualMovement } from '../manual-movement'
import { reconcileImportedMovements } from '../reconcile-import'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const imported = importarCsvNubank(csvAnonimizado)

describe('conciliação de importações CSV', () => {
  it('importar o mesmo CSV duas vezes não duplica movimentações', () => {
    const first = reconcileImportedMovements([], imported)
    const second = reconcileImportedMovements(first.movements, importarCsvNubank(csvAnonimizado))
    expect(second.movements).toHaveLength(imported.length)
    expect(second.summary).toEqual({
      addedMovements: 0,
      ignoredExistingMovements: imported.length,
      preservedReclassifications: 0,
      preservedManualMovements: 0,
    })
  })

  it('arquivo posterior não duplica antigas e adiciona somente novas', () => {
    const laterCsv = `${csvAnonimizado.trim()}\n07/08/2026,125.00,ID-NOVO-2026,Transferência recebida pelo Pix\n`
    const result = reconcileImportedMovements(imported, importarCsvNubank(laterCsv))
    expect(result.movements).toHaveLength(imported.length + 1)
    expect(result.summary.addedMovements).toBe(1)
    expect(result.summary.ignoredExistingMovements).toBe(imported.length)
    expect(result.movements.at(-1)?.dadosOriginais).toMatchObject({ Identificador: 'ID-NOVO-2026', Valor: '125.00' })
  })

  it('preserva movimentações manuais existentes', () => {
    const manual = createManualMovement({
      date: '2026-08-06', description: 'Manual preservada', value: '10.00',
      bankingType: 'saida', financialClassification: 'gasto',
    }, () => 'manual:preservada')
    const result = reconcileImportedMovements([...imported, manual], importarCsvNubank(csvAnonimizado))
    expect(result.movements).toContain(manual)
    expect(result.summary.preservedManualMovements).toBe(1)
  })

  it('preserva reclassificação manual e o objeto bancário existente', () => {
    const target = imported.find(({ classificacaoFinanceira }) => classificacaoFinanceira === 'transferencia')
    if (!target) throw new Error('Transferência esperada')
    const reclassified = classificarMovimentacao(target, 'receita')
    const existing = imported.map((movement) => movement.id === target.id ? reclassified : movement)
    const result = reconcileImportedMovements(existing, importarCsvNubank(csvAnonimizado))
    const preserved = result.movements.find(({ id }) => id === target.id)
    expect(preserved).toBe(reclassified)
    expect(preserved?.classificacaoFinanceira).toBe('receita')
    expect(preserved?.dadosOriginais).toBe(target.dadosOriginais)
    expect(result.summary.preservedReclassifications).toBe(1)
  })

  it('mudar a posição de uma linha não muda sua identidade nem cria registro', () => {
    const [header, first, second, ...rest] = csvAnonimizado.trim().split(/\r?\n/)
    const reordered = importarCsvNubank([header, second, first, ...rest].join('\n'))
    const result = reconcileImportedMovements(imported, reordered)
    expect(result.movements).toHaveLength(imported.length)
    expect(result.summary.addedMovements).toBe(0)
    const originalByRawData = new Map(imported.map((movement) => [JSON.stringify(movement.dadosOriginais), movement.id]))
    for (const movement of reordered) expect(movement.id).toBe(originalByRawData.get(JSON.stringify(movement.dadosOriginais)))
  })

  it('não funde movimentações semelhantes com identificadores externos diferentes', () => {
    const similarCsv = [
      'Data,Valor,Identificador,Descrição',
      '10/08/2026,-50.00,ID-A,Transferência enviada pelo Pix',
      '10/08/2026,-50.00,ID-B,Transferência enviada pelo Pix',
    ].join('\n')
    const similar = importarCsvNubank(similarCsv)
    const result = reconcileImportedMovements([], similar)
    expect(result.movements).toHaveLength(2)
    expect(new Set(result.movements.map(({ id }) => id)).size).toBe(2)
  })

  it('preserva a multiplicidade de ocorrências bancárias realmente idênticas', () => {
    const duplicateCsv = [
      'Data,Valor,Identificador,Descrição',
      '10/08/2026,-50.00,ID-REPETIDO,Transferência enviada pelo Pix',
      '10/08/2026,-50.00,ID-REPETIDO,Transferência enviada pelo Pix',
    ].join('\n')
    const duplicates = importarCsvNubank(duplicateCsv)
    expect(duplicates).toHaveLength(2)
    expect(duplicates[0].id).not.toBe(duplicates[1].id)
    expect(reconcileImportedMovements(duplicates, importarCsvNubank(duplicateCsv)).movements).toHaveLength(2)
  })

  it('mantém dados bancários brutos existentes intactos', () => {
    const rawBefore = imported.map(({ dadosOriginais }) => dadosOriginais)
    const result = reconcileImportedMovements(imported, importarCsvNubank(csvAnonimizado))
    expect(result.movements.map(({ dadosOriginais }) => dadosOriginais)).toEqual(rawBefore)
    for (let index = 0; index < imported.length; index += 1) {
      expect(result.movements[index].dadosOriginais).toBe(imported[index].dadosOriginais)
    }
  })

  it('persiste e restaura a coleção conciliada', () => {
    const storage = new MemoryStorage()
    const laterCsv = `${csvAnonimizado.trim()}\n07/08/2026,125.00,ID-NOVO-2026,Transferência recebida pelo Pix\n`
    const result = reconcileImportedMovements(imported, importarCsvNubank(laterCsv))
    saveMovements(result.movements, storage)
    expect(loadMovements(storage)).toEqual(result.movements)
  })

  it('reconhece registros persistidos com o ID legado baseado em linha', () => {
    const legacy = imported.map((movement, index) => ({ ...movement, id: `nubank:${movement.dadosOriginais.Identificador}:${index + 2}` }))
    const result = reconcileImportedMovements(legacy, importarCsvNubank(csvAnonimizado))
    expect(result.movements).toHaveLength(legacy.length)
    expect(result.summary.addedMovements).toBe(0)
    expect(result.movements[0].id).toBe(legacy[0].id)
  })
})
