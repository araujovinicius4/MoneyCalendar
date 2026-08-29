import type { ValorEmCentavos } from '../transactions'

/**
 * Converte um resultado monetário intermediário para centavos inteiros.
 * Metades são arredondadas para longe de zero, de forma simétrica para débitos.
 */
export function arredondarValorMonetario(valorEmCentavos: number): ValorEmCentavos {
  if (!Number.isFinite(valorEmCentavos)) {
    throw new RangeError('valorEmCentavos deve ser finito')
  }

  return Math.sign(valorEmCentavos) * Math.round(Math.abs(valorEmCentavos))
}
