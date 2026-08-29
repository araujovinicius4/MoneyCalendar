import { describe, expect, it } from 'vitest'
import csvAnonimizado from '../../../../NU_83369665_01AGO2026_06AGO2026.anonimizado.csv?raw'
import { calcularEntradasBancarias, calcularGastos, calcularInvestimentos, calcularSaidasBancarias } from '../../finance'
import { resumirClassificacoesFinanceiras } from '../classification'
import { importarCsvNubank } from '../importers/nubank'

const movimentacoes = importarCsvNubank(csvAnonimizado)

describe('importador CSV do Nubank', () => {
  it('importa 24 movimentações', () => expect(movimentacoes).toHaveLength(24))
  it('totaliza R$ 8.110,69 de entradas', () => expect(calcularEntradasBancarias(movimentacoes)).toBe(811_069))
  it('totaliza R$ 10.992,24 de saídas', () => expect(calcularSaidasBancarias(movimentacoes)).toBe(1_099_224))
  it('classifica R$ 6.733,17 de Aplicação RDB como investimento', () => {
    expect(calcularInvestimentos(movimentacoes)).toBe(673_317)
    expect(movimentacoes.filter((item) => item.classificacaoFinanceira === 'investimento')).toHaveLength(2)
  })
  it('classifica compras no débito e pagamentos de fatura como gastos', () => {
    expect(calcularGastos(movimentacoes)).toBe(68_153)
    expect(movimentacoes.filter((item) => item.classificacaoFinanceira === 'gasto')).toHaveLength(10)
  })
  it('mantém todas as transferências Pix da fixture como transferência por padrão', () => {
    const transferenciasPix = movimentacoes.filter(({ dadosOriginais }) =>
      dadosOriginais.Descrição === 'Transferência enviada pelo Pix' ||
      dadosOriginais.Descrição === 'Transferência recebida pelo Pix'
    )

    expect(transferenciasPix).toHaveLength(11)
    expect(transferenciasPix.every(({ classificacaoFinanceira }) =>
      classificacaoFinanceira === 'transferencia'
    )).toBe(true)
  })
  it('separa o sinal bancário da classificação de transferência', () => {
    const casosComSinaisAtípicos = importarCsvNubank([
      'Data,Valor,Identificador,Descrição',
      '01/08/2026,10.00,pix-enviado,Transferência enviada pelo Pix',
      '01/08/2026,-20.00,pix-recebido,Transferência recebida pelo Pix',
    ].join('\n'))

    expect(casosComSinaisAtípicos).toMatchObject([
      { tipoBancario: 'entrada', classificacaoFinanceira: 'transferencia' },
      { tipoBancario: 'saida', classificacaoFinanceira: 'transferencia' },
    ])
  })
  it('classifica o estorno da transferência enviada pelo Pix como estorno', () => {
    const estornoTransferenciaEnviada = movimentacoes.find((item) =>
      item.dadosOriginais.Valor === '7.00' &&
      item.dadosOriginais.Descrição === 'Estorno - Transferência enviada pelo Pix'
    )
    expect(estornoTransferenciaEnviada).toMatchObject({
      tipoBancario: 'entrada',
      classificacaoFinanceira: 'estorno',
    })
  })
  it('converte datas para ISO', () => {
    expect(movimentacoes[0].data).toBe('2026-08-01')
    expect(movimentacoes.at(-1)?.data).toBe('2026-08-06')
  })
  it('interpreta -60.00 como saída de R$ 60,00', () => {
    const item = movimentacoes.find(({ dadosOriginais }) => dadosOriginais.Valor === '-60.00')
    expect(item).toMatchObject({ valorEmCentavos: 6_000, tipoBancario: 'saida' })
  })
  it('preserva os campos originais', () => {
    expect(movimentacoes[0].dadosOriginais).toEqual({
      Data: '01/08/2026', Valor: '-60.00', Identificador: 'ID-103047C13C2E75D4',
      Descrição: 'Transferência enviada pelo Pix',
    })
  })
  it('não perde nem duplica linhas, mesmo com identificadores repetidos', () => {
    const originais = csvAnonimizado.trim().split(/\r?\n/).slice(1)
    const importadas = movimentacoes.map(({ dadosOriginais: item }) =>
      [item.Data, item.Valor, item.Identificador, item.Descrição].join(','),
    )
    expect(importadas).toEqual(originais)
    expect(new Set(movimentacoes.map(({ id }) => id)).size).toBe(movimentacoes.length)
  })
  it('resume a quantidade em cada classificação', () => {
    expect(resumirClassificacoesFinanceiras(movimentacoes)).toEqual({
      faturamento: 0,
      receita: 0,
      gasto: 10,
      investimento: 2,
      resgate_investimento: 0,
      transferencia: 11,
      estorno: 1,
      nao_classificado: 0,
    })
  })
})

describe('validação do formato Nubank', () => {
  it('rejeita cabeçalho incorreto', () => {
    expect(() => importarCsvNubank('data,valor,id,descricao\n01/08/2026,-1.00,id,x')).toThrow('Cabeçalho Nubank inválido')
  })
  it.each(['"-60,00"', '-6.000', '60', '0.00'])('rejeita valor inválido: %s', (valor) => {
    expect(() => importarCsvNubank(`Data,Valor,Identificador,Descrição\n01/08/2026,${valor},id,x`)).toThrow('Valor inválido')
  })
  it('aceita campos entre aspas', () => {
    const [item] = importarCsvNubank(
      'Data,Valor,Identificador,Descrição\n01/08/2026,-1.00,id,"Compra, com ""detalhe""\nem duas linhas"',
    )
    expect(item.dadosOriginais.Descrição).toBe('Compra, com "detalhe"\nem duas linhas')
  })
})
