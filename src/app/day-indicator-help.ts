export const DAY_INDICATOR_HELP = {
  bankingEntries: {
    meaning: 'Total de dinheiro que entrou nas contas neste dia.',
    calculation: 'Soma das movimentações com tipo bancário entrada.',
    includes: 'Inclui toda entrada bancária, independentemente da classificação financeira.',
    excludes: 'Não inclui movimentações com tipo bancário saída.',
  },
  bankingExits: {
    meaning: 'Total de dinheiro que saiu das contas neste dia.',
    calculation: 'Soma das movimentações com tipo bancário saída.',
    includes: 'Inclui toda saída bancária, inclusive gastos, investimentos e transferências.',
    excludes: 'Não inclui movimentações com tipo bancário entrada.',
  },
  bankingResult: {
    meaning: 'Variação bancária líquida do dia.',
    calculation: 'Entradas bancárias menos saídas bancárias.',
    includes: 'Inclui todas as entradas e saídas bancárias do dia.',
    excludes: 'Não usa a classificação financeira para selecionar movimentações.',
  },
  faturamento: {
    meaning: 'Entradas provenientes de atividade profissional ou comercial.',
    calculation: 'Soma das movimentações classificadas como faturamento.',
    includes: 'Inclui somente a classificação faturamento.',
    excludes: 'Não inclui receita, transferência, estorno ou outras classificações.',
  },
  receita: {
    meaning: 'Entradas financeiras que aumentam recursos, mas não são faturamento.',
    calculation: 'Soma das movimentações classificadas como receita.',
    includes: 'Inclui somente a classificação receita.',
    excludes: 'Não inclui faturamento, transferências recebidas ou estornos.',
  },
  gastos: {
    meaning: 'Valor consumido em despesas classificadas no dia.',
    calculation: 'Soma das movimentações classificadas como gasto.',
    includes: 'Inclui somente a classificação gasto.',
    excludes: 'Não inclui investimentos, transferências, estornos ou itens não classificados.',
  },
  investimentos: {
    meaning: 'Investimentos líquidos realizados no dia.',
    calculation: 'Aplicações menos resgates de investimento.',
    includes: 'Inclui as classificações investimento e resgate de investimento.',
    excludes: 'Não inclui gastos ou transferências, mesmo quando são saídas bancárias.',
  },
  accumulationIndex: {
    meaning: 'Relação entre o valor investido e o valor gasto no dia.',
    calculation: 'Investimentos divididos por gastos.',
    includes: 'Usa aplicações, resgates de investimento e gastos.',
    excludes: 'Não inclui outras classificações; sem gastos, o índice não é calculado.',
  },
} as const

export type DayIndicatorId = keyof typeof DAY_INDICATOR_HELP
