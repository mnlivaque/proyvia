import type { Activity, Profile } from '@/types/database'

type D = Record<string, unknown>

/** Convierte una fila de actividad en frase legible: {verb} {object} {extra}. */
export function describeActivity(a: Activity, people: Map<string, Profile>): { verb: string; object: string; extra?: string; tag: string; tagClass: string } {
  const d = (a.data ?? {}) as D
  const title = String(d.title ?? d.name ?? '')
  const name = (id: unknown) => (typeof id === 'string' ? people.get(id)?.full_name ?? 'alguien' : 'alguien')
  const fmt = (v: unknown) => (typeof v === 'string' && v ? v.split('-').reverse().join('/') : 'sin fecha')

  switch (a.action) {
    case 'card.created':
      return { verb: 'creó la tarea', object: title, tag: 'Nueva', tagClass: 'bg-ground text-ink-2' }
    case 'card.moved':
      return { verb: 'movió', object: title, extra: `de ${d.from} a ${d.to}`, tag: 'Movió', tagClass: 'bg-[#DBEAFE] text-[#1E3A8A]' }
    case 'card.completed':
      return { verb: 'terminó', object: title, tag: 'Terminó', tagClass: 'bg-ok-soft text-ok-ink' }
    case 'card.reopened':
      return { verb: 'reabrió', object: title, tag: 'Reabrió', tagClass: 'bg-warn-soft text-warn-ink' }
    case 'card.renamed':
      return { verb: 'renombró', object: String(d.to ?? ''), extra: `(antes: ${d.from})`, tag: 'Editó', tagClass: 'bg-ground text-ink-2' }
    case 'card.deleted':
      return { verb: 'eliminó la tarea', object: title, tag: 'Eliminó', tagClass: 'bg-danger-soft text-danger-ink' }
    case 'card.restored':
      return { verb: 'recuperó la tarea', object: title, tag: 'Recuperó', tagClass: 'bg-ok-soft text-ok-ink' }
    case 'card.due_date_changed':
      return {
        verb: 'cambió la fecha de',
        object: title,
        extra: `del ${fmt(d.from)} al ${fmt(d.to)}. Motivo: "${d.reason}"`,
        tag: 'Cambio de fecha',
        tagClass: 'bg-danger-soft text-danger-ink',
      }
    case 'card.assigned':
      return { verb: 'asignó', object: title, extra: `a ${name(d.user_id)}`, tag: 'Asignó', tagClass: 'bg-[#E0E7FF] text-[#3730A3]' }
    case 'card.deliverable_added':
      return { verb: 'adjuntó el entregable', object: title, extra: `(${d.name})`, tag: 'Entregable', tagClass: 'bg-ok-soft text-ok-ink' }
    case 'card.reference_added':
      return { verb: 'adjuntó una referencia a', object: title, extra: `(${d.name})`, tag: 'Adjunto', tagClass: 'bg-ground text-ink-2' }
    case 'project.created':
      return { verb: 'creó el proyecto', object: String(d.name ?? ''), tag: 'Proyecto', tagClass: 'bg-ground text-ink-2' }
    case 'project.deleted':
      return { verb: 'eliminó un proyecto', object: '', tag: 'Eliminó', tagClass: 'bg-danger-soft text-danger-ink' }
    case 'project.restored':
      return { verb: 'recuperó un proyecto', object: '', tag: 'Recuperó', tagClass: 'bg-ok-soft text-ok-ink' }
    case 'list.deleted':
      return { verb: 'eliminó una lista', object: '', tag: 'Eliminó', tagClass: 'bg-danger-soft text-danger-ink' }
    case 'list.restored':
      return { verb: 'recuperó una lista', object: '', tag: 'Recuperó', tagClass: 'bg-ok-soft text-ok-ink' }
    case 'user.approved':
      return { verb: 'aprobó la cuenta de', object: name(d.user_id), tag: 'Administración', tagClass: 'bg-[#EDE9FE] text-[#5B21B6]' }
    case 'user.created_by_admin':
      return { verb: 'creó la cuenta de', object: String(d.full_name ?? name(d.user_id)), tag: 'Administración', tagClass: 'bg-[#EDE9FE] text-[#5B21B6]' }
    case 'settings.updated':
      return { verb: 'cambió los ajustes', object: '', tag: 'Administración', tagClass: 'bg-[#EDE9FE] text-[#5B21B6]' }
    default:
      return { verb: a.action, object: title, tag: 'Otro', tagClass: 'bg-ground text-ink-2' }
  }
}
