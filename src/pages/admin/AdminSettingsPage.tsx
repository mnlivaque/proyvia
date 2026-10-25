import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useOrgSettings, useProfiles, useProjects, useTrash, useUpdateSettings } from '@/data/adminHooks'
import { friendlyError } from '@/lib/errors'
import { relativeTime } from '@/lib/dates'
import type { OrgSettingsValues } from '@/types/database'
import { useRestore } from '../board/mutations'
import { AdminHeader, Box, ErrorText } from './AdminLayout'

export default function AdminSettingsPage() {
  const { data: org } = useOrgSettings()
  const update = useUpdateSettings()
  const [s, setS] = useState<OrgSettingsValues | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (org) {
      setS(org.settings)
      setName(org.name)
    }
  }, [org])

  if (!s) return <p className="text-sm text-muted">Cargando ajustes…</p>

  const set = <K extends keyof OrgSettingsValues>(k: K, v: OrgSettingsValues[K]) => setS({ ...s, [k]: v })
  const dirty = JSON.stringify(s) !== JSON.stringify(org?.settings) || name !== org?.name

  async function save() {
    setError(null)
    try {
      await update.mutateAsync({ settings: s!, name })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <>
      <AdminHeader
        title="Ajustes"
        actions={
          <button type="button" className="btn-primary" disabled={!dirty || update.isPending} onClick={save}>
            {update.isPending ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar ajustes'}
          </button>
        }
      >
        Reglas generales de Proyvia. Cada cambio queda anotado en Actividad y registro.
      </AdminHeader>
      {error && <ErrorText error={error} />}

      <TrashBox retention={s.trash_retention_days} onRetention={(v) => set('trash_retention_days', v)} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Box title="Fechas y vencimientos">
          <Opt title="Ordenar las listas por fecha límite" hint="De la más antigua a la más reciente. Nadie puede reordenar a mano dentro de una lista." on={s.order_by_due_date} onChange={(v) => set('order_by_due_date', v)} />
          <Opt title="Marcar como VENCIDA la tarea que pasa su fecha" hint="Alerta roja grande en la tarjeta y en Mis tareas." on={s.mark_overdue} onChange={(v) => set('mark_overdue', v)} />
          <Opt title="Aviso de vencidas al iniciar sesión" hint="Cada persona ve sus tareas vencidas al entrar; coordinadores y administradores también las de su equipo." on={s.overdue_notice_on_login} onChange={(v) => set('overdue_notice_on_login', v)} />
          <Opt title="Exigir justificación al cambiar una fecha" hint="Mínimo de caracteres de la justificación:" on={s.require_due_date_reason} onChange={(v) => set('require_due_date_reason', v)}>
            <input type="number" min={1} max={500} className="input mt-1.5 w-24 py-1.5" value={s.due_date_reason_min_chars} onChange={(e) => set('due_date_reason_min_chars', Number(e.target.value) || 1)} />
          </Opt>
          <Opt title="Pedir confirmación al eliminar" hint='Para borrar un tablero, el usuario debe escribir su nombre; lo eliminado va a la Papelera.' on={s.confirm_delete} onChange={(v) => set('confirm_delete', v)} />
        </Box>

        <Box title="Avisos automáticos" subtitle="Notificación en la app + correo a la dirección de cada cuenta">
          <Opt title="Cambio de fecha límite" hint="Avisar al administrador y al coordinador del proyecto con el motivo." on={s.notify_due_date_change} onChange={(v) => set('notify_due_date_change', v)} />
          <Opt title="Tarea vencida" hint="Avisar al responsable y al coordinador el día siguiente al vencimiento, una sola vez." on={s.notify_overdue} onChange={(v) => set('notify_overdue', v)} />
          <Opt title="Me asignaron una tarea" hint="Avisar a la persona cuando la asignan a una tarea." on={s.notify_assignment} onChange={(v) => set('notify_assignment', v)} />
          <Opt title="Nueva cuenta esperando aprobación" hint="Avisar a los administradores." on={s.notify_pending_account} onChange={(v) => set('notify_pending_account', v)} />
          <Opt title="Resumen semanal por correo" hint="Lunes 7:00 a. m.: vencidas, próximas y terminadas por proyecto." on={s.weekly_summary} onChange={(v) => set('weekly_summary', v)} />
          <Field title="Correo remitente" hint="Desde dónde salen los avisos (debe estar verificado en Resend).">
            <input className="input mt-1.5 w-72 py-1.5" value={s.sender_email} onChange={(e) => set('sender_email', e.target.value)} placeholder="avisos@livaque.app" />
          </Field>
        </Box>

        <Box title="Acceso y cuentas">
          <Opt title="Permitir que la gente se registre sola" hint="Si está apagado, solo entran las cuentas que crea un administrador. (También hay que apagarlo en Supabase → Auth.)" on={s.open_signup} onChange={(v) => set('open_signup', v)} />
          <Opt title="Aprobación del administrador antes de ver proyectos" hint="Toda cuenta nueva espera aprobación." on={s.require_approval} onChange={(v) => set('require_approval', v)} />
          <Opt title="Cambiar contraseña en el primer ingreso" hint="Para cuentas creadas desde Excel o por un administrador." on={s.force_password_change} onChange={(v) => set('force_password_change', v)} />
          <Opt title="Ingreso con Google" hint="Además del correo y contraseña." on={s.google_login} onChange={(v) => set('google_login', v)} />
          <Field title="Cerrar sesión por inactividad" hint="Después de:">
            <select className="input mt-1.5 w-44 py-1.5" value={s.session_idle_days} onChange={(e) => set('session_idle_days', Number(e.target.value))}>
              <option value={1}>1 día</option>
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={0}>Nunca</option>
            </select>
          </Field>
        </Box>

        <Box title="Organización">
          <Field title="Nombre">
            <input className="input mt-1.5 w-72 py-1.5" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field title="Dirección de la app" hint={window.location.origin} />
          <Field title="Zona horaria">
            <select className="input mt-1.5 w-72 py-1.5" value={s.timezone} onChange={(e) => set('timezone', e.target.value)}>
              <option value="America/Lima">Lima (GMT-5)</option>
              <option value="America/Bogota">Bogotá (GMT-5)</option>
              <option value="America/Mexico_City">Ciudad de México</option>
              <option value="America/Santiago">Santiago</option>
              <option value="America/Argentina/Buenos_Aires">Buenos Aires</option>
              <option value="Europe/Madrid">Madrid</option>
            </select>
          </Field>
          <BackupField />
        </Box>
      </div>
    </>
  )
}

function Opt({ title, hint, on, onChange, children }: { title: string; hint?: string; on: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5 border-t border-ground px-4 py-3 first:border-0">
      <div className="flex flex-1 flex-col gap-0.5">
        <b className="text-sm font-semibold">{title}</b>
        {hint && <span className="text-xs leading-relaxed text-muted">{hint}</span>}
        {children}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={title} onClick={() => onChange(!on)} className={`relative h-6 w-[42px] shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line-2'}`}>
        <span className={`absolute top-[3px] size-[18px] rounded-full bg-white transition-all ${on ? 'left-[21px]' : 'left-[3px]'}`} />
      </button>
    </div>
  )
}

function Field({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5 border-t border-ground px-4 py-3 first:border-0">
      <div className="flex flex-1 flex-col gap-0.5">
        <b className="text-sm font-semibold">{title}</b>
        {hint && <span className="text-xs text-muted">{hint}</span>}
        {children}
      </div>
    </div>
  )
}

function BackupField() {
  const { data: projects } = useProjects()
  const { data: profiles } = useProfiles()
  const [busy, setBusy] = useState(false)
  async function backup() {
    setBusy(true)
    try {
      const [cards, lists, activity] = await Promise.all([
        supabase.from('cards').select('*, card_assignees(user_id)').is('deleted_at', null),
        supabase.from('lists').select('*').is('deleted_at', null),
        supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(5000),
      ])
      const pName = (id: string | null) => projects?.find((p) => p.id === id)?.name ?? ''
      const uName = (id: string | null) => profiles?.find((p) => p.id === id)?.full_name ?? ''
      const lName = (id: string) => (lists.data ?? []).find((l) => l.id === id)?.name ?? ''
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((projects ?? []).map((p) => ({ Proyecto: p.name, Descripción: p.description, Coordinador: uName(p.coordinator_id), Archivado: p.archived ? 'Sí' : 'No' }))), 'Proyectos')
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          ((cards.data ?? []) as Array<Record<string, unknown> & { card_assignees: { user_id: string }[] }>).map((c) => ({
            Proyecto: pName(c.project_id as string),
            Lista: lName(c.list_id as string),
            Tarea: c.title,
            Descripción: c.description,
            'Fecha límite': c.due_date,
            Prioridad: c.priority,
            Terminada: c.completed_at ? 'Sí' : 'No',
            Responsables: c.card_assignees.map((a) => uName(a.user_id)).join(', '),
            Creada: c.created_at,
          })),
        ),
        'Tareas',
      )
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((profiles ?? []).map((p) => ({ Nombre: p.full_name, Correo: p.email, Rol: p.role, Aprobado: p.approved ? 'Sí' : 'No' }))), 'Personas')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((activity.data ?? []).map((a) => ({ Fecha: a.created_at, Persona: uName(a.user_id), Acción: a.action, Datos: JSON.stringify(a.data), Proyecto: pName(a.project_id) }))), 'Registro')
      XLSX.writeFile(wb, `proyvia_copia_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-start gap-3.5 border-t border-ground px-4 py-3">
      <div className="flex flex-1 flex-col gap-0.5">
        <b className="text-sm font-semibold">Copia de seguridad de los datos</b>
        <span className="text-xs text-muted">Descarga un Excel con proyectos, tareas, personas y registro.</span>
      </div>
      <button type="button" className="btn-secondary whitespace-nowrap" onClick={backup} disabled={busy}>
        {busy ? 'Preparando…' : 'Descargar copia'}
      </button>
    </div>
  )
}

function TrashBox({ retention, onRetention }: { retention: number; onRetention: (v: number) => void }) {
  const { data: items } = useTrash()
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const restore = useRestore()
  const [kind, setKind] = useState('')
  const [error, setError] = useState<string | null>(null)
  const KIND: Record<string, { label: string; cls: string }> = {
    projects: { label: 'Tablero', cls: 'bg-danger-soft text-danger-ink' },
    lists: { label: 'Lista', cls: 'bg-[#DBEAFE] text-[#1E3A8A]' },
    cards: { label: 'Tarea', cls: 'bg-ground text-ink-2' },
    labels: { label: 'Etiqueta', cls: 'bg-[#E0E7FF] text-[#3730A3]' },
    profiles: { label: 'Usuario', cls: 'bg-[#EDE9FE] text-[#5B21B6]' },
  }
  const shown = (items ?? []).filter((i) => !kind || i.kind === kind)

  async function purge(i: { kind: string; id: string; title: string }) {
    if (!window.confirm(`¿Borrar DEFINITIVAMENTE "${i.title}"? Esta acción no se puede deshacer.`)) return
    setError(null)
    const { error } = await supabase.from(i.kind as 'cards').delete().eq('id', i.id)
    if (error) setError(friendlyError(error, 'No se pudo borrar. Solo el administrador puede hacerlo desde la base de datos.'))
    else restore.reset()
  }

  return (
    <Box
      tone="warn"
      title={
        <span className="flex items-center gap-2">
          <Trash2 className="size-4 text-warn-text" aria-hidden="true" /> Papelera: recuperar lo eliminado
        </span>
      }
      subtitle={`Nada se borra de verdad al instante. Todo lo eliminado se guarda ${retention} días y se puede recuperar con un clic.`}
      actions={
        <select className="input w-auto py-1.5 text-[13px]" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo">
          <option value="">Todo lo eliminado</option>
          <option value="projects">Tableros / proyectos</option>
          <option value="lists">Listas</option>
          <option value="cards">Tareas</option>
          <option value="labels">Etiquetas</option>
          <option value="profiles">Usuarios</option>
        </select>
      }
    >
      <div className="hidden grid-cols-[110px_minmax(0,1.6fr)_190px_110px_190px] gap-3.5 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-muted md:grid">
        <span>Tipo</span>
        <span>Qué se eliminó</span>
        <span>Quién y cuándo</span>
        <span>Se borra en</span>
        <span>Acción</span>
      </div>
      {shown.length === 0 && <p className="px-4 py-5 text-center text-sm text-muted">La papelera está vacía.</p>}
      {shown.map((i) => (
        <div key={`${i.kind}-${i.id}`} className={`grid grid-cols-1 gap-2 border-t border-ground px-4 py-2.5 text-[13px] md:grid-cols-[110px_minmax(0,1.6fr)_190px_110px_190px] md:items-center md:gap-3.5 ${i.kind === 'projects' ? 'bg-[#FFF5F5]' : ''}`}>
          <span className={`chip ${KIND[i.kind]?.cls}`}>{KIND[i.kind]?.label}</span>
          <span>
            <strong>{i.title}</strong>
            {i.project_id && i.kind !== 'projects' && <span className="text-xs text-muted"> · {projects?.find((p) => p.id === i.project_id)?.name}</span>}
          </span>
          <span className="text-ink-3">
            {profiles?.find((p) => p.id === i.deleted_by)?.full_name ?? '—'} · {relativeTime(i.deleted_at)}
          </span>
          <span className={`font-semibold ${i.days_left <= 3 ? 'text-danger-text' : 'text-ink-3'}`}>
            {i.days_left} {i.days_left === 1 ? 'día' : 'días'}
          </span>
          <span className="flex gap-1.5">
            <button type="button" className="btn-primary px-3 py-1.5" disabled={restore.isPending} onClick={() => restore.mutate({ table: i.kind, id: i.id })}>
              Recuperar
            </button>
            <button type="button" className="btn-secondary px-2.5 py-1.5 text-danger-text" onClick={() => purge(i)}>
              Borrar ya
            </button>
          </span>
        </div>
      ))}
      {error && <ErrorText error={error} />}
      <div className="flex flex-wrap items-center gap-3.5 border-t border-ground px-4 py-2.5 text-xs text-muted">
        <span>Al recuperar un tablero vuelven también sus listas, tareas, adjuntos, comentarios y personas. Cada eliminación y recuperación queda en Actividad y registro.</span>
        <label className="ml-auto flex items-center gap-2">
          Días en papelera antes de borrar: <input type="number" min={1} max={365} className="input w-20 py-1" value={retention} onChange={(e) => onRetention(Number(e.target.value) || 30)} />
        </label>
      </div>
    </Box>
  )
}
