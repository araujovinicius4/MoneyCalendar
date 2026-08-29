import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DayScreen } from '../App'

const html = renderToStaticMarkup(<DayScreen year={2026} month={8} day={14} movements={[]} />)

describe('tela diária', () => {
  it('renderiza a data completa selecionada', () => {
    expect(html).toContain('sexta-feira, 14 de agosto de 2026')
  })

  it('renderiza breadcrumbs para ano, mês e dia', () => {
    expect(html).toContain('href="/calendario/2026"')
    expect(html).toContain('href="/calendario/2026/8"')
    expect(html).toContain('Agosto')
    expect(html).toContain('aria-current="page">14</span>')
  })

  it('renderiza o estado vazio das movimentações', () => {
    expect(html).toContain('Movimentações do dia')
    expect(html).toContain('Nenhuma movimentação neste dia')
  })

  it('renderiza os dois blocos reservados de indicadores', () => {
    expect(html).toContain('Dados bancários do dia')
    expect(html).toContain('Classificação financeira do dia')
  })

  it('renderiza o botão visual para nova movimentação', () => {
    expect(html).toContain('<button class="new-transaction-button" type="button">')
    expect(html).toContain('Nova movimentação')
  })
})
