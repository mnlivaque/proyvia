import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Plus, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { keys } from '@/data/keys'
import { useAuth } from '@/auth/AuthProvider'
import { useMembersOfAll, useProfiles, useProjects } from '@/data/adminHooks'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { friendlyError } from '@/lib/errors'
import { relativeTime } from '@/lib/dates'
import type { Profile, Project } from '@/types/database'
import { useSoftDelete } from '../board/mutations'
import { AdminHeader, Box, ErrorText } from './AdminLayout'

interface ImportRow {
  full_name: string
  email: string
  password: string
  projects: string[]
  status: 'ok' | 'exists' | 'error'
  message?: string
}

export default function AdminUsersPage() {
  const { profile: me } = useAuth()
  const qc = useQueryClient()
  const { data: profiles } = useProfiles()
  const { data: projects } = useProjects()
  const { data: memberships } = useMembersOfAll()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null)
  const [importName, setImportName] = useState('')
  const [editing, setEditing] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const softDelete = useSoftDelete()

  const pending = (profiles ?? []).filter((p) => !p.approved)
  const active = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (profiles ?? []).filter((p) => p.approved && (!s || p.full_name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s)))
  }, [profiles, search])

  const projectsOf = (userId: string) => (memberships ?? []).filter((m) => m.user_id === userId).map((m) => (projects ?? []).find((p) => p.id === m.project_id)).filter(Boolean) as Project[]

  // --- Importar Excel ---------------------------------------------------------
  async function onFile(file: File) {
    setError(null)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const norm = (k: string) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
      const rows: ImportRow[] = raw.map((r) => {
        const get = (...names: string[]) => {
          const key = Object.keys(r).find((k) => names.includes(norm(k)))
          return key ? String(r[key] ?? '').trim() : ''
        }
        const full_name = get('nombre y apellido', 'nombre', 'nombre completo', 'nombres y apellidos')
        const email = get('correo', 'email', 'correo electronico', 'e-mail').toLowerCase()
        const password = get('contrasena', 'contraseña', 'password', 'clave')
        const projs = get('proyectos', 'proyecto')
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
        const row: ImportRow = { full_name, email, password, projects: projs, status: 'ok' }
        const fail = (status: ImportRow['status'], message: string) => {
          row.status = status
          row.message = message
        }
        const unknown = projs.filter((n) => !(projects ?? []).some((p) => p.name.toLowerCase() === n.toLowerCase()))
        if (!full_name || !/\s/.test(full_name)) fail('error', 'Falta nombre y apellido')
        else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('error', 'Correo inválido')
        else if (password.length < 8) fail('error', 'Contraseña menor a 8 caracteres')
        else if ((profiles ?? []).some((p) => p.email.toLowerCase() === email)) fail('exists', 'Ya existe')
        else if (unknown.length) fail('error', `Proyecto no existe: ${unknown.join(', ')}`)
        return row
      })
      if (rows.length === 0) throw new Error('El Excel no tiene filas. Usa la plantilla.')
      setImportName(file.name)
      setImportRows(rows)
    } catch (e) {
      setError(friendlyError(e, 'No se pudo leer el Excel. Usa la plantilla descargable.'))
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nombre y apellido', 'Correo', 'Contraseña', 'Proyectos'],
      ['Ana Castro', 'ana.castro@gmail.com', 'Temporal2026!', (projects ?? []).slice(0, 2).map((p) => p.name).join(', ')],
    ])
    ws['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 18 }, { wch: 40 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios')
    XLSX.writeFile(wb, 'plantilla_usuarios_proyvia.xlsx')
  }

  const bulkCreate = useMutation({
    mutationFn: async (rows: ImportRow[]) => {
      const users = rows
        .filter((r) => r.status === 'ok')
        .map((r) => ({
          full_name: r.full_name,
          email: r.email,
          password: r.password,
          project_ids: r.projects.map((n) => (projects ?? []).find((p) => p.name.toLowerCase() === n.toLowerCase())!.id),
        }))
      const { data, error } = await supabase.functions.invoke('admin-create-users', { body: { users } })
      if (error) throw error
      return data as { created: number; failed: { email: string; error: string }[] }
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: keys.profiles })
      qc.invalidateQueries({ queryKey: ['memberships'] })
      setImportRows(null)
      if (res.failed.length) setError(`Se crearon ${res.created}. Fallaron: ${res.failed.map((f) => `${f.email} (${f.error})`).join('; ')}`)
    },
    onError: (e) => setError(friendlyError(e)),
  })

  return (
    <>
      <AdminHeader
        title="Usuarios"
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" /> Crear un usuario
            </button>
            <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" /> Crear usuarios desde Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </>
        }
      >
        Tú creas las cuentas del equipo (una por una o desde un Excel). Quien se registre por su cuenta no ve nada hasta que lo apruebes.
      </AdminHeader>

      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}

      {importRows && (
        <Box
          tone="accent"
          title="Crear usuarios desde Excel"
          subtitle={`Archivo: ${importName} · ${importRows.length} filas leídas · ${importRows.filter((r) => r.status === 'error').length} con error`}
          actions={
            <button type="button" className="text-xs font-semibold text-accent" onClick={downloadTemplate}>
              <Download className="mr-1 inline size-3.5" aria-hidden="true" /> Descargar plantilla Excel
            </button>
          }
        >
          <p className="px-4 pt-2.5 text-xs text-muted">
            El Excel lleva 3 columnas: <strong>Nombre y apellido</strong> · <strong>Correo</strong> · <strong>Contraseña</strong>. Opcional: una 4.ª columna <strong>Proyectos</strong> (separados por coma). Cada persona entra con su correo y
            contraseña y se le pedirá cambiarla la primera vez. El Excel no se guarda en ningún lado.
          </p>
          <Table head={['Nombre y apellido', 'Correo', 'Contraseña', 'Proyectos', 'Estado']} cols="minmax(0,1.4fr) minmax(0,1.4fr) 130px minmax(0,1.2fr) 150px">
            {importRows.map((r, i) => (
              <Row key={i} cols="minmax(0,1.4fr) minmax(0,1.4fr) 130px minmax(0,1.2fr) 150px">
                <span className="font-medium">{r.full_name || '—'}</span>
                <span className="truncate text-ink-3">{r.email || '—'}</span>
                <span className="tracking-widest text-muted">{r.password ? '••••••••' : '—'}</span>
                <span className="text-xs text-ink-3">{r.projects.join(', ') || '—'}</span>
                <span className={`chip ${r.status === 'ok' ? 'bg-ok-soft text-ok-ink' : r.status === 'exists' ? 'bg-warn-soft text-warn-ink' : 'bg-danger-soft text-danger-ink'}`} title={r.message}>
                  {r.status === 'ok' ? 'Listo' : r.message}
                </span>
              </Row>
            ))}
          </Table>
          <div className="flex flex-wrap items-center gap-2.5 border-t border-ground px-4 py-3">
            <span className="text-[13px] text-muted">
              Se crearán {importRows.filter((r) => r.status === 'ok').length} usuarios nuevos; {importRows.filter((r) => r.status !== 'ok').length} se omiten.
            </span>
            <div className="ml-auto flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setImportRows(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={bulkCreate.isPending || !importRows.some((r) => r.status === 'ok')} onClick={() => bulkCreate.mutate(importRows)}>
                {bulkCreate.isPending ? 'Creando…' : `Crear ${importRows.filter((r) => r.status === 'ok').length} usuarios`}
              </button>
            </div>
          </div>
        </Box>
      )}

      {pending.length > 0 && (
        <Box tone="warn" title="Esperando aprobación" subtitle={`${pending.length} ${pending.length === 1 ? 'solicitud' : 'solicitudes'}`}>
          <Table head={['Persona', 'Correo', 'Se registró', 'Acción']} cols="minmax(0,1.6fr) minmax(0,1.4fr) 140px 260px">
            {pending.map((p) => (
              <PendingRow key={p.id} person={p} projects={projects ?? []} />
            ))}
          </Table>
        </Box>
      )}

      <Box
        title="Usuarios activos"
        subtitle={`${active.length} personas`}
        actions={
          <label className="flex items-center gap-2 rounded-lg bg-ground px-2.5 py-1.5">
            <span className="sr-only">Buscar usuario</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o correo…" className="w-56 bg-transparent text-[13px] outline-none" />
          </label>
        }
      >
        <Table head={['Persona', 'Proyectos', 'Último acceso', 'Rol', 'Acción']} cols="minmax(0,1.6fr) minmax(0,1.4fr) 130px 140px 170px">
          {active.map((p) => (
            <Row key={p.id} cols="minmax(0,1.6fr) minmax(0,1.4fr) 130px 140px 170px">
              <span className="flex items-center gap-2.5">
                <Avatar person={p} size={30} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.full_name}</span>
                  <span className="block truncate text-xs text-muted">{p.email}</span>
                </span>
              </span>
              <span className="flex flex-wrap gap-1">
                {projectsOf(p.id).map((pr) => (
                  <span key={pr.id} className="chip gap-1 bg-ground text-ink-2">
                    <i className="size-[7px] rounded-[2px]" style={{ background: pr.color }} /> {pr.name}
                  </span>
                ))}
                {projectsOf(p.id).length === 0 && <span className="text-xs text-muted">Ninguno</span>}
              </span>
              <span className="text-[13px] text-muted">{p.last_seen_at ? relativeTime(p.last_seen_at) : 'nunca'}</span>
              <span className={`chip ${p.role === 'admin' ? 'bg-[#EDE9FE] text-[#5B21B6]' : 'bg-ground text-ink-2'}`}>{p.role === 'admin' ? 'Administrador' : 'Miembro'}</span>
              <span className="flex gap-1.5">
                <button type="button" className="btn-secondary px-2.5 py-1.5" onClick={() => setEditing(p)}>
                  Editar
                </button>
                {p.id !== me?.id && (
                  <button
                    type="button"
                    className="btn-secondary px-2.5 py-1.5 text-danger-text"
                    onClick={() => {
                      if (window.confirm(`¿Quitar el acceso de ${p.full_name}?\n\nSe puede recuperar desde la Papelera durante 30 días.`)) softDelete.mutate({ table: 'profiles', id: p.id })
                    }}
                  >
                    Quitar
                  </button>
                )}
              </span>
            </Row>
          ))}
        </Table>
      </Box>

      {creating && <CreateUserModal projects={projects ?? []} onClose={() => setCreating(false)} />}
      {editing && <EditUserModal person={editing} projects={projects ?? []} memberships={projectsOf(editing.id).map((p) => p.id)} onClose={() => setEditing(null)} />}
    </>
  )
}

