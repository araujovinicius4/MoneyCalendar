import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { DayScreen } from '../App'

const movements: readonly MovimentacaoFinanceira[] = [
  { id: '1', data: '2026-08-14', valorEmCentavos: 100_000, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: { descricao: 'Venda do dia' } },
  { id: '2', data: '2026-08-14', valorEmCentavos: 30_000, tipoBancario: 'saida', classificacaoFinanceira: 'gasto', dadosOriginais: { descricao: 'Aluguel do dia' } },
  { id: '3', data: '2026-08-14', valorEmCentavos: 20_000, tipoBancario: 'saida', classificacaoFinanceira: 'investimento', dadosOriginais: { descricao: 'Aplicação do dia' } },
  { id: '4', data: '2026-08-14', valorEmCentavos: 10_000, tipoBancario: 'entrada', classificacaoFinanceira: 'transferencia', dadosOriginais: { descricao: 'Transferência do dia' } },
  { id: '5', data: '2026-08-14', valorEmCentavos: 5_000, tipoBancario: 'entrada', classificacaoFinanceira: 'estorno', dadosOriginais: { descricao: 'Estorno do dia' } },
  { id: '6', data: '2026-08-15', valorEmCentavos: 999_900, tipoBancario: 'entrada', classificacaoFinanceira: 'faturamento', dadosOriginais: { descricao: 'Venda de outra data' } },
]

const html = renderToStaticMarkup(<DayScreen year={2026} month={8} day={14} movements={movements} />)

describe('integração da tela diária com o domínio financeiro', () => {
  it('exibe os totais bancários calculados para o dia', () => {
    expect(html).toContain('Entradas bancárias do dia</dt><dd>R$ 1.150,00')
    expect(html).toContain('Saídas bancárias do dia</dt><dd>R$ 500,00')
    expect(html).toContain('Resultado bancário do dia</dt><dd>R$ 650,00')
  })

  it('exibe os indicadores financeiros calculados para o dia', () => {
    expect(html).toContain('Faturamento do dia</dt><dd>R$ 1.000,00')
    expect(html).toContain('Gastos do dia</dt><dd>R$ 300,00')
    expect(html).toContain('Investimentos do dia</dt><dd>R$ 200,00')
    expect(html).toContain('Índice de acumulação do dia</dt><dd>66,67%')
  })

  it('lista descrição, valor, tipo e classificação das movimentações do dia', () => {
    expect(html).toContain('Venda do dia')
    expect(html).toContain('+R$ 1.000,00')
    expect(html).toContain('Entrada')
    expect(html).toContain('Faturamento')
    expect(html).toContain('Aluguel do dia')
    expect(html).toContain('−R$ 300,00')
    expect(html).toContain('Saída')
    expect(html).toContain('Gasto')
  })

  it('não inclui movimentações nem valores de outras datas', () => {
    expect(html).not.toContain('Venda de outra data')
    expect(html).not.toContain('9.999,00')
  })
})
