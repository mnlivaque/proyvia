import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { keys } from '@/data/keys'
import { useMembersOfAll, useProfiles, useProjects, useUpdateProject } from '@/data/adminHooks'
import { Avatar, AvatarStack } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { PROJECT_COLORS } from '@/lib/colors'
import { friendlyError } from '@/lib/errors'
import type { Project } from '@/types/database'
import { useSoftDelete } from '../board/mutations'
import { AdminHeader, Box, ErrorText } from './AdminLayout'
import { Row, Table } from './AdminUsersPage'

export default function AdminProjectsPage() {
  const { data: projects } = useProjects()
  const { data: profiles } = useProfiles()
  const { data: memberships } = useMembersOfAll()
  const update = useUpdateProject()
  const softDelete = useSoftDelete()
  const [editing, setEditing] = useState<Project | null>(null)
  const people = new Map((profiles ?? []).map((p) => [p.id, p]))

  return (
    <>
      <AdminHeader title="Proyectos">Cada proyecto es un tablero. Define su coordinador (recibe los avisos de cambios de fecha) y quiénes pertenecen a él.</AdminHeader>
      <Box title="Proyectos" subtitle={`${projects?.length ?? 0} en total`}>
        <Table head={['Proyecto', 'Coordinador', 'Personas', 'Estado', 'Acción']} cols="minmax(0,1.6fr) minmax(0,1.2fr) 160px 110px 220px">
          {(projects ?? []).map((p) => {
            const members = (memberships ?? []).filter((m) => m.project_id === p.id).map((m) => people.get(m.user_id)).filter(Boolean) as NonNullable<ReturnType<typeof people.get>>[]
            const coord = p.coordinator_id ? people.get(p.coordinator_id) : undefined
            return (
              <Row key={p.id} cols="minmax(0,1.6fr) minmax(0,1.2fr) 160px 110px 220px">
                <span className="flex items-center gap-2.5">
                  <span className="size-3 rounded-[3px]" style={{ background: p.color }} />
                  <span>
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-xs text-muted">{p.description || 'Sin descripción'}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 text-[13px]">{coord ? <><Avatar person={coord} size={24} /> {coord.full_name}</> : <span className="text-warn-text">Sin coordinador</span>}</span>
                <span>
                  <AvatarStack people={members} size={24} max={5} />
                </span>
                <span className={`chip ${p.archived ? 'bg-ground text-muted' : 'bg-ok-soft text-ok-ink'}`}>{p.archived ? 'Archivado' : 'Activo'}</span>
                <span className="flex flex-wrap gap-1.5">
                  <button type="button" className="btn-secondary px-2.5 py-1.5" onClick={() => setEditing(p)}>
                    Editar
                  </button>
                  <button type="button" className="btn-secondary px-2.5 py-1.5" onClick={() => update.mutate({ id: p.id, patch: { archived: !p.archived } })}>
                    {p.archived ? 'Reactivar' : 'Archivar'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-2.5 py-1.5 text-danger-text"
                    onClick={() => {
                      const typed = window.prompt(`Para eliminar el tablero escribe su nombre exacto:\n${p.name}\n\nPodrás recuperarlo desde la Papelera durante 30 días.`)
                      if (typed === p.name) softDelete.mutate({ table: 'projects', id: p.id })
                      else if (typed !== null) window.alert('El nombre no coincide. No se eliminó nada.')
                    }}
                  >
                    Eliminar…
                  </button>
                </span>
              </Row>
            )
          })}
        </Table>
      </Box>
      {editing && <EditProjectModal project={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function EditProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: profiles } = useProfiles()
  const { data: memberships } = useMembersOfAll()
  const update = useUpdateProject()
  const current = (memberships ?? []).filter((m) => m.project_id === project.id)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [color, setColor] = useState(project.color)
  const [coordinator, setCoordinator] = useState(project.coordinator_id ?? '')
  const [members, setMembers] = useState<Record<string, string>>(Object.fromEntries(current.map((m) => [m.user_id, m.role])))
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      await update.mutateAsync({ id: project.id, patch: { name: name.trim(), description: description.trim(), color, coordinator_id: coordinator || null } })
      const ids = Object.keys(members)
      const toAdd = ids.filter((id) => !current.some((m) => m.user_id === id))
      const toRemove = current.filter((m) => !ids.includes(m.user_id))
      const toUpdate = ids.filter((id) => current.some((m) => m.user_id === id && m.role !== members[id]))
      if (toAdd.length) {
        const { error } = await supabase.from('project_members').insert(toAdd.map((user_id) => ({ project_id: project.id, user_id, role: members[user_id] })))
        if (error) throw error
      }
      for (const m of toRemove) {
        const { error } = await supabase.from('project_members').delete().eq('project_id', project.id).eq('user_id', m.user_id)
        if (error) throw error
      }
      for (const id of toUpdate) {
        const { error } = await supabase.from('project_members').update({ role: members[id] }).eq('project_id', project.id).eq('user_id', id)
        if (error) throw error
      }
      // El coordinador siempre es miembro
      if (coordinator && !ids.includes(coordinator)) {
        await supabase.from('project_members').insert({ project_id: project.id, user_id: coordinator, role: 'editor' })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memberships'] })
      qc.invalidateQueries({ queryKey: keys.members(project.id) })
      onClose()
    },
    onError: (e) => setError(friendlyError(e)),
  })

  const approved = (profiles ?? []).filter((p) => p.approved)

  return (
    <Modal title={`Editar ${project.name}`} onClose={onClose} width={640}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label">Nombre</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Coordinador</span>
            <select className="input" value={coordinator} onChange={(e) => setCoordinator(e.target.value)}>
              <option value="">Sin coordinador</option>
              {approved.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="label">Descripción</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="label">Color</span>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className="size-7 rounded-md border-2" style={{ background: c, borderColor: color === c ? '#1F2937' : 'transparent' }} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="label">Personas del proyecto</span>
          <div className="flex max-h-[260px] flex-col gap-0.5 overflow-y-auto rounded-lg border border-line p-1.5">
            {approved.map((p) => {
              const on = p.id in members
              return (
                <div key={p.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-ground">
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={on}
                    onChange={(e) => {
                      const next = { ...members }
                      if (e.target.checked) next[p.id] = 'editor'
                      else delete next[p.id]
                      setMembers(next)
                    }}
                    id={`m-${p.id}`}
                  />
                  <label htmlFor={`m-${p.id}`} className="flex flex-1 items-center gap-2">
                    <Avatar person={p} size={22} /> {p.full_name}
                  </label>
                  {on && (
                    <select className="rounded-md border border-line px-1.5 py-0.5 text-xs" value={members[p.id]} onChange={(e) => setMembers({ ...members, [p.id]: e.target.value })} aria-label={`Permiso de ${p.full_name}`}>
                      <option value="owner">Dueño</option>
                      <option value="editor">Edita</option>
                      <option value="viewer">Solo lee</option>
                    </select>
                  )}
                </div>
              )
            })}
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
