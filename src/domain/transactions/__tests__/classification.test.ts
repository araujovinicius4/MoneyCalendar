import { describe, expect, it } from 'vitest'
import { classificarMovimentacao } from '../classification'
import type { MovimentacaoFinanceira } from '../types'

describe('classificação financeira', () => {
  it('cria uma nova camada de classificação sem alterar os dados importados', () => {
    const original = Object.freeze({ texto: 'PIX recebido', valor: 'R$ 10,00' })
    const movimentacao: MovimentacaoFinanceira<typeof original> = {
      id: 'mov-1',
      data: '2026-08-14',
      valorEmCentavos: 1_000,
      tipoBancario: 'entrada',
      classificacaoFinanceira: 'nao_classificado',
      dadosOriginais: original,
    }

    const classificada = classificarMovimentacao(movimentacao, 'faturamento')

    expect(classificada).not.toBe(movimentacao)
    expect(classificada.classificacaoFinanceira).toBe('faturamento')
    expect(movimentacao.classificacaoFinanceira).toBe('nao_classificado')
    expect(classificada.dadosOriginais).toBe(original)
    expect(classificada.tipoBancario).toBe('entrada')
  })

  it.each(['gasto', 'faturamento'] as const)(
    'permite ao usuário reclassificar uma transferência como %s sem alterar a importação',
    (novaClassificacao) => {
      const dadosOriginais = Object.freeze({
        Descrição: 'Transferência recebida pelo Pix',
        Valor: '100.00',
      })
      const movimentacao = Object.freeze<MovimentacaoFinanceira<typeof dadosOriginais>>({
        id: 'pix-1',
        data: '2026-08-14',
        valorEmCentavos: 10_000,
        tipoBancario: 'entrada',
        classificacaoFinanceira: 'transferencia',
        dadosOriginais,
      })

      const reclassificada = classificarMovimentacao(movimentacao, novaClassificacao)

      expect(reclassificada).toMatchObject({
        tipoBancario: 'entrada',
        classificacaoFinanceira: novaClassificacao,
      })
      expect(reclassificada.dadosOriginais).toBe(dadosOriginais)
      expect(movimentacao.classificacaoFinanceira).toBe('transferencia')
      expect(movimentacao.tipoBancario).toBe('entrada')
    },
  )
})