// ---------------------------------------------------------------------------
function PendingRow({ person, projects }: { person: Profile; projects: Project[] }) {
  const qc = useQueryClient()
  const [role, setRole] = useState('member')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const softDelete = useSoftDelete()
  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('approve_user', { p_user: person.id, p_role: role, p_projects: selected })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.profiles })
      qc.invalidateQueries({ queryKey: ['memberships'] })
    },
    onError: (e) => setError(friendlyError(e)),
  })
  return (
    <Row cols="minmax(0,1.6fr) minmax(0,1.4fr) 140px 260px">
      <span className="flex items-center gap-2.5">
        <Avatar person={person} size={30} />
        <span className="font-medium">{person.full_name}</span>
      </span>
      <span className="truncate text-ink-3">{person.email}</span>
      <span className="text-[13px] text-muted">{relativeTime(person.created_at)}</span>
      <span className="flex flex-col gap-1.5">
        <span className="flex gap-1.5">
          <select className="input py-1.5 text-[13px]" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rol">
            <option value="member">Miembro</option>
            <option value="admin">Administrador</option>
          </select>
          <ProjectMultiSelect projects={projects} value={selected} onChange={setSelected} />
        </span>
        <span className="flex gap-1.5">
          <button type="button" className="btn-primary px-3 py-1.5" disabled={approve.isPending} onClick={() => approve.mutate()}>
            Aprobar
          </button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-danger-text" onClick={() => window.confirm(`¿Rechazar a ${person.full_name}?`) && softDelete.mutate({ table: 'profiles', id: person.id })}>
            Rechazar
          </button>
        </span>
        {error && <span className="text-xs text-danger-text">{error}</span>}
      </span>
    </Row>
  )
}

