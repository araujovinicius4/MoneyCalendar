import type {
  ClassificacaoFinanceira,
  MovimentacaoFinanceira,
  TipoBancario,
  ValorEmCentavos,
} from '../transactions'
import { arredondarValorMonetario } from './money'

type Movimentacoes = readonly MovimentacaoFinanceira[]

const somarPorTipoBancario = (
  movimentacoes: Movimentacoes,
  tipo: TipoBancario,
): ValorEmCentavos =>
  movimentacoes
    .filter((movimentacao) => movimentacao.tipoBancario === tipo)
    .reduce((total, movimentacao) => total + movimentacao.valorEmCentavos, 0)

const somarPorClassificacao = (
  movimentacoes: Movimentacoes,
  classificacao: ClassificacaoFinanceira,
): ValorEmCentavos =>
  movimentacoes
    .filter(
      (movimentacao) =>
        movimentacao.classificacaoFinanceira === classificacao,
    )
    .reduce((total, movimentacao) => total + movimentacao.valorEmCentavos, 0)

export const calcularEntradasBancarias = (movimentacoes: Movimentacoes) =>
  somarPorTipoBancario(movimentacoes, 'entrada')

export const calcularSaidasBancarias = (movimentacoes: Movimentacoes) =>
  somarPorTipoBancario(movimentacoes, 'saida')

export const calcularResultadoBancario = (movimentacoes: Movimentacoes) =>
  calcularEntradasBancarias(movimentacoes) -
  calcularSaidasBancarias(movimentacoes)

export const calcularFaturamento = (movimentacoes: Movimentacoes) =>
  somarPorClassificacao(movimentacoes, 'faturamento')

export const calcularReceitas = (movimentacoes: Movimentacoes) =>
  somarPorClassificacao(movimentacoes, 'receita')

export const calcularGastos = (movimentacoes: Movimentacoes) =>
  somarPorClassificacao(movimentacoes, 'gasto')

/** Resultado da atividade: faturamento menos gastos; pode ser negativo. */
export const calcularLucro = (movimentacoes: Movimentacoes) =>
  calcularFaturamento(movimentacoes) - calcularGastos(movimentacoes)

/** Soma bruta das aplicações, sem descontar resgates. */
export const calcularAplicacoes = (movimentacoes: Movimentacoes) =>
  somarPorClassificacao(movimentacoes, 'investimento')

/** Soma bruta dos resgates de investimento. */
export const calcularResgatesInvestimento = (movimentacoes: Movimentacoes) =>
  somarPorClassificacao(movimentacoes, 'resgate_investimento')

/** Aplicações menos resgates; pode ser negativo. */
export const calcularInvestimentosLiquidos = (movimentacoes: Movimentacoes) =>
  calcularAplicacoes(movimentacoes) - calcularResgatesInvestimento(movimentacoes)

/** @deprecated Prefira calcularInvestimentosLiquidos para explicitar a regra. */
export const calcularInvestimentos = calcularInvestimentosLiquidos

/** Razão realizada entre gastos e faturamento; indefinida sem faturamento. */
export const calcularPercentualEfetivamenteGasto = (movimentacoes: Movimentacoes) => {
  const faturamento = calcularFaturamento(movimentacoes)
  return faturamento === 0 ? null : calcularGastos(movimentacoes) / faturamento
}

/** Razão entre investimentos líquidos e faturamento; indefinida sem faturamento. */
export const calcularPercentualEfetivamenteInvestido = (movimentacoes: Movimentacoes) => {
  const faturamento = calcularFaturamento(movimentacoes)
  return faturamento === 0 ? null : calcularInvestimentosLiquidos(movimentacoes) / faturamento
}

/** Retorna null quando não há gastos, pois a razão não está definida. */
export const calcularIndiceAcumulacao = (movimentacoes: Movimentacoes) => {
  const gastos = calcularGastos(movimentacoes)
  return gastos === 0 ? null : calcularInvestimentosLiquidos(movimentacoes) / gastos
}

export function calcularValorDestinadoInvestimentos(
  movimentacoes: Movimentacoes,
  percentualInvestimento: number,
): number {
  validarPercentualInvestimento(percentualInvestimento)
  return arredondarValorMonetario(
    calcularFaturamento(movimentacoes) * percentualInvestimento,
  )
}

export function calcularPercentualOperacional(percentualInvestimento: number): number {
  validarPercentualInvestimento(percentualInvestimento)
  return 1 - percentualInvestimento
}

function validarPercentualInvestimento(percentualInvestimento: number): void {
  if (!Number.isFinite(percentualInvestimento) || percentualInvestimento < 0 || percentualInvestimento > 1) {
    throw new RangeError('percentualInvestimento deve estar entre 0 e 1')
  }
}

/** Montante do faturamento disponível para a operação após investimentos. */
export function calcularOrcamentoOperacional(
  movimentacoes: Movimentacoes,
  percentualInvestimento: number,
): number {
  validarPercentualInvestimento(percentualInvestimento)

  return arredondarValorMonetario(
    calcularFaturamento(movimentacoes) * calcularPercentualOperacional(percentualInvestimento),
  )
}

/**
 * Conta, de forma inclusiva, de hoje até o primeiro dia útil do próximo mês.
 * Para o cálculo atual, dia útil significa segunda a sexta-feira, sem considerar feriados.
 */
export function calcularDiasRestantesAtePrimeiroDiaUtilProximoMes(dataAtual: Date): number {
  if (Number.isNaN(dataAtual.getTime())) throw new RangeError('dataAtual deve ser uma data válida')

  const primeiroDiaUtil = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 1)
  while (primeiroDiaUtil.getDay() === 0 || primeiroDiaUtil.getDay() === 6) {
    primeiroDiaUtil.setDate(primeiroDiaUtil.getDate() + 1)
  }

  const atualUtc = Date.UTC(dataAtual.getFullYear(), dataAtual.getMonth(), dataAtual.getDate())
  const limiteUtc = Date.UTC(primeiroDiaUtil.getFullYear(), primeiroDiaUtil.getMonth(), primeiroDiaUtil.getDate())
  return Math.floor((limiteUtc - atualUtc) / 86_400_000) + 1
}

/** Montante operacional ainda disponível depois dos gastos. */
export const calcularSaldoOperacional = (
  movimentacoes: Movimentacoes,
  percentualInvestimento: number,
) => arredondarValorMonetario(
  calcularOrcamentoOperacional(movimentacoes, percentualInvestimento) - calcularGastos(movimentacoes),
)

/**
 * Limite médio diário a partir de agora. Um saldo operacional negativo produz
 * uma meta negativa. A quantidade de dias é recebida do chamador (sem relógio
 * ou calendário implícito) para manter a função pura.
 */
export function calcularMetaDiariaAtualDeGasto(
  movimentacoes: Movimentacoes,
  percentualInvestimento: number,
  diasRestantes: number,
): number | null {
  if (!Number.isFinite(diasRestantes) || diasRestantes <= 0) return null

  return arredondarValorMonetario(
    calcularSaldoOperacional(movimentacoes, percentualInvestimento) / diasRestantes,
  )
}
