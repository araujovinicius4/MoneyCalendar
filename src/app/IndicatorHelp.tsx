import { useState } from 'react'

export interface IndicatorHelpContent {
  readonly meaning: string
  readonly calculation: string
  readonly includes: string
  readonly excludes: string
}

interface IndicatorHelpProps {
  readonly label: string
  readonly help: IndicatorHelpContent
}

export function IndicatorHelp({ label, help }: IndicatorHelpProps) {
  const [isOpen, setOpen] = useState(false)

  return (
    <div className="indicator-help">
      <button
        className="indicator-help__button"
        type="button"
        aria-label={`Ajuda sobre ${label}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >?</button>
      {isOpen && (
        <div className="indicator-help__popover indicator-help__popover--viewport-safe" role="status">
          <strong>{label}</strong>
          <p>{help.meaning}</p>
          <p><b>Cálculo:</b> {help.calculation}</p>
          <p><b>Entra:</b> {help.includes}</p>
          <p><b>Não entra:</b> {help.excludes}</p>
        </div>
      )}
    </div>
  )
}
