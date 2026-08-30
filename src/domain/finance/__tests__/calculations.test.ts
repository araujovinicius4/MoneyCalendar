import { describe, expect, it } from 'vitest'
import type { MovimentacaoFinanceira } from '../../transactions'
import {
  calcularAplicacoes,
  calcularEntradasBancarias,
  calcularDiasRestantesAtePrimeiroDiaUtilProximoMes,
  calcularFaturamento,
  calcularGastos,
  calcularIndiceAcumulacao,
  calcularInvestimentos,
  calcularInvestimentosLiquidos,
  calcularLucro,
  calcularMetaDiariaAtualDeGasto,
  calcularOrcamentoOperacional,
  calcularPercentualOperacional,
  calcularPercentualEfetivamenteGasto,
  calcularPercentualEfetivamenteInvestido,
  calcularResultadoBancario,
  calcularReceitas,
  calcularResgatesInvestimento,
  calcularSaidasBancarias,
  calcularSaldoOperacional,
  calcularValorDestinadoInvestimentos,
} from '../calculations'
import { arredondarValorMonetario } from '../money'

const movimentacoes: readonly MovimentacaoFinanceira[] = [
  { id: '1', data: '2026-08-01', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: { descricao: 'Venda' } },
  { id: '2', data: '2026-08-02', valorEmCentavos: 30_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: { descricao: 'Aluguel' } },
  { id: '3', data: '2026-08-03', valorEmCentavos: 20_000, tipoBancario: 'saida', classificacaoFinanceira: 'investimento', dadosOriginais: { descricao: 'Aplicação' } },
  { id: '4', data: '2026-08-04', valorEmCentavos: 10_000, tipoBancario: 'entrada', classificacaoFinanceira: 'transferencia', dadosOriginais: { descricao: 'Entre contas' } },
  { id: '5', data: '2026-08-05', valorEmCentavos: 5_000, tipoBancario: 'entrada', classificacaoFinanceira: 'estorno', dadosOriginais: { descricao: 'Estorno' } },
  { id: '6', data: '2026-08-06', valorEmCentavos: 2_000, tipoBancario: 'saida', classificacaoFinanceira: 'nao_classificado', dadosOriginais: { descricao: 'Pendente' } },
]

describe('cálculos bancários', () => {
  it('soma todas as entradas pelo tipo bancário', () => expect(calcularEntradasBancarias(movimentacoes)).toBe(115_000))
  it('soma todas as saídas pelo tipo bancário', () => expect(calcularSaidasBancarias(movimentacoes)).toBe(52_000))
  it('calcula entradas menos saídas', () => expect(calcularResultadoBancario(movimentacoes)).toBe(63_000))
})

describe('cálculos por classificação financeira', () => {
  it('calcula apenas faturamento', () => expect(calcularFaturamento(movimentacoes)).toBe(100_000))
  it('calcula receita separadamente do faturamento', () => {
    const comReceita: readonly MovimentacaoFinanceira[] = [
      ...movimentacoes,
      { id: 'receita', data: '2026-08-07', valorEmCentavos: 4_000, tipoBancario: 'entrada', classificacaoFinanceira: 'receita', dadosOriginais: { descricao: 'Rendimento' } },
    ]
    expect(calcularReceitas(comReceita)).toBe(4_000)
    expect(calcularFaturamento(comReceita)).toBe(100_000)
  })
  it('calcula apenas gastos', () => expect(calcularGastos(movimentacoes)).toBe(30_000))
  it('calcula apenas investimentos', () => expect(calcularInvestimentos(movimentacoes)).toBe(20_000))
  it('não confunde tipo bancário com classificação', () => {
    expect(calcularEntradasBancarias(movimentacoes)).not.toBe(calcularFaturamento(movimentacoes))
    expect(calcularSaidasBancarias(movimentacoes)).not.toBe(calcularGastos(movimentacoes))
  })
  it('não inclui investimento, transferência, estorno ou não classificado nos gastos', () => {
    expect(calcularGastos(movimentacoes)).toBe(30_000)
  })
  it('não inclui transferência nem estorno de entrada no faturamento', () => {
    expect(calcularFaturamento(movimentacoes)).toBe(100_000)
  })
})

describe('lucro', () => {
  const movement = (id: string, value: number, classification: MovimentacaoFinanceira['classificacaoFinanceira']): MovimentacaoFinanceira => ({
    id, data: '2026-08-10', valorEmCentavos: value,
    tipoBancario: classification === 'faturamento' || classification === 'receita' || classification === 'estorno' ? 'entrada' : 'saida',
    classificacaoFinanceira: classification, dadosOriginais: {},
  })
  const billing = movement('fat', 10_000, 'faturamento')

  it('é positivo quando o faturamento supera os gastos', () => {
    expect(calcularLucro([billing, movement('gasto', 4_000, 'gasto')])).toBe(6_000)
  })
  it('é zero quando faturamento e gastos são iguais', () => {
    expect(calcularLucro([billing, movement('gasto', 10_000, 'gasto')])).toBe(0)
  })
  it('é negativo quando os gastos superam o faturamento', () => {
    expect(calcularLucro([billing, movement('gasto', 15_000, 'gasto')])).toBe(-5_000)
  })
  it.each([
    ['investimentos', 'investimento'],
    ['transferências', 'transferencia'],
    ['receitas', 'receita'],
    ['estornos', 'estorno'],
  ] as const)('%s não alteram o lucro', (_label, classification) => {
    expect(calcularLucro([billing, movement(classification, 99_000, classification)])).toBe(10_000)
  })
})

