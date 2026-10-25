import { useState } from 'react'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Link } from 'react-router-dom'
import { useActivity, useProfiles, useProjects } from '@/data/adminHooks'
import { describeActivity } from '@/components/activity/describe'
import { Avatar } from '@/components/ui/Avatar'
import { relativeTime } from '@/lib/dates'
import { AdminHeader, Box } from './AdminLayout'

export default function AdminActivityPage() {
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const [projectId, setProjectId] = useState('')
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [period, setPeriod] = useState('7')
  const [text, setText] = useState('')
  const [limit, setLimit] = useState(50)

  const from = period ? new Date(Date.now() - Number(period) * 86400_000).toISOString().slice(0, 10) : undefined
  const { data, isLoading } = useActivity({ projectId: projectId || undefined, userId: userId || undefined, action: action || undefined, from, text: text.trim() || undefined, limit })
  const people = new Map((profiles ?? []).map((p) => [p.id, p]))

  const week = (data ?? []).filter((a) => a.created_at >= new Date(Date.now() - 7 * 86400_000).toISOString())
  const kpi = (prefix: string) => week.filter((a) => a.action.startsWith(prefix)).length

  function exportExcel() {
    const rows = (data ?? []).map((a) => {
      const d = describeActivity(a, people)
      return {
        Fecha: new Date(a.created_at).toLocaleString('es-PE'),
        Persona: a.user_id ? people.get(a.user_id)?.full_name ?? '' : 'Sistema',
        Acción: d.tag,
        Detalle: `${d.verb} ${d.object} ${d.extra ?? ''}`.trim(),
        Proyecto: projects?.find((p) => p.id === a.project_id)?.name ?? '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 18 }, { wch: 80 }, { wch: 28 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Actividad')
    XLSX.writeFile(wb, `proyvia_actividad_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <>
      <AdminHeader
        title="Actividad y registro"
        actions={
          <button type="button" className="btn-secondary" onClick={exportExcel} disabled={!data?.length}>
            <Download className="size-4" aria-hidden="true" /> Exportar a Excel
          </button>
        }
      >
        Todo lo que pasa en Proyvia queda anotado: quién hizo qué, cuándo y en qué proyecto. Nada se puede borrar de aquí.
      </AdminHeader>

      <div className="flex flex-wrap gap-3">
        <Kpi value={week.length} label="Acciones esta semana" />
        <Kpi value={kpi('card.completed')} label="Tareas terminadas" color="text-accent" />
        <Kpi value={kpi('card.due_date_changed')} label="Cambios de fecha" color="text-warn-text" />
        <Kpi value={kpi('card.deliverable_added')} label="Entregables adjuntados" color="text-ok-ink" />
        <Kpi value={new Set(week.map((a) => a.user_id)).size} label="Personas activas" />
      </div>

      <Box>
        <div className="flex flex-wrap items-center gap-2 border-b border-ground px-4 py-3">
          <select className="input w-auto py-1.5 text-[13px]" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Proyecto">
            <option value="">Todos los proyectos</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="input w-auto py-1.5 text-[13px]" value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Persona">
            <option value="">Todas las personas</option>
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
          <select className="input w-auto py-1.5 text-[13px]" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Tipo de acción">
            <option value="">Todas las acciones</option>
            <option value="card.due_date_changed">Cambios de fecha</option>
            <option value="card.completed">Tareas terminadas</option>
            <option value="card.deliverable_added">Entregables adjuntados</option>
            <option value="card.created">Tareas creadas</option>
            <option value="card.moved">Movimientos</option>
            <option value="card.deleted">Eliminaciones</option>
            <option value="user.">Cuentas</option>
            <option value="project.">Proyectos</option>
            <option value="settings.">Ajustes</option>
          </select>
          <select className="input w-auto py-1.5 text-[13px]" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Periodo">
            <option value="1">Hoy</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="">Todo</option>
          </select>
          <label className="ml-auto flex items-center gap-2 rounded-lg bg-ground px-2.5 py-1.5">
            <span className="sr-only">Buscar en el registro</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar código o texto…" className="w-52 bg-transparent text-[13px] outline-none" />
          </label>
        </div>

        <div className="hidden grid-cols-[130px_180px_minmax(0,1fr)_150px] gap-3.5 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-muted md:grid">
          <span>Cuándo</span>
          <span>Quién</span>
          <span>Qué hizo</span>
          <span>Proyecto</span>
        </div>
        {isLoading && <p className="px-4 py-4 text-sm text-muted">Cargando…</p>}
        {!isLoading && (data ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">No hay actividad con esos filtros.</p>}
        {(data ?? []).map((a) => {
          const who = a.user_id ? people.get(a.user_id) : undefined
          const d = describeActivity(a, people)
          const proj = projects?.find((p) => p.id === a.project_id)
          return (
            <div key={a.id} className="grid grid-cols-1 gap-1.5 border-t border-ground px-4 py-2.5 text-[13px] md:grid-cols-[130px_180px_minmax(0,1fr)_150px] md:items-start md:gap-3.5">
              <span className="text-muted">{relativeTime(a.created_at)}</span>
              <span className="flex items-center gap-2 font-medium">
                {who ? <Avatar person={who} size={24} /> : <span className="avatar size-6 bg-line-2 text-[9px]">S</span>}
                {who?.full_name ?? 'Sistema'}
              </span>
              <span>
                <span className={`chip mr-1.5 ${d.tagClass}`}>{d.tag}</span>
                {d.verb}{' '}
                {a.card_id && a.project_id ? (
                  <Link to={`/p/${a.project_id}/c/${a.card_id}`} className="font-semibold text-ink hover:text-accent">
                    {d.object}
                  </Link>
                ) : (
                  <strong>{d.object}</strong>
                )}{' '}
                {d.extra && <span className="text-ink-3">{d.extra}</span>}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                {proj ? (
                  <>
                    <i className="size-[7px] rounded-[2px]" style={{ background: proj.color }} /> {proj.name}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
          )
        })}
        {(data ?? []).length >= limit && (
          <div className="flex items-center gap-2.5 border-t border-ground px-4 py-2.5 text-[13px] text-muted">
            Mostrando {data!.length}
            <button type="button" className="btn-secondary ml-auto px-2.5 py-1.5" onClick={() => setLimit((l) => l + 100)}>
              Cargar más
            </button>
          </div>
        )}
      </Box>
    </>
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
