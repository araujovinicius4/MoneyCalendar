import {
  isClassificacaoFinanceira,
  type MovimentacaoFinanceira,
  type TipoBancario,
} from '../../domain/transactions'
import type { ImportBatch } from '../../app/import-history'

export const STORAGE_KEYS = {
  movements: 'moneycalendar:v2:movements',
  investmentPercentage: 'moneycalendar:v2:investment-percentage',
  onboardingDismissed: 'moneycalendar:v2:onboarding-dismissed',
  importHistory: 'moneycalendar:v2:import-history',
} as const

const IMPORT_HISTORY_SCHEMA_VERSION = 1

export const DEFAULT_INVESTMENT_PERCENTAGE = 0.8

const BANKING_TYPES: readonly TipoBancario[] = ['entrada', 'saida']

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function isMovement(value: unknown): value is MovimentacaoFinanceira {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && value.id.trim().length > 0
    && typeof value.data === 'string'
    && isValidIsoDate(value.data)
    && typeof value.valorEmCentavos === 'number'
    && Number.isSafeInteger(value.valorEmCentavos)
    && value.valorEmCentavos > 0
    && BANKING_TYPES.includes(value.tipoBancario as TipoBancario)
    && isClassificacaoFinanceira(value.classificacaoFinanceira)
    && isRecord(value.dadosOriginais)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
}

function isImportBatch(value: unknown): value is ImportBatch {
  if (!isRecord(value)) return false
  const initialClassifications = value.initialClassifications
  if (typeof value.importBatchId !== 'string' || value.importBatchId.trim().length === 0
    || typeof value.fileName !== 'string' || value.fileName.trim().length === 0
    || !isIsoTimestamp(value.importedAt)
    || (value.status !== 'ativo' && value.status !== 'revertido')
    || !isNonNegativeInteger(value.recognizedMovements)
    || !isNonNegativeInteger(value.addedCount)
    || !isNonNegativeInteger(value.ignoredExistingCount)
    || !isNonNegativeInteger(value.preservedManualCount)
    || !isNonNegativeInteger(value.preservedReclassificationCount)
    || !Array.isArray(value.addedMovementIds)
    || !value.addedMovementIds.every((id) => typeof id === 'string' && id.trim().length > 0)
    || new Set(value.addedMovementIds).size !== value.addedMovementIds.length
    || value.addedCount !== value.addedMovementIds.length
    || !isRecord(initialClassifications)
    || Object.keys(initialClassifications).length !== value.addedMovementIds.length
    || !value.addedMovementIds.every((id) => isClassificacaoFinanceira(initialClassifications[id]))) return false
  return value.status === 'revertido'
    ? isIsoTimestamp(value.revertedAt)
    : value.revertedAt === undefined
}

export function loadMovements(storage: Storage | null = defaultStorage()): readonly MovimentacaoFinanceira[] {
  if (!storage) return []
  try {
    const serialized = storage.getItem(STORAGE_KEYS.movements)
    if (serialized === null) return []
    const parsed: unknown = JSON.parse(serialized)
    if (!Array.isArray(parsed) || !parsed.every(isMovement)) return []
    const ids = new Set(parsed.map(({ id }) => id))
    return ids.size === parsed.length ? parsed : []
  } catch {
    return []
  }
}

export function saveMovements(
  movements: readonly MovimentacaoFinanceira[],
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEYS.movements, JSON.stringify(movements))
  } catch {
    // Falhas de quota ou acesso não podem interromper a aplicação.
  }
}

export function loadInvestmentPercentage(storage: Storage | null = defaultStorage()): number {
  if (!storage) return DEFAULT_INVESTMENT_PERCENTAGE
  try {
    const serialized = storage.getItem(STORAGE_KEYS.investmentPercentage)
    if (serialized === null) return DEFAULT_INVESTMENT_PERCENTAGE
    const parsed: unknown = JSON.parse(serialized)
    return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
      ? parsed
      : DEFAULT_INVESTMENT_PERCENTAGE
  } catch {
    return DEFAULT_INVESTMENT_PERCENTAGE
  }
}

export function saveInvestmentPercentage(
  percentage: number,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage || !Number.isFinite(percentage) || percentage < 0 || percentage > 1) return
  try {
    storage.setItem(STORAGE_KEYS.investmentPercentage, JSON.stringify(percentage))
  } catch {
    // Falhas de quota ou acesso não podem interromper a aplicação.
  }
}

export function loadOnboardingDismissed(storage: Storage | null = defaultStorage()): boolean {
  if (!storage) return false
  try {
    return JSON.parse(storage.getItem(STORAGE_KEYS.onboardingDismissed) ?? 'false') === true
  } catch {
    return false
  }
}

export function saveOnboardingDismissed(storage: Storage | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEYS.onboardingDismissed, 'true')
  } catch {
    // A orientação nunca deve bloquear o uso da aplicação.
  }
}

export function loadImportHistory(storage: Storage | null = defaultStorage()): readonly ImportBatch[] {
  if (!storage) return []
  try {
    const serialized = storage.getItem(STORAGE_KEYS.importHistory)
    if (serialized === null) return []
    const parsed: unknown = JSON.parse(serialized)
    if (!isRecord(parsed)
      || parsed.schemaVersion !== IMPORT_HISTORY_SCHEMA_VERSION
      || !Array.isArray(parsed.batches)
      || !parsed.batches.every(isImportBatch)) return []
    const batchIds = new Set(parsed.batches.map(({ importBatchId }) => importBatchId))
    return batchIds.size === parsed.batches.length ? parsed.batches : []
  } catch {
    return []
  }
}

export function saveImportHistory(
  batches: readonly ImportBatch[],
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEYS.importHistory, JSON.stringify({
      schemaVersion: IMPORT_HISTORY_SCHEMA_VERSION,
      batches,
    }))
  } catch {
    // O histórico não deve interromper o uso da aplicação.
  }
}