describe('investimentos líquidos acumulados', () => {
  const investmentMovement = (
    id: string,
    value: number,
    classification: 'investimento' | 'resgate_investimento',
  ): MovimentacaoFinanceira => ({
    id, data: '2026-08-10', valorEmCentavos: value,
    tipoBancario: classification === 'investimento' ? 'saida' : 'entrada',
    classificacaoFinanceira: classification, dadosOriginais: {},
  })

  it('mantém integralmente uma aplicação sem resgate', () => {
    const items = [investmentMovement('aplicacao', 20_000, 'investimento')]
    expect(calcularAplicacoes(items)).toBe(20_000)
    expect(calcularResgatesInvestimento(items)).toBe(0)
    expect(calcularInvestimentosLiquidos(items)).toBe(20_000)
  })

  it('desconta um resgate parcial e preserva os totais brutos', () => {
    const items = [investmentMovement('aplicacao', 20_000, 'investimento'), investmentMovement('resgate', 7_500, 'resgate_investimento')]
    expect(calcularAplicacoes(items)).toBe(20_000)
    expect(calcularResgatesInvestimento(items)).toBe(7_500)
    expect(calcularInvestimentosLiquidos(items)).toBe(12_500)
  })

  it('zera o líquido em um resgate integral', () => {
    const items = [investmentMovement('aplicacao', 20_000, 'investimento'), investmentMovement('resgate', 20_000, 'resgate_investimento')]
    expect(calcularInvestimentosLiquidos(items)).toBe(0)
  })

  it('preserva valor negativo quando o resgate supera as aplicações do mês', () => {
    const items = [investmentMovement('aplicacao', 5_000, 'investimento'), investmentMovement('resgate', 12_000, 'resgate_investimento')]
    expect(calcularInvestimentosLiquidos(items)).toBe(-7_000)
  })

  it('preserva valor negativo em mês com somente resgate', () => {
    expect(calcularInvestimentosLiquidos([investmentMovement('resgate anterior', 12_000, 'resgate_investimento')])).toBe(-12_000)
  })

  it('usa o líquido no percentual efetivamente investido e no índice de acumulação', () => {
    const items = [...movimentacoes, investmentMovement('resgate', 5_000, 'resgate_investimento')]
    expect(calcularPercentualEfetivamenteInvestido(items)).toBe(0.15)
    expect(calcularIndiceAcumulacao(items)).toBe(0.5)
  })

  it('não inclui resgate em faturamento, receita ou gastos', () => {
    const items = [investmentMovement('resgate', 50_000, 'resgate_investimento')]
    expect(calcularFaturamento(items)).toBe(0)
    expect(calcularReceitas(items)).toBe(0)
    expect(calcularGastos(items)).toBe(0)
  })
})