export function ProjectMultiSelect({ projects, value, onChange }: { projects: Project[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <details className="relative">
      <summary className="input cursor-pointer list-none py-1.5 text-[13px] whitespace-nowrap">{value.length ? `${value.length} proyecto${value.length > 1 ? 's' : ''}` : 'Proyectos…'}</summary>
      <div className="absolute z-20 mt-1 flex w-56 flex-col gap-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.14)]">
        {projects.filter((p) => !p.archived).map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-ground">
            <input type="checkbox" className="accent-accent" checked={value.includes(p.id)} onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((x) => x !== p.id))} />
            <i className="size-2 rounded-[2px]" style={{ background: p.color }} /> {p.name}
          </label>
        ))}
        {projects.length === 0 && <span className="px-2 py-1 text-xs text-muted">No hay proyectos.</span>}
      </div>
    </details>
  )
}

function CreateUserModal({ projects, onClose }: { projects: Project[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('member')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-create-users', {
        body: { users: [{ full_name: fullName.trim(), email: email.trim().toLowerCase(), password, role, project_ids: selected }] },
      })
      if (error) throw error
      const res = data as { created: number; failed: { email: string; error: string }[] }
      if (res.failed.length) throw new Error(res.failed[0].error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.profiles })
      qc.invalidateQueries({ queryKey: ['memberships'] })
      onClose()
    },
    onError: (e) => setError(friendlyError(e)),
  })
  return (
    <Modal title="Crear un usuario" subtitle="La persona entrará con este correo y contraseña; la app le pedirá cambiarla la primera vez." onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          if (!/\s/.test(fullName.trim())) return setError('Escribe nombre y apellido.')
          if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
          create.mutate()
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="label">Nombre y apellido</span>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Correo</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Contraseña temporal</span>
          <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="label">Rol</span>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Miembro</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="label">Proyectos</span>
            <ProjectMultiSelect projects={projects} value={selected} onChange={setSelected} />
          </div>
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({ person, projects, memberships, onClose }: { person: Profile; projects: Project[]; memberships: string[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { profile: me } = useAuth()
  const [role, setRole] = useState(person.role)
  const [selected, setSelected] = useState<string[]>(memberships)
  const [fullName, setFullName] = useState(person.full_name)
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from('profiles').update({ role, full_name: fullName.trim() }).eq('id', person.id)
      if (e1) throw e1
      const toAdd = selected.filter((id) => !memberships.includes(id))
      const toRemove = memberships.filter((id) => !selected.includes(id))
      if (toAdd.length) {
        const { error } = await supabase.from('project_members').insert(toAdd.map((project_id) => ({ project_id, user_id: person.id, role: 'editor' })))
        if (error) throw error
      }
      for (const project_id of toRemove) {
        const { error } = await supabase.from('project_members').delete().eq('project_id', project_id).eq('user_id', person.id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.profiles })
      qc.invalidateQueries({ queryKey: ['memberships'] })
      onClose()
    },
    onError: (e) => setError(friendlyError(e)),
  })
  return (
    <Modal title={`Editar a ${person.full_name}`} subtitle={person.email} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="label">Nombre y apellido</span>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Rol</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Profile['role'])} disabled={person.id === me?.id}>
            <option value="member">Miembro</option>
            <option value="admin">Administrador</option>
          </select>
          {person.id === me?.id && <span className="text-xs text-muted">No puedes quitarte tu propio rol de administrador.</span>}
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="label">Proyectos</span>
          <div className="flex flex-col gap-1 rounded-lg border border-line p-2">
            {projects.filter((p) => !p.archived).map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-ground">
                <input type="checkbox" className="accent-accent" checked={selected.includes(p.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))} />
                <i className="size-2 rounded-[2px]" style={{ background: p.color }} /> {p.name}
              </label>
            ))}
          </div>
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// --- tabla simple -------------------------------------------------------------
export function Table({ head, cols, children }: { head: string[]; cols: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="hidden gap-3.5 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-muted md:grid md:[grid-template-columns:var(--cols)]" style={{ '--cols': cols } as React.CSSProperties}>
        {head.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {children}
    </div>
  )
}
export function Row({ cols, children, className = '' }: { cols: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`grid grid-cols-1 gap-2 border-t border-ground px-4 py-3 text-sm md:items-center md:gap-3.5 md:[grid-template-columns:var(--cols)] ${className}`}
      style={{ '--cols': cols } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
