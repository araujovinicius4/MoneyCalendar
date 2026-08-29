import { describe, expect, it } from 'vitest'
import { CLASSIFICACOES_FINANCEIRAS } from '../../domain/transactions'
import { getClassificacoesPermitidas, isClassificacaoPermitida } from '../classification-options'

describe('compatibilidade de classificações na interface', () => {
  it('oferece resgate de investimento somente para entrada', () => {
    expect(getClassificacoesPermitidas('entrada')).toEqual([
      'faturamento', 'receita', 'resgate_investimento', 'transferencia', 'estorno', 'nao_classificado',
    ])
    expect(isClassificacaoPermitida('entrada', 'gasto')).toBe(false)
    expect(isClassificacaoPermitida('entrada', 'investimento')).toBe(false)
    expect(isClassificacaoPermitida('entrada', 'resgate_investimento')).toBe(true)
  })

  it('oferece para saída somente gasto, investimento, transferência e não classificado', () => {
    expect(getClassificacoesPermitidas('saida')).toEqual([
      'gasto', 'investimento', 'transferencia', 'nao_classificado',
    ])
    expect(isClassificacaoPermitida('saida', 'faturamento')).toBe(false)
    expect(isClassificacaoPermitida('saida', 'receita')).toBe(false)
    expect(isClassificacaoPermitida('saida', 'estorno')).toBe(false)
    expect(isClassificacaoPermitida('saida', 'resgate_investimento')).toBe(false)
  })

  it('mantém transferência disponível nos dois tipos e deriva as opções do catálogo canônico', () => {
    expect(isClassificacaoPermitida('entrada', 'transferencia')).toBe(true)
    expect(isClassificacaoPermitida('saida', 'transferencia')).toBe(true)
    const offeredUnion = new Set([...getClassificacoesPermitidas('entrada'), ...getClassificacoesPermitidas('saida')])
    expect(offeredUnion.size).toBe(CLASSIFICACOES_FINANCEIRAS.length)
    expect(CLASSIFICACOES_FINANCEIRAS.every((classification) => offeredUnion.has(classification))).toBe(true)
  })
})
