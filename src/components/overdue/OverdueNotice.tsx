import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Info } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useCardsOfUser, useCardsSummary, useOrgSettings, useProjects } from '@/data/hooks'
import { daysOverdue } from '@/lib/dates'
import { Avatar } from '@/components/ui/Avatar'

const KEY = 'proyvia:overdue-notice-dismissed'

/**
 * Aviso de tareas vencidas al iniciar sesión (regla del responsable).
 * Se muestra una vez por sesión del navegador; "No volver a mostrar hoy" lo silencia hasta mañana.
 */
export function OverdueNotice() {
  const { user, profile, isAdmin } = useAuth()
  const { data: settings } = useOrgSettings()
  const { data: mine } = useCardsOfUser(user?.id)
  const { data: all } = useCardsSummary()
  const { data: projects } = useProjects()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(true)
  const [hideToday, setHideToday] = useState(false)

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY)
      setDismissed(v === 'session' || v === new Date().toDateString())
    } catch {
      setDismissed(false)
    }
  }, [])

  const overdue = useMemo(() => (mine ?? []).filter((c) => daysOverdue(c.due_date, c.completed_at) > 0).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1)), [mine])

  // Para coordinadores/admins: cuántas vencidas tiene su equipo por proyecto (sin contar las propias).
  const team = useMemo(() => {
    if (!all || !projects || !user) return [] as { name: string; count: number }[]
    const mineIds = new Set(overdue.map((c) => c.id))
    const counts = new Map<string, number>()
    for (const c of all) {
      if (mineIds.has(c.id) || !(daysOverdue(c.due_date, c.completed_at) > 0)) continue
      const p = projects.find((x) => x.id === c.project_id)
      if (!p) continue
      if (!(isAdmin || p.coordinator_id === user.id)) continue
      counts.set(p.name, (counts.get(p.name) ?? 0) + 1)
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }))
  }, [all, projects, user, isAdmin, overdue])

  if (dismissed || !profile || settings?.settings.overdue_notice_on_login === false) return null
  if (overdue.length === 0 && team.length === 0) return null

  function close() {
    try {
      if (hideToday) localStorage.setItem(KEY, new Date().toDateString())
      sessionStorage.setItem(KEY, 'session')
    } catch {
      /* sin almacenamiento: solo cerramos */
    }
    setDismissed(true)
  }

  const projectOf = (id: string) => projects?.find((p) => p.id === id)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(17,24,39,.6)] p-4 pt-[6vh]" role="dialog" aria-modal="true" aria-labelledby="overdue-title">
      <div className="w-full max-w-[760px] overflow-hidden rounded-2xl bg-surface shadow-[0_24px_60px_rgba(0,0,0,.35)]">
        <div className="flex items-center gap-3.5 bg-danger px-6 py-5 text-white">
          <AlertTriangle className="size-8 shrink-0" aria-hidden="true" />
          <div>
            <h1 id="overdue-title" className="text-xl font-bold">
              {overdue.length > 0
                ? `Hola, ${profile.full_name.split(' ')[0]}: tienes ${overdue.length} ${overdue.length === 1 ? 'tarea vencida' : 'tareas vencidas'}`
                : `Hola, ${profile.full_name.split(' ')[0]}: tu equipo tiene tareas vencidas`}
            </h1>
            <p className="mt-0.5 text-sm opacity-90">Este aviso aparece cada vez que inicias sesión mientras haya tareas fuera de fecha.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 px-6 py-4">
          {overdue.map((c) => {
            const d = daysOverdue(c.due_date, c.completed_at)
            const p = projectOf(c.project_id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  close()
                  navigate(`/p/${c.project_id}/c/${c.id}`)
                }}
                className="flex items-center gap-3.5 rounded-xl border border-[#FECACA] bg-[#FFF5F5] px-4 py-3 text-left hover:bg-danger-soft"
              >
                <span className="min-w-[76px] rounded-lg bg-danger px-1.5 py-2 text-center text-[13px] font-bold leading-tight text-white">
                  {d} {d === 1 ? 'día' : 'días'}
                  <small className="block text-[10px] font-semibold opacity-90">de atraso</small>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{c.title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-ink-3">
                    {p && <i className="inline-block size-2 rounded-[2px]" style={{ background: p.color }} aria-hidden="true" />}
                    {p?.name ?? 'Proyecto'} · venció el {c.due_date}
                  </span>
                </span>
                <Avatar person={profile} size={28} />
              </button>
            )
          })}

          {team.length > 0 && (
            <div className="flex items-center gap-2.5 rounded-[10px] border border-[#FDE68A] bg-warn-bg px-3.5 py-3 text-[13px] leading-relaxed text-warn-ink">
              <Info className="size-4.5 shrink-0 text-warn-text" aria-hidden="true" />
              <span>
                Como {isAdmin ? 'administrador' : 'coordinador'}, tu equipo también tiene tareas vencidas:{' '}
                {team.map((t, i) => (
                  <span key={t.name}>
                    <strong>
                      {t.count} en {t.name}
                    </strong>
                    {i < team.length - 1 ? ', ' : '.'}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-6 py-3.5">
          <label className="flex items-center gap-1.5 text-[13px] text-muted">
            <input type="checkbox" className="accent-accent" checked={hideToday} onChange={(e) => setHideToday(e.target.checked)} />
            No volver a mostrar hoy
          </label>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-secondary" onClick={close}>
              Ir al tablero
            </button>
            <Link to="/mis-tareas" onClick={close} className="btn-danger">
              Ver mis tareas vencidas
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