describe('indicadores operacionais', () => {
  it('calcula os percentuais efetivamente gasto e investido sobre o faturamento', () => {
    expect(calcularPercentualEfetivamenteGasto(movimentacoes)).toBe(0.3)
    expect(calcularPercentualEfetivamenteInvestido(movimentacoes)).toBe(0.2)
  })
  it('retorna null para ambos os percentuais realizados sem faturamento', () => {
    const semFaturamento = movimentacoes.filter(({ classificacaoFinanceira }) => classificacaoFinanceira !== 'faturamento')
    expect(calcularPercentualEfetivamenteGasto(semFaturamento)).toBeNull()
    expect(calcularPercentualEfetivamenteInvestido(semFaturamento)).toBeNull()
  })
  it('calcula investimentos / gastos', () => expect(calcularIndiceAcumulacao(movimentacoes)).toBeCloseTo(2 / 3))
  it('retorna null no índice quando não há gastos', () => expect(calcularIndiceAcumulacao([])).toBeNull())
  it('aplica o percentual de investimento ao faturamento', () => expect(calcularOrcamentoOperacional(movimentacoes, 0.2)).toBe(80_000))
  it('calcula o percentual operacional complementar', () => expect(calcularPercentualOperacional(0.8)).toBeCloseTo(0.2))
  it('calcula o valor destinado a investimentos pelo percentual', () => expect(calcularValorDestinadoInvestimentos(movimentacoes, 0.8)).toBe(80_000))
  it('não usa receita como base dos indicadores operacionais', () => {
    const comReceita: readonly MovimentacaoFinanceira[] = [
      ...movimentacoes,
      { id: 'receita', data: '2026-08-07', valorEmCentavos: 40_000, tipoBancario: 'entrada', classificacaoFinanceira: 'receita', dadosOriginais: {} },
    ]
    expect(calcularOrcamentoOperacional(comReceita, 0.2)).toBe(calcularOrcamentoOperacional(movimentacoes, 0.2))
    expect(calcularSaldoOperacional(comReceita, 0.2)).toBe(calcularSaldoOperacional(movimentacoes, 0.2))
    expect(calcularMetaDiariaAtualDeGasto(comReceita, 0.2, 3)).toBe(calcularMetaDiariaAtualDeGasto(movimentacoes, 0.2, 3))
  })
  it('calcula orçamento menos gastos como saldo', () => expect(calcularSaldoOperacional(movimentacoes, 0.2)).toBe(50_000))
  it('divide o saldo pelos dias restantes e entrega centavos inteiros', () => expect(calcularMetaDiariaAtualDeGasto(movimentacoes, 0.2, 3)).toBe(16_667))
  it('preserva uma meta negativa quando o saldo operacional está em déficit', () => {
    const deficit = movimentacoes.map((item) => item.id === '2' ? { ...item, valorEmCentavos: 90_000 } : item)
    expect(calcularMetaDiariaAtualDeGasto(deficit, 0.2, 5)).toBe(-2_000)
  })
  it.each([0, -1])('retorna null com dias restantes não positivos: %s', (dias) => {
    expect(calcularMetaDiariaAtualDeGasto(movimentacoes, 0.2, dias)).toBeNull()
  })
  it.each([-0.1, 1.1, Number.NaN])('rejeita percentual de investimento inválido: %s', (percentual) => {
    expect(() => calcularOrcamentoOperacional(movimentacoes, percentual)).toThrow(RangeError)
  })
  it('conta hoje até o primeiro dia útil do próximo mês de forma inclusiva', () => {
    expect(calcularDiasRestantesAtePrimeiroDiaUtilProximoMes(new Date(2026, 7, 14))).toBe(19)
  })
  it('avança o limite para segunda quando o próximo mês começa no fim de semana', () => {
    expect(calcularDiasRestantesAtePrimeiroDiaUtilProximoMes(new Date(2026, 4, 31))).toBe(2)
  })
})

describe('política de arredondamento monetário', () => {
  const umCentavoDeFaturamento: readonly MovimentacaoFinanceira[] = [
    { id: 'fracao', data: '2026-08-01', valorEmCentavos: 1, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: {} },
  ]

  it('arredonda frações para o centavo mais próximo, para cima e para baixo', () => {
    expect(arredondarValorMonetario(10.49)).toBe(10)
    expect(arredondarValorMonetario(10.5)).toBe(11)
  })

  it('aplica a mesma política simétrica a valores negativos', () => {
    expect(arredondarValorMonetario(-10.49)).toBe(-10)
    expect(arredondarValorMonetario(-10.5)).toBe(-11)
  })

  it('arredonda resultados percentuais que produzem frações de centavo', () => {
    expect(calcularValorDestinadoInvestimentos(umCentavoDeFaturamento, 0.5)).toBe(1)
    expect(calcularOrcamentoOperacional(umCentavoDeFaturamento, 0.5)).toBe(1)
  })

  it('preserva os extremos de percentual 0% e 100%', () => {
    expect(calcularValorDestinadoInvestimentos(movimentacoes, 0)).toBe(0)
    expect(calcularOrcamentoOperacional(movimentacoes, 0)).toBe(100_000)
    expect(calcularValorDestinadoInvestimentos(movimentacoes, 1)).toBe(100_000)
    expect(calcularOrcamentoOperacional(movimentacoes, 1)).toBe(0)
  })

  it('elimina resíduos de ponto flutuante dos resultados monetários finais', () => {
    const budget = calcularOrcamentoOperacional(movimentacoes, 0.9)
    expect(budget).toBe(10_000)
    expect(Number.isInteger(budget)).toBe(true)
    expect(Number.isInteger(calcularSaldoOperacional(movimentacoes, 0.9))).toBe(true)
    expect(Number.isInteger(calcularMetaDiariaAtualDeGasto(movimentacoes, 0.9, 3) ?? NaN)).toBe(true)
  })

  it('mantém o índice de acumulação como razão, sem arredondamento monetário', () => {
    const indice = calcularIndiceAcumulacao(movimentacoes)
    expect(indice).toBe(2 / 3)
    expect(indice === null ? null : Number.isInteger(indice)).toBe(false)
  })
})

describe('pureza', () => {
  it('não modifica as movimentações recebidas', () => {
    const antes = JSON.stringify(movimentacoes)
    calcularSaldoOperacional(movimentacoes, 0.2)
    expect(JSON.stringify(movimentacoes)).toBe(antes)
  })
})
