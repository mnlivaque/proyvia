import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { keys } from '@/data/keys'
import type { ChecklistItem } from '@/types/database'

export function Checklist({ projectId, cardId, items, canEdit }: { projectId: string; cardId: string; items: ChecklistItem[]; canEdit: boolean }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.card(cardId) })
    qc.invalidateQueries({ queryKey: keys.cards(projectId) })
  }

  const add = useMutation({
    mutationFn: async (t: string) => {
      const pos = Math.max(0, ...items.map((i) => i.position)) + 1000
      const { error } = await supabase.from('checklist_items').insert({ card_id: cardId, text: t.trim(), position: pos })
      if (error) throw error
    },
    onSuccess: () => {
      setText('')
      invalidate()
    },
  })
  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from('checklist_items').update({ done }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const done = items.filter((i) => i.done).length
  const pct = items.length ? Math.round((done / items.length) * 100) : 0

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Lista de pasos</h3>
        {items.length > 0 && (
          <span className="text-xs text-muted">
            {done} de {items.length}
          </span>
        )}
      </div>
      {items.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ul className="flex flex-col">
        {items.map((i) => (
          <li key={i.id} className="group flex items-start gap-2.5 py-1 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={i.done} disabled={!canEdit} onChange={(e) => toggle.mutate({ id: i.id, done: e.target.checked })} id={`chk-${i.id}`} />
            <label htmlFor={`chk-${i.id}`} className={`flex-1 ${i.done ? 'text-muted line-through' : ''}`}>
              {i.text}
            </label>
            {canEdit && (
              <button type="button" aria-label="Quitar paso" onClick={() => remove.mutate(i.id)} className="invisible text-muted hover:text-danger group-hover:visible">
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) add.mutate(text)
          }}
        >
          <input className="input py-1.5 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Añadir un paso…" />
          <button type="submit" className="btn-secondary shrink-0" disabled={!text.trim() || add.isPending}>
            Añadir
          </button>
        </form>
      )}
    </section>
  )
}
