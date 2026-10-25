import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Plus, Search, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useCards, useLabels, useLists, useMembers, useProfileMap, useProject, useRealtimeProject } from '@/data/hooks'
import type { CardRow } from '@/data/types'
import { daysOverdue } from '@/lib/dates'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { Avatar } from '@/components/ui/Avatar'
import { ListColumn, CardPreview } from './ListColumn'
import { PeopleSidebar } from './PeopleSidebar'
import { useCreateList, useMoveCard } from './mutations'
import { CardModal } from './card/CardModal'
import { DeliverablePrompt } from './card/DeliverablePrompt'

export interface BoardFilters {
  people: Set<string>
  unassigned: boolean
  labelId: string | null
  overdueOnly: boolean
  text: string
}

export default function BoardPage() {
  const { projectId, cardId } = useParams()
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const { data: project, isLoading, error } = useProject(projectId)
  const { data: lists } = useLists(projectId)
  const { data: cards } = useCards(projectId)
  const { data: labels } = useLabels(projectId)
  const { data: members } = useMembers(projectId)
  const { map: people } = useProfileMap()
  useRealtimeProject(projectId)

  const moveCard = useMoveCard(projectId!)
  const createList = useCreateList(projectId!)

  const [filters, setFilters] = useState<BoardFilters>({ people: new Set(), unassigned: false, labelId: null, overdueOnly: false, text: '' })
  const [dragging, setDragging] = useState<CardRow | null>(null)
  const [deliverablePrompt, setDeliverablePrompt] = useState<{ cardId: string; listId: string } | null>(null)
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')

  const myRole = members?.find((m) => m.user_id === profile?.id)?.role
  const canEdit = isAdmin || myRole === 'owner' || myRole === 'editor'

  const memberProfiles = useMemo(() => (members ?? []).map((m) => people.get(m.user_id)).filter((p): p is NonNullable<typeof p> => !!p && p.approved), [members, people])

  const filtered = useMemo(() => {
    const t = filters.text.trim().toLowerCase()
    return (cards ?? []).filter((c) => {
      if (filters.people.size > 0 && !c.card_assignees.some((a) => filters.people.has(a.user_id))) return false
      if (filters.unassigned && c.card_assignees.length > 0) return false
      if (filters.labelId && !c.card_labels.some((l) => l.label_id === filters.labelId)) return false
      if (filters.overdueOnly && !(daysOverdue(c.due_date, c.completed_at) > 0)) return false
      if (t && !c.title.toLowerCase().includes(t) && !c.description.toLowerCase().includes(t)) return false
      return true
    })
  }, [cards, filters])

  const activeFilter = filters.people.size > 0 || filters.unassigned || !!filters.labelId || filters.overdueOnly || !!filters.text
  const overdueCount = (cards ?? []).filter((c) => daysOverdue(c.due_date, c.completed_at) > 0).length

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragStart = useCallback((e: DragStartEvent) => setDragging((cards ?? []).find((c) => c.id === e.active.id) ?? null), [cards])

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setDragging(null)
      const card = (cards ?? []).find((c) => c.id === e.active.id)
      const targetList = (lists ?? []).find((l) => l.id === e.over?.id)
      if (!card || !targetList || card.list_id === targetList.id || !canEdit) return
      if (targetList.is_done && (card.deliverable_count ?? 0) === 0) {
        // Al pasar a "Terminado" sin entregable, se pide el enlace antes de mover.
        setDeliverablePrompt({ cardId: card.id, listId: targetList.id })
        return
      }
      moveCard.mutate({ cardId: card.id, listId: targetList.id })
    },
    [cards, lists, canEdit, moveCard],
  )

  if (isLoading) return <PageSpinner />
  if (error || !project) return <Navigate to="/" replace />

  const togglePerson = (id: string, multi: boolean) =>
    setFilters((f) => {
      const next = new Set(multi ? f.people : [])
      if (f.people.has(id) && (multi || f.people.size === 1)) next.delete(id)
      else next.add(id)
      return { ...f, people: next, unassigned: false }
    })

  return (
    <div className="flex min-h-0 flex-1">
      <main className="flex min-w-0 flex-1 flex-col gap-3.5 px-4 pb-5 pt-4 sm:px-5">
        {/* Cabecera del tablero */}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold">{project.name}</h1>
          <span className="text-[13px] text-muted">
            {memberProfiles.length} personas · {cards?.length ?? 0} tareas{overdueCount > 0 && <> · <span className="font-semibold text-danger-text">{overdueCount} vencidas</span></>}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {[...filters.people].map((id) => {
              const p = people.get(id)
              if (!p) return null
              return (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft py-1 pl-1 pr-1.5 text-[13px] font-semibold text-accent-ink">
                  <Avatar person={p} size={20} /> Mostrando: {p.full_name}
                  <button type="button" aria-label={`Quitar filtro de ${p.full_name}`} onClick={() => togglePerson(id, true)} className="px-1 leading-none">
                    ×
                  </button>
                </span>
              )
            })}
            <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5">
              <Search className="size-3.5 text-muted" aria-hidden="true" />
              <input
                value={filters.text}
                onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
                placeholder="Buscar tarea…"
                aria-label="Buscar tarea"
                className="w-36 bg-transparent text-[13px] outline-none placeholder:text-muted"
              />
            </label>
            <select
              aria-label="Filtrar por etiqueta"
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink-2"
              value={filters.labelId ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, labelId: e.target.value || null }))}
            >
              <option value="">Etiqueta: todas</option>
              {(labels ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-pressed={filters.overdueOnly}
              onClick={() => setFilters((f) => ({ ...f, overdueOnly: !f.overdueOnly }))}
              className={`rounded-lg border px-2.5 py-1.5 text-[13px] ${filters.overdueOnly ? 'border-danger bg-danger-soft font-semibold text-danger-ink' : 'border-line bg-surface text-ink-2'}`}
            >
              Vencidas
            </button>
            {activeFilter && (
              <button type="button" className="btn-ghost px-2" onClick={() => setFilters({ people: new Set(), unassigned: false, labelId: null, overdueOnly: false, text: '' })}>
                <X className="size-3.5" aria-hidden="true" /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Columnas */}
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex min-h-0 flex-1 items-start gap-3.5 overflow-x-auto pb-2">
            {(lists ?? []).map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                projectId={project.id}
                cards={filtered.filter((c) => c.list_id === list.id)}
                totalInList={(cards ?? []).filter((c) => c.list_id === list.id).length}
                labels={labels ?? []}
                people={people}
                canEdit={canEdit}
                members={memberProfiles}
                onOpenCard={(id) => navigate(`/p/${project.id}/c/${id}`)}
              />
            ))}

            {canEdit &&
              (addingList ? (
                <form
                  className="flex w-[272px] shrink-0 flex-col gap-2 rounded-xl bg-column p-2.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (newListName.trim().length < 2) return
                    const maxPos = Math.max(0, ...(lists ?? []).map((l) => l.position))
                    createList.mutate({ name: newListName, position: maxPos + 1000 }, { onSuccess: () => setNewListName('') })
                    setAddingList(false)
                  }}
                >
                  <input className="input" autoFocus value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Nombre de la lista" />
                  <div className="flex gap-2">
                    <button className="btn-primary" type="submit">
                      Crear lista
                    </button>
                    <button className="btn-ghost" type="button" onClick={() => setAddingList(false)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setAddingList(true)} className="flex w-[200px] shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-line-2 bg-surface/60 px-3 py-3 text-left text-[13px] text-ink-3 hover:bg-surface">
                  <Plus className="size-4" aria-hidden="true" /> Nueva lista
                </button>
              ))}
          </div>
          <DragOverlay dropAnimation={null}>{dragging ? <CardPreview card={dragging} labels={labels ?? []} people={people} /> : null}</DragOverlay>
        </DndContext>
      </main>

      <PeopleSidebar
        people={memberProfiles}
        cards={cards ?? []}
        selected={filters.people}
        unassigned={filters.unassigned}
        onToggle={togglePerson}
        onAll={() => setFilters((f) => ({ ...f, people: new Set(), unassigned: false }))}
        onUnassigned={() => setFilters((f) => ({ ...f, people: new Set(), unassigned: !f.unassigned }))}
      />

      {cardId && <CardModal projectId={project.id} cardId={cardId} project={project} canEdit={canEdit} onClose={() => navigate(`/p/${project.id}`)} />}

      {deliverablePrompt && (
        <DeliverablePrompt
          projectId={project.id}
          cardId={deliverablePrompt.cardId}
          project={project}
          onDone={() => {
            moveCard.mutate({ cardId: deliverablePrompt.cardId, listId: deliverablePrompt.listId })
            setDeliverablePrompt(null)
          }}
          onCancel={() => setDeliverablePrompt(null)}
        />
      )}
    </div>
  )
}
