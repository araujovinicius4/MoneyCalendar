import type { DadosBancariosOriginais, MovimentacaoFinanceira } from '../types'
import { classificarDescricaoNubank } from './nubank-classification'

export interface DadosOriginaisNubank extends DadosBancariosOriginais {
  readonly Data: string
  readonly Valor: string
  readonly Identificador: string
  readonly Descrição: string
}

export type MovimentacaoNubank = MovimentacaoFinanceira<DadosOriginaisNubank>
const CABECALHO = ['Data', 'Valor', 'Identificador', 'Descrição'] as const

/** Identidade bancária estável, independente da posição da linha no CSV. */
export function obterIdentidadeBancariaNubank(dados: DadosOriginaisNubank): string {
  const complemento = encodeURIComponent(JSON.stringify([dados.Data, dados.Valor, dados.Descrição]))
  return `${dados.Identificador}:${complemento}`
}

function lerCsv(conteudo: string): string[][] {
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let entreAspas = false

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice]
    if (caractere === '"') {
      if (entreAspas && conteudo[indice + 1] === '"') {
        campo += '"'
        indice += 1
      } else entreAspas = !entreAspas
    } else if (caractere === ',' && !entreAspas) {
      linha.push(campo)
      campo = ''
    } else if ((caractere === '\n' || caractere === '\r') && !entreAspas) {
      if (caractere === '\r' && conteudo[indice + 1] === '\n') indice += 1
      linha.push(campo)
      if (linha.some(Boolean)) linhas.push(linha)
      linha = []
      campo = ''
    } else campo += caractere
  }

  if (entreAspas) throw new Error('CSV inválido: campo entre aspas não foi fechado')
  linha.push(campo)
  if (linha.some(Boolean)) linhas.push(linha)
  return linhas
}

function converterData(data: string, linha: number): string {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data)
  if (!partes) throw new Error(`Data inválida na linha ${linha}: ${data}`)
  const [, dia, mes, ano] = partes
  const dataUtc = new Date(Date.UTC(+ano, +mes - 1, +dia))
  if (dataUtc.getUTCFullYear() !== +ano || dataUtc.getUTCMonth() + 1 !== +mes || dataUtc.getUTCDate() !== +dia) {
    throw new Error(`Data inválida na linha ${linha}: ${data}`)
  }
  return `${ano}-${mes}-${dia}`
}

function converterValor(valor: string, linha: number): number {
  const partes = /^(-?)(\d+)\.(\d{2})$/.exec(valor)
  if (!partes) throw new Error(`Valor inválido na linha ${linha}: ${valor}`)
  const [, sinal, reais, centavos] = partes
  const magnitude = +reais * 100 + +centavos
  if (!Number.isSafeInteger(magnitude) || magnitude === 0) {
    throw new Error(`Valor inválido na linha ${linha}: ${valor}`)
  }
  return sinal === '-' ? -magnitude : magnitude
}

export function importarCsvNubank(conteudo: string): MovimentacaoNubank[] {
  const [cabecalho, ...registros] = lerCsv(conteudo.replace(/^\uFEFF/, ''))
  if (!cabecalho || cabecalho.length !== CABECALHO.length || !CABECALHO.every((item, i) => cabecalho[i] === item)) {
    throw new Error(`Cabeçalho Nubank inválido. Esperado: ${CABECALHO.join(',')}`)
  }

  const ocorrenciasPorIdentidade = new Map<string, number>()
  return registros.map((colunas, indice) => {
    const numeroLinha = indice + 2
    if (colunas.length !== CABECALHO.length) throw new Error(`Quantidade de colunas inválida na linha ${numeroLinha}`)
    const [Data, Valor, Identificador, Descrição] = colunas
    const valorAssinado = converterValor(Valor, numeroLinha)
    const dadosOriginais = { Data, Valor, Identificador, Descrição }
    const identidade = obterIdentidadeBancariaNubank(dadosOriginais)
    const ocorrencia = (ocorrenciasPorIdentidade.get(identidade) ?? 0) + 1
    ocorrenciasPorIdentidade.set(identidade, ocorrencia)
    return {
      id: `nubank:${identidade}:${ocorrencia}`,
      data: converterData(Data, numeroLinha),
      valorEmCentavos: Math.abs(valorAssinado),
      tipoBancario: valorAssinado > 0 ? 'entrada' : 'saida',
      classificacaoFinanceira: classificarDescricaoNubank(Descrição),
      dadosOriginais,
    }
  })
}
