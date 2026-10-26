import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Plus, Search, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useCards, useLabels, useLists, useMembers, useProfileMap, useProject, useRealtimeProject } from '@/data/hooks'
import type { CardRow } from '@/data/types'
import { daysOverdue } from '@/lib/dates'
import { matchesStatus, norm, STATUS_OPTIONS, type StatusFilter } from '@/lib/status'
import { useSignedUrls } from '@/lib/images'
import { StatusChips } from '@/components/ui/StatusChips'
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
  status: StatusFilter
  text: string
}

const EMPTY_FILTERS: BoardFilters = { people: new Set(), unassigned: false, labelId: null, status: 'all', text: '' }

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

  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS)
  const [dragging, setDragging] = useState<CardRow | null>(null)
  const [deliverablePrompt, setDeliverablePrompt] = useState<{ cardId: string; listId: string } | null>(null)
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')

  const myRole = members?.find((m) => m.user_id === profile?.id)?.role
  const canEdit = isAdmin || myRole === 'owner' || myRole === 'editor'

  const memberProfiles = useMemo(() => (members ?? []).map((m) => people.get(m.user_id)).filter((p): p is NonNullable<typeof p> => !!p && p.approved), [members, people])

  // 1) texto + etiqueta  2) + persona  3) + estado. Cada paso alimenta un contador distinto.
  const base = useMemo(() => {
    const words = norm(filters.text.trim()).split(/\s+/).filter(Boolean)
    return (cards ?? []).filter((c) => {
      if (filters.labelId && !c.card_labels.some((l) => l.label_id === filters.labelId)) return false
      if (words.length) {
        // Busca en título, descripción, etiquetas y nombres de los responsables; todas las palabras deben aparecer.
        const hay = norm(
          [
            c.title,
            c.description,
            ...c.card_labels.map((l) => labels?.find((x) => x.id === l.label_id)?.name ?? ''),
            ...c.card_assignees.map((a) => people.get(a.user_id)?.full_name ?? ''),
          ].join(' '),
        )
        if (!words.every((w) => hay.includes(w))) return false
      }
      return true
    })
  }, [cards, filters.labelId, filters.text, labels, people])

  const byPerson = useMemo(
    () =>
      base.filter((c) => {
        if (filters.people.size > 0 && !c.card_assignees.some((a) => filters.people.has(a.user_id))) return false
        if (filters.unassigned && c.card_assignees.length > 0) return false
        return true
      }),
    [base, filters.people, filters.unassigned],
  )

  const filtered = useMemo(() => byPerson.filter((c) => matchesStatus(c, filters.status)), [byPerson, filters.status])

  const statusCounts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const o of STATUS_OPTIONS) out[o.value] = byPerson.filter((c) => matchesStatus(c, o.value)).length
    for (const l of lists ?? []) out[`list:${l.id}`] = byPerson.filter((c) => c.list_id === l.id).length
    return out
  }, [byPerson, lists])

  // La barra de personas cuenta según el estado elegido (p. ej. cuántas vencidas tiene cada una).
  const forSidebar = useMemo(() => base.filter((c) => matchesStatus(c, filters.status)), [base, filters.status])

  const { data: covers } = useSignedUrls((cards ?? []).map((c) => c.cover_path))

  const visibleLists = filters.status.startsWith('list:') ? (lists ?? []).filter((l) => `list:${l.id}` === filters.status) : lists ?? []
  const statusLabel =
    STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? (lists ?? []).find((l) => `list:${l.id}` === filters.status)?.name ?? ''

  const activeFilter = filters.people.size > 0 || filters.unassigned || !!filters.labelId || filters.status !== 'all' || !!filters.text
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
            <label className="flex items-center gap-2 rounded-lg border border-line-2 bg-surface px-2.5 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft">
              <Search className="size-4 text-muted" aria-hidden="true" />
              <input
                value={filters.text}
                onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
                placeholder="Buscar en este tablero: palabra, código, etiqueta, persona…"
                aria-label="Buscar en este tablero"
                className="w-64 bg-transparent text-[13px] outline-none placeholder:text-muted"
              />
              {filters.text && (
                <button type="button" aria-label="Borrar búsqueda" onClick={() => setFilters((f) => ({ ...f, text: '' }))} className="text-muted hover:text-ink">
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
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
            {activeFilter && (
              <button type="button" className="btn-ghost px-2" onClick={() => setFilters(EMPTY_FILTERS)}>
                <X className="size-3.5" aria-hidden="true" /> Limpiar filtros
              </button>
            )}
          </div>
        </div>

        <StatusChips value={filters.status} onChange={(status) => setFilters((f) => ({ ...f, status }))} counts={statusCounts} lists={lists ?? []} />

        {activeFilter && (
          <p className="-mt-1.5 text-[13px] text-ink-3" role="status">
            Mostrando <strong className="text-ink">{filtered.length}</strong> de {cards?.length ?? 0} tareas
            {filters.people.size > 0 && <> de <strong className="text-ink">{[...filters.people].map((id) => people.get(id)?.full_name).filter(Boolean).join(', ')}</strong></>}
            {filters.unassigned && <> <strong className="text-ink">sin asignar</strong></>}
            {filters.status !== 'all' && <> · estado <strong className="text-ink">{statusLabel}</strong></>}
            {filters.text && <> · que contienen “<strong className="text-ink">{filters.text}</strong>”</>}
            {filtered.length === 0 && <> · prueba quitar algún filtro</>}
          </p>
        )}

        {/* Columnas */}
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex min-h-0 flex-1 items-start gap-3.5 overflow-x-auto pb-2">
            {visibleLists.map((list) => (
              <ListColumn
                covers={covers}
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
          <DragOverlay dropAnimation={null}>
            {dragging ? <CardPreview card={dragging} labels={labels ?? []} people={people} coverUrl={dragging.cover_path ? covers?.get(dragging.cover_path) : undefined} /> : null}
          </DragOverlay>
        </DndContext>
      </main>

      <PeopleSidebar
        people={memberProfiles}
        cards={forSidebar}
        statusLabel={filters.status === 'all' ? 'tareas' : statusLabel.toLowerCase()}
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
