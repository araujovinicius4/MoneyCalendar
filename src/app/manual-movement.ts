import type {
  ClassificacaoFinanceira,
  DadosBancariosOriginais,
  MovimentacaoFinanceira,
  TipoBancario,
} from '../domain/transactions'

export interface ManualMovementOriginalData extends DadosBancariosOriginais {
  readonly origem: 'manual'
  readonly descricaoOriginal: string
  readonly valorOriginal: string
  readonly valorAssinadoEmCentavos: number
  readonly horario?: string
  readonly observacao?: string
}

export interface ManualMovementInput {
  readonly date: string
  readonly description: string
  readonly value: string
  readonly bankingType: TipoBancario
  readonly financialClassification: ClassificacaoFinanceira
  readonly time?: string
  readonly note?: string
}

export type ManualMovement = MovimentacaoFinanceira<ManualMovementOriginalData>

export function isManualMovement(movement: MovimentacaoFinanceira): movement is ManualMovement {
  return movement.dadosOriginais.origem === 'manual'
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() + 1 === Number(month)
    && date.getUTCDate() === Number(day)
}

export function normalizeManualValue(value: string, bankingType: TipoBancario) {
  const normalized = value.trim().replace(',', '.')
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized)
  if (!match) throw new Error('Informe um valor monetário válido.')
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('O valor deve ser maior que zero.')
  const signedCents = bankingType === 'saida' ? -cents : cents
  return {
    valueInCents: cents,
    signedValueInCents: signedCents,
    signedOriginalValue: `${signedCents < 0 ? '-' : ''}${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`,
  }
}

const defaultId = () => {
  const uniquePart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `manual:${uniquePart}`
}

export function createManualMovement(
  input: ManualMovementInput,
  generateId: () => string = defaultId,
): ManualMovement {
  const description = input.description.trim()
  if (!description) throw new Error('A descrição é obrigatória.')
  if (!isValidIsoDate(input.date)) throw new Error('Informe uma data válida.')
  if (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('Informe um horário válido.')

  const normalizedValue = normalizeManualValue(input.value, input.bankingType)
  const time = input.time?.trim() || undefined
  const note = input.note?.trim() || undefined
  return {
    id: generateId(),
    data: input.date,
    valorEmCentavos: normalizedValue.valueInCents,
    tipoBancario: input.bankingType,
    classificacaoFinanceira: input.financialClassification,
    dadosOriginais: {
      origem: 'manual',
      descricaoOriginal: description,
      valorOriginal: normalizedValue.signedOriginalValue,
      valorAssinadoEmCentavos: normalizedValue.signedValueInCents,
      ...(time ? { horario: time } : {}),
      ...(note ? { observacao: note } : {}),
    },
  }
}

export function updateManualMovementInMemory(
  movements: readonly MovimentacaoFinanceira[],
  updatedMovement: ManualMovement,
): readonly MovimentacaoFinanceira[] {
  const current = movements.find(({ id }) => id === updatedMovement.id)
  if (!current || !isManualMovement(current)) throw new Error('Somente movimentações manuais podem ser editadas.')
  return movements.map((movement) => movement.id === updatedMovement.id ? updatedMovement : movement)
}

export function deleteManualMovementInMemory(
  movements: readonly MovimentacaoFinanceira[],
  movementId: string,
): readonly MovimentacaoFinanceira[] {
  const current = movements.find(({ id }) => id === movementId)
  if (!current || !isManualMovement(current)) throw new Error('Somente movimentações manuais podem ser excluídas.')
  return movements.filter(({ id }) => id !== movementId)
}
