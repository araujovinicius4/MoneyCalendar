export type TipoBancario = 'entrada' | 'saida'

export const CLASSIFICACOES_FINANCEIRAS = [
  'faturamento',
  'receita',
  'gasto',
  'investimento',
  'resgate_investimento',
  'transferencia',
  'estorno',
  'nao_classificado',
] as const

export type ClassificacaoFinanceira = typeof CLASSIFICACOES_FINANCEIRAS[number]

export function isClassificacaoFinanceira(value: unknown): value is ClassificacaoFinanceira {
  return typeof value === 'string'
    && (CLASSIFICACOES_FINANCEIRAS as readonly string[]).includes(value)
}

/** Valor monetário inteiro, expresso em centavos. */
export type ValorEmCentavos = number

export interface DadosBancariosOriginais {
  readonly [campo: string]: unknown
}

/**
 * O registro importado nunca é reescrito. A classificação é um metadado
 * independente, acrescentado pelo MoneyCalendar e livre para ser alterado.
 */
export interface MovimentacaoFinanceira<
  TOriginal extends DadosBancariosOriginais = DadosBancariosOriginais,
> {
  readonly id: string
  readonly data: string
  readonly valorEmCentavos: ValorEmCentavos
  readonly tipoBancario: TipoBancario
  readonly dadosOriginais: Readonly<TOriginal>
  readonly classificacaoFinanceira: ClassificacaoFinanceira
}
