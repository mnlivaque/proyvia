import { useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { Clock, Mail } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { useOrgSettings, useProfileMap } from '@/data/hooks'
import { friendlyError } from '@/lib/errors'
import { longDate, parseDate } from '@/lib/dates'
import type { DueDateChange, Project } from '@/types/database'
import { useChangeDueDate } from '../mutations'

interface Props {
  projectId: string
  cardId: string
  cardTitle: string
  project: Project
  currentDate: string | null
  history: DueDateChange[]
  onClose: () => void
}

/** Cambiar la fecha límite: justificación obligatoria + aviso automático a admin y coordinador. */
export function ChangeDueDateModal({ projectId, cardId, cardTitle, project, currentDate, history, onClose }: Props) {
  const { data: settings } = useOrgSettings()
  const { map, data: profiles } = useProfileMap()
  const change = useChangeDueDate(projectId)
  const [newDate, setNewDate] = useState(currentDate ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const minChars = settings?.settings.due_date_reason_min_chars ?? 20
  const ready = reason.trim().length >= minChars && newDate !== (currentDate ?? '')
  const shift = currentDate && newDate ? differenceInCalendarDays(parseDate(newDate), parseDate(currentDate)) : null

  const admins = (profiles ?? []).filter((p) => p.role === 'admin' && p.approved)
  const coordinator = project.coordinator_id ? map.get(project.coordinator_id) : undefined
  const recipients = [...admins, ...(coordinator && !admins.some((a) => a.id === coordinator.id) ? [coordinator] : [])]

  async function submit() {
    setError(null)
    try {
      await change.mutateAsync({ cardId, newDate: newDate || null, reason: reason.trim() })
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <Modal title="Cambiar la fecha límite" subtitle={<>Tarea: <strong className="text-ink-2">{cardTitle}</strong> · {project.name}</>} onClose={onClose} width={680}>
      <div className="flex flex-col gap-4.5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="label">Fecha actual</span>
            <div className="input flex items-center gap-2 bg-ground text-muted">{longDate(currentDate)}</div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="label">Nueva fecha</span>
            <input type="date" className="input border-accent ring-2 ring-accent-soft" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </label>
        </div>

        {shift !== null && shift !== 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-warn-bg px-3 py-2 text-[13px] text-warn-text">
            <Clock className="size-4" aria-hidden="true" />
            {shift > 0 ? <>Se aplaza <strong>{shift} {shift === 1 ? 'día' : 'días'}</strong>.</> : <>Se adelanta <strong>{-shift} {-shift === 1 ? 'día' : 'días'}</strong>.</>}{' '}
            {history.length > 0 && <>Es el <strong>{history.length + 1}.º cambio</strong> de fecha de esta tarea.</>}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="label">
            Justificación del cambio <span className="text-danger">*</span>{' '}
            <span className="font-normal text-muted">(obligatoria, mínimo {minChars} caracteres)</span>
          </span>
          <textarea
            className="input min-h-[96px] resize-y"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            placeholder="Explica por qué se mueve la fecha. Ejemplo: el DWG de origen llegó incompleto y se solicitó de nuevo a la municipalidad."
          />
          <span className={`text-right text-xs ${reason.trim().length < minChars ? 'text-muted' : 'text-ok-ink'}`}>
            {reason.trim().length} / 500{reason.trim().length < minChars && ` · faltan ${minChars - reason.trim().length}`}
          </span>
        </label>

        <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-ground px-3.5 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
            <Mail className="size-4 text-accent" aria-hidden="true" /> Proyvia avisará automáticamente (notificación en la app y correo) a:
          </div>
          <div className="flex flex-wrap gap-2.5">
            {recipients.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-[13px]">
                <Avatar person={p} size={24} /> {p.full_name} <span className="text-muted">· {p.role === 'admin' ? 'Administrador' : 'Coordinador del proyecto'}</span>
              </span>
            ))}
            {recipients.length === 0 && <span className="text-[13px] text-muted">Aún no hay administradores ni coordinador definidos.</span>}
          </div>
          <div className="text-xs leading-relaxed text-muted">
            No tienes que hacer nada más: el aviso dice “<em>[tu nombre] cambió la fecha de vencimiento de {cardTitle} del … al … por el siguiente motivo: …</em>”. El cambio también queda en la actividad de la tarjeta.
          </div>
        </div>

        {history.length > 0 && (
          <div>
            <h3 className="pb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Cambios anteriores de esta tarea</h3>
            {history.map((h) => {
              const who = map.get(h.user_id)
              return (
                <div key={h.id} className="flex items-start gap-2.5 border-t border-ground py-2 text-[13px]">
                  {who && <Avatar person={who} size={26} />}
                  <div>
                    <strong>{who?.full_name ?? 'Alguien'}</strong> movió la fecha del <strong>{h.old_date ?? 'sin fecha'}</strong> al <strong>{h.new_date ?? 'sin fecha'}</strong>
                    <div className="mt-0.5 text-ink-3">“{h.reason}”</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}

        <div className="flex items-center gap-2.5 border-t border-ground pt-3.5">
          <span className="text-xs text-muted">El botón se activa cuando la justificación está completa.</span>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" disabled={!ready || change.isPending} onClick={submit}>
              {change.isPending ? 'Guardando…' : 'Guardar cambio'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
