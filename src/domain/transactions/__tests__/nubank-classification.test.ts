import { describe, expect, it } from 'vitest'
import { classificarDescricaoNubank } from '../importers/nubank-classification'

describe('classificação automática do Nubank', () => {
  it.each([
    ['Aplicação RDB', 'investimento'],
    ['Resgate RDB', 'resgate_investimento'],
    ['Compra no débito', 'gasto'],
    ['Pagamento de fatura', 'gasto'],
    ['Estorno', 'estorno'],
    ['Transferência recebida pelo Pix', 'transferencia'],
    ['Transferência enviada pelo Pix', 'transferencia'],
    ['Descrição ainda desconhecida', 'nao_classificado'],
  ] as const)('classifica "%s" como %s', (descricao, classificacao) => {
    expect(classificarDescricaoNubank(descricao)).toBe(classificacao)
  })

  it('não recebe nem utiliza o sinal do valor', () => {
    expect(classificarDescricaoNubank('Transferência enviada pelo Pix')).toBe('transferencia')
    expect(classificarDescricaoNubank('Transferência recebida pelo Pix')).toBe('transferencia')
  })

  it('prioriza Estorno antes da regra de transferência', () => {
    expect(classificarDescricaoNubank('Estorno - Transferência enviada pelo Pix')).toBe('estorno')
  })
})
