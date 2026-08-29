import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MovimentacaoFinanceira } from '../../domain/transactions'
import { DayScreen } from '../App'
import { NewMovementModal } from '../NewMovementModal'

const movement: MovimentacaoFinanceira = {
  id: 'catalog-ui',
  data: '2026-08-15',
  valorEmCentavos: 1,
  tipoBancario: 'entrada',
  classificacaoFinanceira: 'nao_classificado',
  dadosOriginais: {},
}

function expectOptions(html: string, expected: readonly string[], excluded: readonly string[]) {
  for (const classification of expected) {
    expect(html.match(new RegExp(`<option value="${classification}"`, 'g'))).toHaveLength(1)
  }
  for (const classification of excluded) expect(html).not.toContain(`<option value="${classification}"`)
}

describe('catálogo canônico nos formulários', () => {
  it('o cadastro manual deriva do catálogo apenas as opções para saída', () => {
    const html = renderToStaticMarkup(
      <NewMovementModal date="2026-08-15" onClose={() => undefined} onSave={() => undefined} />,
    )
    expectOptions(html, ['gasto', 'investimento', 'transferencia', 'nao_classificado'], ['faturamento', 'receita', 'estorno'])
  })

  it('a reclassificação deriva do catálogo apenas as opções para entrada', () => {
    const html = renderToStaticMarkup(
      <DayScreen year={2026} month={8} day={15} movements={[movement]} />,
    )
    expectOptions(html, ['faturamento', 'receita', 'resgate_investimento', 'transferencia', 'estorno', 'nao_classificado'], ['gasto', 'investimento'])
  })
})
