import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import csvAnonimizado from '../../../NU_83369665_01AGO2026_06AGO2026.anonimizado.csv?raw'
import { calcularEntradasBancarias, calcularSaidasBancarias } from '../../domain/finance'
import { importarCsvNubank, resumirClassificacoesFinanceiras } from '../../domain/transactions'
import { DayScreen } from '../App'
import { confirmCsvImport, prepareCsvImport } from '../csv-import'

const oldSyntheticMovements = [
  { id: 'demo-1' },
] as const

describe('importação CSV pela interface', () => {
  const domainMovements = importarCsvNubank(csvAnonimizado)
  const preview = prepareCsvImport(csvAnonimizado)
  const confirmedMovements = confirmCsvImport(preview)

  it('delega parsing, classificação e totais ao domínio existente', () => {
    expect(preview.movements).toEqual(domainMovements)
    expect(preview.bankingEntries).toBe(calcularEntradasBancarias(domainMovements))
    expect(preview.bankingExits).toBe(calcularSaidasBancarias(domainMovements))
    expect(preview.classificationSummary).toEqual(resumirClassificacoesFinanceiras(domainMovements))
  })

  it('a confirmação produz a nova coleção em memória', () => {
    expect(confirmedMovements).toEqual(domainMovements)
    expect(confirmedMovements).not.toBe(oldSyntheticMovements)
    expect(confirmedMovements.some(({ id }) => id === 'demo-1')).toBe(false)
  })

  it('a tela diária exibe as movimentações importadas da data selecionada', () => {
    const html = renderToStaticMarkup(
      <DayScreen year={2026} month={8} day={1} movements={confirmedMovements} />,
    )
    expect(html).toContain('Transferência enviada pelo Pix')
    expect(html).toContain('Estorno - Transferência enviada pelo Pix')
    expect(html).toContain('R$ 60,00')
  })

  it('remove dados sintéticos antigos e filtra importados de outras datas', () => {
    const html = renderToStaticMarkup(
      <DayScreen year={2026} month={8} day={1} movements={confirmedMovements} />,
    )
    expect(html).not.toContain('Recebimento de cliente')
    expect(html).not.toContain('Compra no débito')
  })
})
