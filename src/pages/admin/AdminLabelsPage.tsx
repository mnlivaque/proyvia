import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useLabels } from '@/data/hooks'
import { useProjects } from '@/data/adminHooks'
import { LABEL_COLORS } from '@/lib/colors'
import { friendlyError } from '@/lib/errors'
import type { Label } from '@/types/database'
import { useSoftDelete } from '../board/mutations'
import { AdminHeader, Box, ErrorText } from './AdminLayout'
import { Row, Table } from './AdminUsersPage'

export default function AdminLabelsPage() {
  const qc = useQueryClient()
  const { data: labels } = useLabels()
  const { data: projects } = useProjects()
  const { data: usage } = useQuery({
    queryKey: ['label_usage'],
    queryFn: async () => {
      const { data, error } = await supabase.from('card_labels').select('label_id')
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data as { label_id: string }[]) m.set(r.label_id, (m.get(r.label_id) ?? 0) + 1)
      return m
    },
  })
  const softDelete = useSoftDelete()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(LABEL_COLORS[4])
  const [scope, setScope] = useState('')
  const [editing, setEditing] = useState<Label | null>(null)
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('labels').insert({ name: name.trim(), description: description.trim(), color: color.bg, text_color: color.text, project_id: scope || null })
      if (error) throw error
    },
    onSuccess: () => {
      setName('')
      setDescription('')
      qc.invalidateQueries({ queryKey: ['labels'] })
    },
    onError: (e) => setError(friendlyError(e)),
  })
  const save = useMutation({
    mutationFn: async (l: Label) => {
      const { error } = await supabase.from('labels').update({ name: l.name.trim(), description: l.description.trim(), color: l.color, text_color: l.text_color, project_id: l.project_id }).eq('id', l.id)
      if (error) throw error
    },
    onSuccess: () => {
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['labels'] })
    },
    onError: (e) => setError(friendlyError(e)),
  })

  const projName = (id: string | null) => (id ? projects?.find((p) => p.id === id)?.name ?? '—' : 'Todos')

  return (
    <>
      <AdminHeader title="Etiquetas">Las etiquetas sirven para clasificar tareas (tipo de trabajo, prioridad). Pueden ser de todos los proyectos o de uno solo.</AdminHeader>

      <Box title="Nueva etiqueta">
        <form
          className="flex flex-wrap items-end gap-3.5 px-4 py-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            if (name.trim().length < 2) return setError('Escribe un nombre.')
            create.mutate()
          }}
        >
          <label className="flex flex-[1_1_200px] flex-col gap-1.5">
            <span className="label">Nombre</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Informe" />
          </label>
          <label className="flex flex-[1_1_240px] flex-col gap-1.5">
            <span className="label">Para qué se usa</span>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="label">Color</span>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <label className="flex flex-[1_1_180px] flex-col gap-1.5">
            <span className="label">Alcance</span>
            <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="">Todos los proyectos</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="label">Vista previa</span>
            <span className="chip px-3 py-1.5" style={{ background: color.bg, color: color.text }}>
              {name || 'Etiqueta'}
            </span>
          </div>
          <button type="submit" className="btn-primary py-2.5" disabled={create.isPending}>
            Crear etiqueta
          </button>
        </form>
        <ErrorText error={error} />
      </Box>

      <Box title="Etiquetas existentes" subtitle={`${labels?.length ?? 0} etiquetas`}>
        <Table head={['Etiqueta', 'Para qué se usa', 'Alcance', 'Tareas', 'Acción']} cols="minmax(0,1.4fr) minmax(0,2fr) 140px 80px 160px">
          {(labels ?? []).map((l) =>
            editing?.id === l.id ? (
              <Row key={l.id} cols="minmax(0,1.4fr) minmax(0,2fr) 140px 80px 160px" className="bg-ground">
                <input className="input py-1.5" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <input className="input py-1.5" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                <select className="input py-1.5 text-xs" value={editing.project_id ?? ''} onChange={(e) => setEditing({ ...editing, project_id: e.target.value || null })}>
                  <option value="">Todos</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ColorPicker value={{ bg: editing.color, text: editing.text_color, name: '' }} onChange={(c) => setEditing({ ...editing, color: c.bg, text_color: c.text })} small />
                <span className="flex gap-1.5">
                  <button type="button" className="btn-primary px-2.5 py-1.5" onClick={() => save.mutate(editing)}>
                    Guardar
                  </button>
                  <button type="button" className="btn-ghost px-2.5 py-1.5" onClick={() => setEditing(null)}>
                    Cancelar
                  </button>
                </span>
              </Row>
            ) : (
              <Row key={l.id} cols="minmax(0,1.4fr) minmax(0,2fr) 140px 80px 160px">
                <span>
                  <span className="chip px-2.5 py-1 text-xs" style={{ background: l.color, color: l.text_color }}>
                    {l.name}
                  </span>
                </span>
                <span className="text-ink-3">{l.description || '—'}</span>
                <span className="chip bg-ground text-ink-2">{projName(l.project_id)}</span>
                <span>{usage?.get(l.id) ?? 0}</span>
                <span className="flex gap-1.5">
                  <button type="button" className="btn-secondary px-2.5 py-1.5" onClick={() => setEditing(l)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-2.5 py-1.5 text-danger-text"
                    onClick={() => {
                      const n = usage?.get(l.id) ?? 0
                      if (window.confirm(`¿Eliminar la etiqueta "${l.name}"?${n ? `\n\nSe quitará de ${n} tareas.` : ''}\n\nSe puede recuperar desde la Papelera durante 30 días.`)) softDelete.mutate({ table: 'labels', id: l.id })
                    }}
                  >
                    Eliminar
                  </button>
                </span>
              </Row>
            ),
          )}
        </Table>
        <p className="border-t border-ground px-4 py-2.5 text-xs text-muted">Eliminar una etiqueta la quita de todas sus tareas; la app pide confirmación y muestra cuántas tareas se afectan.</p>
      </Box>
    </>
  )
}

function ColorPicker({ value, onChange, small }: { value: { bg: string; text: string; name?: string }; onChange: (c: (typeof LABEL_COLORS)[number]) => void; small?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c.bg}
          type="button"
          aria-label={c.name}
          aria-pressed={value.bg === c.bg}
          onClick={() => onChange(c)}
          className={`${small ? 'size-5' : 'size-6'} rounded-md border-2`}
          style={{ background: c.bg, borderColor: value.bg === c.bg ? '#1F2937' : 'transparent' }}
        />
      ))}
    </div>
  )
}
