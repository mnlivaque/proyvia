import type { StatusFilter } from '@/lib/status'
import { STATUS_OPTIONS } from '@/lib/status'

const TONE: Record<string, string> = {
  '': 'border-accent-line bg-accent-soft text-accent-ink',
  danger: 'border-danger bg-danger-soft text-danger-ink',
  warn: 'border-[#FDE68A] bg-warn-soft text-warn-ink',
  ok: 'border-[#A7F3D0] bg-ok-soft text-ok-ink',
}

interface Props {
  value: StatusFilter
  onChange: (v: StatusFilter) => void
  /** Cantidad de tareas que mostraría cada opción (con los demás filtros aplicados). */
  counts: Record<string, number>
  /** Listas del tablero, para filtrar por "Por hacer", "En proceso"… */
  lists?: { id: string; name: string }[]
}

export function StatusChips({ value, onChange, counts, lists = [] }: Props) {
  const options = [
    ...STATUS_OPTIONS,
    ...lists.map((l) => ({ value: `list:${l.id}` as StatusFilter, label: l.name, tone: '' })),
  ]
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Filtrar por estado">
      <span className="mr-1 text-[13px] font-semibold text-ink-2">Estado:</span>
      {options.map((o, i) => {
        const on = value === o.value
        return (
          <span key={o.value} className="flex items-center">
            {lists.length > 0 && i === STATUS_OPTIONS.length && <span className="mx-1 h-5 w-px bg-line-2" aria-hidden="true" />}
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] transition-colors ${
                on ? `font-semibold ${TONE[o.tone]}` : 'border-line bg-surface text-ink-2 hover:bg-ground'
              }`}
            >
              {o.label}
              <span className={`rounded-full px-1.5 text-[11px] ${on ? 'bg-white/70' : 'bg-ground text-muted'}`}>{counts[o.value] ?? 0}</span>
            </button>
          </span>
        )
      })}
    </div>
  )
}
