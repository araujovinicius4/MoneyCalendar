import { describe, expect, it } from 'vitest'
import csvAnonimizado from '../../../../NU_83369665_01AGO2026_06AGO2026.anonimizado.csv?raw'
import { classificarMovimentacao, importarCsvNubank } from '../../transactions'
import {
  calcularEntradasBancarias,
  calcularFaturamento,
  calcularGastos,
  calcularIndiceAcumulacao,
  calcularInvestimentos,
  calcularResultadoBancario,
  calcularSaidasBancarias,
} from '../calculations'

const movimentacoes = importarCsvNubank(csvAnonimizado)

describe('motor financeiro integrado com a fixture Nubank', () => {
  it('calcula os totais bancários somente pelo tipo bancário', () => {
    expect(calcularEntradasBancarias(movimentacoes)).toBe(811_069)
    expect(calcularSaidasBancarias(movimentacoes)).toBe(1_099_224)
    expect(calcularResultadoBancario(movimentacoes)).toBe(-288_155)
  })

  it('calcula os totais financeiros somente pela classificação', () => {
    expect(calcularFaturamento(movimentacoes)).toBe(0)
    expect(calcularGastos(movimentacoes)).toBe(68_153)
    expect(calcularInvestimentos(movimentacoes)).toBe(673_317)
    expect(calcularIndiceAcumulacao(movimentacoes)).toBeCloseTo(673_317 / 68_153)
  })

  it('inclui investimento e transferência de saída apenas nas saídas bancárias', () => {
    const saidasForaDeGastos = movimentacoes.filter((item) =>
      item.tipoBancario === 'saida' &&
      (item.classificacaoFinanceira === 'investimento' || item.classificacaoFinanceira === 'transferencia')
    )

    expect(saidasForaDeGastos).toHaveLength(11)
    expect(saidasForaDeGastos.every((item) => item.classificacaoFinanceira !== 'gasto')).toBe(true)
    expect(calcularSaidasBancarias(saidasForaDeGastos)).toBe(1_031_071)
    expect(calcularGastos(saidasForaDeGastos)).toBe(0)
  })

  it('inclui transferência e estorno de entrada apenas nas entradas bancárias', () => {
    const entradasForaDoFaturamento = movimentacoes.filter((item) =>
      item.tipoBancario === 'entrada' &&
      (item.classificacaoFinanceira === 'transferencia' || item.classificacaoFinanceira === 'estorno')
    )

    expect(entradasForaDoFaturamento).toHaveLength(3)
    expect(calcularEntradasBancarias(entradasForaDoFaturamento)).toBe(811_069)
    expect(calcularFaturamento(entradasForaDoFaturamento)).toBe(0)
  })

  it('reclassifica somente os indicadores financeiros, preservando os totais bancários', () => {
    const indice = movimentacoes.findIndex((item) =>
      item.tipoBancario === 'saida' && item.classificacaoFinanceira === 'transferencia'
    )
    const original = movimentacoes[indice]
    const reclassificadas = movimentacoes.map((item, atual) =>
      atual === indice ? classificarMovimentacao(item, 'gasto') : item
    )

    expect(calcularEntradasBancarias(reclassificadas)).toBe(calcularEntradasBancarias(movimentacoes))
    expect(calcularSaidasBancarias(reclassificadas)).toBe(calcularSaidasBancarias(movimentacoes))
    expect(calcularResultadoBancario(reclassificadas)).toBe(calcularResultadoBancario(movimentacoes))
    expect(calcularGastos(reclassificadas)).toBe(calcularGastos(movimentacoes) + original.valorEmCentavos)
    expect(reclassificadas[indice].dadosOriginais).toBe(original.dadosOriginais)
    expect(original.classificacaoFinanceira).toBe('transferencia')
  })

  it('não modifica a coleção normalizada ao calcular todos os indicadores', () => {
    const antes = JSON.stringify(movimentacoes)
    calcularEntradasBancarias(movimentacoes)
    calcularSaidasBancarias(movimentacoes)
    calcularResultadoBancario(movimentacoes)
    calcularFaturamento(movimentacoes)
    calcularGastos(movimentacoes)
    calcularInvestimentos(movimentacoes)
    calcularIndiceAcumulacao(movimentacoes)
    expect(JSON.stringify(movimentacoes)).toBe(antes)
  })
})
