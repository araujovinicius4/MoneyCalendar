import type { ClassificacaoFinanceira } from '../types'

const CLASSIFICACAO_POR_DESCRICAO: Readonly<Record<string, ClassificacaoFinanceira>> = {
  'Aplicação RDB': 'investimento',
  'Resgate RDB': 'resgate_investimento',
  'Compra no débito': 'gasto',
  'Pagamento de fatura': 'gasto',
  Estorno: 'estorno',
  'Transferência recebida pelo Pix': 'transferencia',
  'Transferência enviada pelo Pix': 'transferencia',
}

/** Classifica somente pela descrição; sinal e tipo bancário não participam. */
export function classificarDescricaoNubank(descricao: string): ClassificacaoFinanceira {
  const descricaoNormalizada = descricao.trim()

  if (descricaoNormalizada.includes('Estorno')) return 'estorno'

  return CLASSIFICACAO_POR_DESCRICAO[descricaoNormalizada] ?? 'nao_classificado'
}
