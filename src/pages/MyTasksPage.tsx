import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { useCardsOfUser, useLabels, useLists, useProfiles, useProjects } from '@/data/hooks'
// Nota: aquí sí se usan todos los proyectos visibles, porque las tareas de OTRA persona
// pueden estar en proyectos a los que quien mira no pertenece (caso del administrador).
import type { CardRow } from '@/data/types'
import { Avatar } from '@/components/ui/Avatar'
import { DriveIcon } from '@/components/ui/DriveIcon'
import { compareByDueDate, daysOverdue, isDueSoon, longDate, shortDate } from '@/lib/dates'
import { matchesStatus, norm, STATUS_OPTIONS, type StatusFilter } from '@/lib/status'
import { StatusChips } from '@/components/ui/StatusChips'
import { Search, X } from 'lucide-react'
import type { List, Project } from '@/types/database'

export default function MyTasksPage() {
  const { userId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data: profiles } = useProfiles()
  const targetId = userId ?? profile!.id
  const target = profiles?.find((p) => p.id === targetId) ?? profile!
  const { data: cards, isLoading } = useCardsOfUser(targetId)
  const { data: projects } = useProjects()
  const [status, setStatus] = useState<StatusFilter>('pending')
  const [text, setText] = useState('')
  const [showAll, setShowAll] = useState(false)

  const searched = useMemo(() => {
    const words = norm(text.trim()).split(/\s+/).filter(Boolean)
    if (!words.length) return cards ?? []
    return (cards ?? []).filter((c) => {
      const hay = norm(`${c.title} ${c.description} ${(projects ?? []).find((p) => p.id === c.project_id)?.name ?? ''}`)
      return words.every((w) => hay.includes(w))
    })
  }, [cards, text, projects])
  const visible = useMemo(() => searched.filter((c) => matchesStatus(c, status)).sort(compareByDueDate), [searched, status])
  const counts = useMemo(() => Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, searched.filter((c) => matchesStatus(c, o.value)).length])), [searched])
  const overdue = (cards ?? []).filter((c) => daysOverdue(c.due_date, c.completed_at) > 0).length
  const soon = (cards ?? []).filter((c) => isDueSoon(c.due_date, c.completed_at)).length
  const pending = (cards ?? []).filter((c) => !c.completed_at).length
  const doneMonth = (cards ?? []).filter((c) => c.completed_at && c.completed_at.slice(0, 7) === new Date().toISOString().slice(0, 7)).length

  const team = (profiles ?? []).filter((p) => p.approved)
  const shownPeople = showAll ? team : team.slice(0, 7)

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4.5 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end gap-3.5">
        <div>
          <h1 className="text-[22px] font-bold">{target.id === profile!.id ? 'Mis tareas' : `Tareas de ${target.full_name}`}</h1>
          <p className="mt-1 text-[13px] text-muted">
            Todo lo asignado en {projects?.length ?? 0} proyectos. Elige otra persona abajo para ver sus pendientes. Hoy es {longDate(new Date().toISOString().slice(0, 10)).toLowerCase()}.
          </p>
        </div>
        <label className="ml-auto flex w-full items-center gap-2 rounded-lg border border-line-2 bg-surface px-2.5 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft sm:w-72">
          <Search className="size-4 text-muted" aria-hidden="true" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar en estas tareas…" aria-label="Buscar en estas tareas" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted" />
          {text && (
            <button type="button" aria-label="Borrar búsqueda" onClick={() => setText('')} className="text-muted hover:text-ink">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      {/* Filtro por persona */}
      <div className="panel flex flex-wrap items-center gap-2 px-3.5 py-2.5">
        <span className="mr-1 text-[13px] font-semibold text-ink-2">Ver tareas de:</span>
        {shownPeople.map((p) => {
          const on = p.id === targetId
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => navigate(p.id === profile!.id ? '/mis-tareas' : `/mis-tareas/${p.id}`)}
              className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[13px] ${on ? 'border-accent-line bg-accent-soft font-semibold text-accent-ink' : 'border-line bg-surface font-medium text-ink-2 hover:bg-ground'}`}
            >
              <Avatar person={p} size={22} /> {p.full_name}
              {p.id === profile!.id && ' (yo)'}
            </button>
          )
        })}
        {team.length > 7 && (
          <button type="button" className="rounded-full border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink-3" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Menos personas' : `Más personas (${team.length - 7})`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Kpi value={overdue} label="Vencidas" color="text-danger-text" />
        <Kpi value={soon} label="Para esta semana" color="text-warn-text" />
        <Kpi value={pending} label="Pendientes en total" />
        <Kpi value={doneMonth} label="Terminadas este mes" color="text-accent" />
      </div>

      <StatusChips value={status} onChange={setStatus} counts={counts} />

      {isLoading && <p className="text-sm text-muted">Cargando…</p>}
      {!isLoading && visible.length === 0 && (
        <div className="panel p-8 text-center text-sm text-muted">
          {status === 'pending' && !text ? 'No hay tareas pendientes. ¡Buen trabajo!' : 'No hay tareas con estos filtros.'}
        </div>
      )}

      {(projects ?? [])
        .filter((p) => visible.some((c) => c.project_id === p.id))
        .map((p) => (
          <ProjectGroup key={p.id} project={p} cards={visible.filter((c) => c.project_id === p.id)} />
        ))}
    </main>
  )
}

function Kpi({ value, label, color = '' }: { value: number; label: string; color?: string }) {
  return (
    <div className="panel flex flex-[1_1_150px] flex-col gap-1 px-4 py-3.5">
      <b className={`text-2xl leading-tight ${color}`}>{value}</b>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}

function ProjectGroup({ project, cards }: { project: Project; cards: CardRow[] }) {
  const { data: lists } = useLists(project.id)
  const { data: labels } = useLabels(project.id)
  const listName = (id: string) => (lists ?? []).find((l: List) => l.id === id)
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 text-sm font-bold">
        <span className="size-2 rounded-[2px]" style={{ background: project.color }} aria-hidden="true" />
        {project.name} <span className="text-xs font-medium text-muted">· {cards.length} tareas</span>
        <Link to={`/p/${project.id}`} className="ml-auto text-xs font-semibold text-accent hover:underline">
          Abrir tablero →
        </Link>
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_150px_130px_120px_90px] gap-3.5 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-muted md:grid">
        <span>Tarea</span>
        <span>Lista</span>
        <span>Fecha</span>
        <span>Etiqueta</span>
        <span>Drive</span>
      </div>
      {cards.map((c) => {
        const od = daysOverdue(c.due_date, c.completed_at)
        const l = listName(c.list_id)
        const lab = c.card_labels.map((x) => (labels ?? []).find((y) => y.id === x.label_id)).filter(Boolean)
        return (
          <Link
            key={c.id}
            to={`/p/${project.id}/c/${c.id}`}
            className="grid grid-cols-1 gap-1.5 border-t border-ground px-4 py-2.5 text-sm hover:bg-ground md:grid-cols-[minmax(0,1fr)_150px_130px_120px_90px] md:items-center md:gap-3.5"
          >
            <span className={`font-medium ${c.completed_at ? 'text-muted line-through' : ''}`}>{c.title}</span>
            <span>
              <span className={`chip px-2.5 py-0.5 text-xs ${l?.is_done ? 'bg-ok-soft text-ok-ink' : 'bg-ground text-ink-2'}`}>{l?.name ?? '—'}</span>
            </span>
            <span className={od > 0 ? 'font-semibold text-danger-text' : isDueSoon(c.due_date, c.completed_at) ? 'font-semibold text-warn-text' : 'text-ink-2'}>
              {c.due_date ? shortDate(c.due_date) : '—'}
              {od > 0 && ` · vencida`}
            </span>
            <span className="flex flex-wrap gap-1">
              {lab.map((x) => (
                <span key={x!.id} className="chip" style={{ background: x!.color, color: x!.text_color }}>
                  {x!.name}
                </span>
              ))}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              {(c.attachments_count ?? 0) > 0 ? (
                <>
                  <DriveIcon className="size-3.5" /> {c.attachments_count}
                  {(c.deliverable_count ?? 0) > 0 && ` · ${c.deliverable_count} entr.`}
                </>
              ) : (
                '—'
              )}
            </span>
          </Link>
        )
      })}
    </section>
  )
}
