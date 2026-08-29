import { describe, expect, it } from 'vitest'
import { CLASSIFICACOES_FINANCEIRAS, isClassificacaoFinanceira } from '..'

describe('catálogo canônico de classificações financeiras', () => {
  it('expõe os oito valores oficiais em uma única fonte do domínio', () => {
    expect(CLASSIFICACOES_FINANCEIRAS).toEqual([
      'faturamento',
      'receita',
      'gasto',
      'investimento',
      'resgate_investimento',
      'transferencia',
      'estorno',
      'nao_classificado',
    ])
    expect(new Set(CLASSIFICACOES_FINANCEIRAS).size).toBe(8)
  })

  it('fornece ao restante da aplicação a validação derivada do catálogo', () => {
    for (const value of CLASSIFICACOES_FINANCEIRAS) expect(isClassificacaoFinanceira(value)).toBe(true)
    expect(isClassificacaoFinanceira('salario')).toBe(false)
    expect(isClassificacaoFinanceira(null)).toBe(false)
  })
})
