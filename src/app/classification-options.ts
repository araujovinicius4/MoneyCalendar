import {
  CLASSIFICACOES_FINANCEIRAS,
  type ClassificacaoFinanceira,
  type TipoBancario,
} from '../domain/transactions'

/** Opções normalmente oferecidas pela interface, sem restringir o modelo do domínio. */
export function getClassificacoesPermitidas(tipoBancario: TipoBancario): readonly ClassificacaoFinanceira[] {
  return CLASSIFICACOES_FINANCEIRAS.filter((classificacao) => tipoBancario === 'entrada'
    ? classificacao !== 'gasto' && classificacao !== 'investimento'
    : classificacao !== 'faturamento' && classificacao !== 'receita' && classificacao !== 'estorno' && classificacao !== 'resgate_investimento')
}

export function isClassificacaoPermitida(
  tipoBancario: TipoBancario,
  classificacao: ClassificacaoFinanceira,
): boolean {
  return getClassificacoesPermitidas(tipoBancario).includes(classificacao)
}
