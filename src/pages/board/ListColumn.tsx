import { useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, Calendar, CheckSquare, Clock, MoreHorizontal, Plus } from 'lucide-react'
import type { List, Label, Profile } from '@/types/database'
import type { CardRow } from '@/data/types'
import { compareByDueDate, daysOverdue, isDueSoon, shortDate } from '@/lib/dates'
import { AvatarStack } from '@/components/ui/Avatar'
import { DriveIcon } from '@/components/ui/DriveIcon'
import { useCreateCard, useSoftDelete, useUpdateList } from './mutations'
import { useClickOutside } from '@/components/layout/TopBar'

interface Props {
  list: List
  projectId: string
  cards: CardRow[]
  totalInList: number
  labels: Label[]
  people: Map<string, Profile>
  members: Profile[]
  canEdit: boolean
  onOpenCard: (id: string) => void
}

export function ListColumn({ list, projectId, cards, totalInList, labels, people, canEdit, onOpenCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: list.id })
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [menu, setMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(list.name)
  const createCard = useCreateCard(projectId)
  const updateList = useUpdateList(projectId)
  const softDelete = useSoftDelete(projectId)
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenu(false))

  const sorted = [...cards].sort(compareByDueDate)

  return (
    <section
      ref={setNodeRef}
      className={`flex w-[272px] shrink-0 flex-col gap-2 rounded-xl p-2.5 transition-colors ${isOver ? 'bg-accent-soft' : 'bg-column'}`}
      aria-label={`Lista ${list.name}`}
    >
      <div className="flex items-center justify-between px-1 pb-0.5">
        {renaming ? (
          <form
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) updateList.mutate({ listId: list.id, patch: { name: name.trim() } })
              setRenaming(false)
            }}
          >
            <input className="input py-1 text-sm font-semibold" autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setRenaming(false)} />
          </form>
        ) : (
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            {list.name}
            {list.is_done && <span className="chip bg-ok-soft text-ok-ink">Terminado</span>}
          </h2>
        )}
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-ground px-2 py-px text-xs text-muted" title={cards.length !== totalInList ? `${cards.length} de ${totalInList} con el filtro actual` : undefined}>
            {cards.length !== totalInList ? `${cards.length}/${totalInList}` : totalInList}
          </span>
          {canEdit && (
            <div ref={menuRef} className="relative">
              <button type="button" aria-label="Opciones de la lista" onClick={() => setMenu((m) => !m)} className="flex size-6 items-center justify-center rounded text-muted hover:bg-ground">
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </button>
              {menu && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-line bg-surface p-1.5 text-[13px] shadow-[0_12px_32px_rgba(0,0,0,.14)]">
                  <button type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-ground" onClick={() => { setMenu(false); setRenaming(true) }}>
                    Cambiar nombre
                  </button>
                  <button type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-ground" onClick={() => { setMenu(false); updateList.mutate({ listId: list.id, patch: { is_done: !list.is_done } }) }}>
                    {list.is_done ? 'Dejar de contar como "Terminado"' : 'Contar como "Terminado"'}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-danger-text hover:bg-danger-soft"
                    onClick={() => {
                      setMenu(false)
                      if (window.confirm(`¿Eliminar la lista "${list.name}" y sus ${totalInList} tareas?\n\nPodrás recuperarla desde la Papelera durante 30 días.`)) softDelete.mutate({ table: 'lists', id: list.id })
                    }}
                  >
                    Eliminar lista…
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 px-1 text-[11px] text-muted">
        <Clock className="size-3" aria-hidden="true" /> Ordenadas por fecha límite, de la más antigua a la más reciente
      </div>

      <div className="flex min-h-[40px] flex-col gap-2">
        {sorted.map((c) => (
          <DraggableCard key={c.id} card={c} labels={labels} people={people} canDrag={canEdit} onOpen={() => onOpenCard(c.id)} />
        ))}
      </div>

      {canEdit &&
        (adding ? (
          <form
            className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface p-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (title.trim().length < 2) return
              createCard.mutate({ listId: list.id, title, dueDate: due || null }, { onSuccess: () => { setTitle(''); setDue('') } })
            }}
          >
            <textarea
              className="input min-h-[60px] resize-none py-2 text-sm"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la tarea"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <label className="flex items-center gap-2 text-xs text-muted">
              <Calendar className="size-3.5" aria-hidden="true" /> Fecha límite
              <input type="date" className="input w-auto py-1 text-xs" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button className="btn-primary" type="submit" disabled={createCard.isPending}>
                Añadir
              </button>
              <button className="btn-ghost" type="button" onClick={() => setAdding(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg px-1.5 py-2 text-left text-[13px] text-ink-3 hover:bg-ground">
            <Plus className="size-4" aria-hidden="true" /> Añadir tarea
          </button>
        ))}
    </section>
  )
}

function DraggableCard({ card, labels, people, canDrag, onOpen }: { card: CardRow; labels: Label[]; people: Map<string, Profile>; canDrag: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id, disabled: !canDrag })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <CardPreview card={card} labels={labels} people={people} />
    </div>
  )
}

export function CardPreview({ card, labels, people }: { card: CardRow; labels: Label[]; people: Map<string, Profile> }) {
  const overdue = daysOverdue(card.due_date, card.completed_at)
  const soon = isDueSoon(card.due_date, card.completed_at)
  const myLabels = card.card_labels.map((l) => labels.find((x) => x.id === l.label_id)).filter(Boolean) as Label[]
  const assignees = card.card_assignees.map((a) => people.get(a.user_id)).filter(Boolean) as Profile[]

  return (
    <article className={`card ${overdue > 0 ? 'border-2 border-danger shadow-[0_0_0_3px_#FEE2E2]' : ''} ${card.completed_at ? 'opacity-80' : ''}`}>
      {overdue > 0 && (
        <div className="-mx-1 -mt-1 flex items-center gap-1.5 rounded-md bg-danger px-2 py-1 text-xs font-bold text-white">
          <AlertTriangle className="size-3.5" aria-hidden="true" /> VENCIDA · hace {overdue} {overdue === 1 ? 'día' : 'días'}
        </div>
      )}
      {myLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {myLabels.map((l) => (
            <span key={l.id} className="chip" style={{ background: l.color, color: l.text_color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}
      <div className={`text-sm font-medium leading-snug ${card.completed_at ? 'text-ink-3' : ''}`}>{card.title}</div>
      {card.completed_at && (card.deliverable_count ?? 0) > 0 && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-ok-soft px-2 py-1 text-xs font-semibold text-ok-ink">
          <DriveIcon className="size-3.5" /> Entregable en Drive
        </span>
      )}
      <div className="flex items-center gap-2.5 text-xs text-ink-3">
        {card.due_date && (
          <span className={`inline-flex items-center gap-1 ${overdue > 0 ? 'font-semibold text-danger-text' : soon ? 'font-semibold text-warn-text' : ''}`}>
            <Calendar className="size-3.5" aria-hidden="true" /> {shortDate(card.due_date)}
          </span>
        )}
        {(card.attachments_count ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1" title={`${card.attachments_count} adjuntos`}>
            <DriveIcon className="size-3.5" /> {card.attachments_count}
          </span>
        )}
        {(card.checklist_total ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="size-3.5" aria-hidden="true" /> {card.checklist_done}/{card.checklist_total}
          </span>
        )}
        {assignees.length > 0 && (
          <span className="ml-auto">
            <AvatarStack people={assignees} size={26} max={3} />
          </span>
        )}
      </div>
    </article>
  )
}
