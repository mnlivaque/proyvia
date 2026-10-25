import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useCardsSummary, useLists, useMyProjects, useProfileMap } from '@/data/hooks'
import { keys } from '@/data/keys'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/errors'
import { daysOverdue } from '@/lib/dates'
import { AvatarStack } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { PROJECT_COLORS } from '@/lib/colors'
import { PendingAccountsBanner } from '@/components/admin/PendingAccountsBanner'
import { RecentActivity } from '@/components/activity/RecentActivity'

export default function ProjectsPage() {
  const { profile, isAdmin } = useAuth()
  const { data: projects, isLoading } = useMyProjects()
  const { data: cards } = useCardsSummary()
  const [creating, setCreating] = useState(false)

  const mine = useMemo(() => (cards ?? []).filter((c) => c.card_assignees.some((a) => a.user_id === profile?.id)), [cards, profile?.id])
  const myOverdue = mine.filter((c) => daysOverdue(c.due_date, c.completed_at) > 0).length
  const mySoon = mine.filter((c) => !c.completed_at && c.due_date && daysOverdue(c.due_date, null) === 0 && c.due_date <= addDays(7)).length

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-wrap gap-7 px-4 py-7 sm:px-6">
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4.5">
        <div className="flex flex-wrap items-end gap-3.5">
          <div>
            <h1 className="text-2xl font-bold">Hola, {profile?.full_name.split(' ')[0]}</h1>
            <p className="mt-1 text-sm text-muted">
              {myOverdue > 0 ? (
                <>
                  Tienes <strong className="text-danger-text">{myOverdue} {myOverdue === 1 ? 'tarea vencida' : 'tareas vencidas'}</strong>
                  {mySoon > 0 && <> y {mySoon} para esta semana</>}. Elige un proyecto para abrir su tablero.
                </>
              ) : mySoon > 0 ? (
                <>Tienes {mySoon} {mySoon === 1 ? 'tarea' : 'tareas'} para esta semana. Elige un proyecto para abrir su tablero.</>
              ) : (
                <>Elige un proyecto para abrir su tablero.</>
              )}
            </p>
          </div>
          <button type="button" className="btn-primary ml-auto" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" /> Nuevo proyecto
          </button>
        </div>

        {isAdmin && <PendingAccountsBanner />}

        {isLoading && <div className="text-sm text-muted">Cargando proyectos…</div>}
        {projects && projects.length === 0 && (
          <div className="panel p-8 text-center text-sm text-muted">
            Aún no perteneces a ningún proyecto. Crea uno o pide a un administrador que te agregue.
            {isAdmin && (
              <>
                {' '}
                Como administrador puedes ver y unirte a todos en{' '}
                <Link to="/admin/proyectos" className="font-semibold text-accent">
                  Administración → Proyectos
                </Link>
                .
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(projects ?? []).filter((p) => !p.archived).map((p) => (
            <ProjectCard key={p.id} project={p} cards={(cards ?? []).filter((c) => c.project_id === p.id)} />
          ))}
        </div>
      </div>

      <aside className="flex flex-[1_1_280px] flex-col gap-3 md:max-w-[340px]">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">Actividad reciente</h2>
        <RecentActivity limit={8} />
      </aside>

      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </main>
  )
}

function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

type SummaryCard = { id: string; list_id: string; due_date: string | null; completed_at: string | null; card_assignees: { user_id: string }[] }

function ProjectCard({ project, cards }: { project: { id: string; name: string; description: string; color: string; updated_at: string }; cards: SummaryCard[] }) {
  const { data: lists } = useLists(project.id)
  const { map } = useProfileMap()
  const total = cards.length
  const done = cards.filter((c) => c.completed_at).length
  const overdue = cards.filter((c) => daysOverdue(c.due_date, c.completed_at) > 0).length
  const people = useMemo(() => {
    const ids = new Set<string>()
    cards.forEach((c) => c.card_assignees.forEach((a) => ids.add(a.user_id)))
    return [...ids].map((id) => map.get(id)).filter(Boolean) as { full_name: string; color: string; avatar_url: string | null }[]
  }, [cards, map])
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <Link to={`/p/${project.id}`} className="panel flex flex-col overflow-hidden transition-shadow hover:border-accent hover:shadow-[0_4px_14px_rgba(0,0,0,.08)]">
      <div className="h-2.5" style={{ background: project.color }} />
      <div className="flex flex-col gap-3 px-4.5 pb-3.5 pt-4">
        <div className="flex items-start gap-2.5">
          <div className="flex-1">
            <div className="text-base font-bold">{project.name}</div>
            <div className="mt-0.5 text-xs text-muted">
              {project.description || 'Sin descripción'} · {people.length} {people.length === 1 ? 'persona' : 'personas'}
            </div>
          </div>
          {overdue > 0 ? (
            <span className="chip bg-danger-soft text-danger-text">
              {overdue} {overdue === 1 ? 'vencida' : 'vencidas'}
            </span>
          ) : (
            <span className="chip bg-ok-soft text-ok-ink">Al día</span>
          )}
        </div>
        <div className="flex flex-wrap gap-5">
          {(lists ?? []).map((l) => {
            const n = cards.filter((c) => c.list_id === l.id).length
            return (
              <div key={l.id} className="flex flex-col">
                <b className={`text-lg leading-tight ${l.is_done ? 'text-accent' : ''}`}>{n}</b>
                <span className="text-[11px] text-muted">{l.name}</span>
              </div>
            )
          })}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center">
          <AvatarStack people={people} />
          <span className="ml-auto text-xs text-muted">{pct}% terminado</span>
        </div>
      </div>
    </Link>
  )
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('create_project', { p_name: name.trim(), p_color: color, p_description: description.trim() })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.projects })
      onClose()
    },
    onError: (e) => setError(friendlyError(e)),
  })

  return (
    <Modal title="Nuevo proyecto" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim().length < 3) return setError('Escribe un nombre de al menos 3 letras.')
          create.mutate()
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="label">Nombre del proyecto</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Plano CBC — Grupo 3" autoFocus />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Descripción (opcional)</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="De qué trata" />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="label">Color</span>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className="size-7 rounded-md border-2"
                style={{ background: c, borderColor: color === c ? '#1F2937' : 'transparent' }}
              />
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">Se crearán las listas Por hacer, En proceso, En revisión y Terminado. Tú quedas como dueño y coordinador; puedes cambiarlo en Administración.</p>
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
