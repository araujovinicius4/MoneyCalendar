import type {
  ClassificacaoFinanceira,
  DadosBancariosOriginais,
  MovimentacaoFinanceira,
} from './types'
import { CLASSIFICACOES_FINANCEIRAS } from './types'

/** Retorna uma nova movimentação sem alterar o registro ou os dados importados. */
export function classificarMovimentacao<
  TOriginal extends DadosBancariosOriginais,
>(
  movimentacao: MovimentacaoFinanceira<TOriginal>,
  classificacaoFinanceira: ClassificacaoFinanceira,
): MovimentacaoFinanceira<TOriginal> {
  return { ...movimentacao, classificacaoFinanceira }
}

export function resumirClassificacoesFinanceiras(
  movimentacoes: readonly MovimentacaoFinanceira[],
): Record<ClassificacaoFinanceira, number> {
  const resumo = Object.fromEntries(
    CLASSIFICACOES_FINANCEIRAS.map((classificacao) => [classificacao, 0]),
  ) as Record<ClassificacaoFinanceira, number>

  for (const movimentacao of movimentacoes) {
    resumo[movimentacao.classificacaoFinanceira] += 1
  }
  return resumo
}
