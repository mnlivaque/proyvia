import { useEffect, useState } from 'react'
import { Archive, Calendar, Check, Copy, Tag, Users, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useLabels, useLists, useMembers, useProfileMap } from '@/data/hooks'
import { Avatar } from '@/components/ui/Avatar'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { useClickOutside } from '@/components/layout/TopBar'
import { daysOverdue, longDate, shortDate } from '@/lib/dates'
import { PRIORITY_STYLE } from '@/lib/colors'
import type { Priority, Project } from '@/types/database'
import { useCreateCard, useSoftDelete, useToggleAssignee, useToggleLabel, useUpdateCard } from '../mutations'
import { useCardDetail, useCardHistory } from './useCardDetail'
import { ChangeDueDateModal } from './ChangeDueDateModal'
import { AttachmentList } from './AttachmentList'
import { Checklist } from './Checklist'
import { Comments } from './Comments'
import { DeliverablePrompt } from './DeliverablePrompt'

interface Props {
  projectId: string
  cardId: string
  project: Project
  canEdit: boolean
  onClose: () => void
}

export function CardModal({ projectId, cardId, project, canEdit, onClose }: Props) {
  const { profile } = useAuth()
  const { data: card, isLoading, error } = useCardDetail(cardId)
  const { data: history } = useCardHistory(cardId)
  const { data: lists } = useLists(projectId)
  const { data: labels } = useLabels(projectId)
  const { data: members } = useMembers(projectId)
  const { map: people } = useProfileMap()

  const update = useUpdateCard(projectId)
  const toggleAssignee = useToggleAssignee(projectId)
  const toggleLabel = useToggleLabel(projectId)
  const softDelete = useSoftDelete(projectId)
  const createCard = useCreateCard(projectId)

  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [desc, setDesc] = useState('')
  const [dateModal, setDateModal] = useState(false)
  const [deliverablePrompt, setDeliverablePrompt] = useState<string | null>(null)
  const [picker, setPicker] = useState<'people' | 'labels' | 'move' | null>(null)
  const pickerRef = useClickOutside<HTMLDivElement>(() => setPicker(null))

  useEffect(() => {
    if (card) {
      setTitle(card.title)
      setDesc(card.description)
    }
  }, [card])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !dateModal && !deliverablePrompt && onClose()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [onClose, dateModal, deliverablePrompt])

  if (isLoading) return <div className="fixed inset-0 z-40 bg-[rgba(17,24,39,.55)]"><PageSpinner label="Abriendo tarea…" /></div>
  if (error || !card) {
    onClose()
    return null
  }

  const list = lists?.find((l) => l.id === card.list_id)
  const overdue = daysOverdue(card.due_date, card.completed_at)
  const assignees = card.card_assignees.map((a) => people.get(a.user_id)).filter(Boolean) as NonNullable<ReturnType<typeof people.get>>[]
  const memberProfiles = (members ?? []).map((m) => people.get(m.user_id)).filter((p): p is NonNullable<typeof p> => !!p && p.approved)
  const myLabels = card.card_labels.map((l) => (labels ?? []).find((x) => x.id === l.label_id)).filter(Boolean) as NonNullable<ReturnType<NonNullable<typeof labels>['find']>>[]
  const refs = card.attachments.filter((a) => a.kind === 'reference')
  const dels = card.attachments.filter((a) => a.kind === 'deliverable')
  const doneList = (lists ?? []).find((l) => l.is_done)
  const prio = PRIORITY_STYLE[card.priority]

  function markDone() {
    if (!doneList) return update.mutate({ cardId, patch: { completed_at: new Date().toISOString() } })
    if (dels.length === 0) return setDeliverablePrompt(doneList.id)
    update.mutate({ cardId, patch: { list_id: doneList.id } })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[rgba(17,24,39,.55)] p-4 pt-10" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="card-title" className="w-full max-w-[980px] rounded-2xl bg-surface shadow-[0_24px_60px_rgba(0,0,0,.35)]">
        {/* Cabecera */}
        <div className="flex items-start gap-3.5 border-b border-ground px-6 pb-3.5 pt-5">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="size-2 rounded-[2px]" style={{ background: project.color }} aria-hidden="true" />
              {project.name} <span>›</span> en la lista <strong className="text-ink-2">{list?.name ?? '…'}</strong>
              {overdue > 0 && <span className="chip ml-2 bg-danger text-white">VENCIDA · hace {overdue} {overdue === 1 ? 'día' : 'días'}</span>}
              {card.completed_at && <span className="chip ml-2 bg-ok-soft text-ok-ink">Terminada</span>}
            </div>
            {editingTitle && canEdit ? (
              <input
                className="input text-xl font-bold"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  setEditingTitle(false)
                  if (title.trim() && title.trim() !== card.title) update.mutate({ cardId, patch: { title: title.trim() } })
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            ) : (
              <h1 id="card-title" className={`text-[22px] font-bold leading-tight ${canEdit ? 'cursor-text rounded hover:bg-ground' : ''}`} onClick={() => canEdit && setEditingTitle(true)}>
                {card.title}
              </h1>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {myLabels.map((l) => (
                <span key={l.id} className="chip px-2.5 py-1" style={{ background: l.color, color: l.text_color }}>
                  {l.name}
                </span>
              ))}
              <span className="chip px-2.5 py-1" style={{ background: prio.bg, color: prio.text }}>
                {prio.label}
              </span>
              {canEdit && (
                <button type="button" className="chip bg-ground px-2.5 py-1 text-ink-3 hover:bg-line" onClick={() => setPicker('labels')}>
                  + etiqueta
                </button>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex size-8.5 items-center justify-center rounded-lg bg-ground text-ink-2 hover:bg-line">
            <X className="size-4.5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap gap-6 px-6 pb-6 pt-4.5">
          {/* Columna principal */}
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5.5">
            <div className="flex flex-wrap gap-7">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Responsables</h3>
                <div className="flex items-center gap-1.5">
                  {assignees.map((p) => (
                    <Avatar key={p.id} person={p} size={28} />
                  ))}
                  {canEdit && (
                    <button type="button" aria-label="Añadir responsable" onClick={() => setPicker('people')} className="flex size-7 items-center justify-center rounded-full bg-ground text-ink-3 hover:bg-line">
                      +
                    </button>
                  )}
                  {assignees.length === 0 && !canEdit && <span className="text-[13px] text-muted">Sin asignar</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Fecha límite</h3>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setDateModal(true)}
                  title={card.due_date ? longDate(card.due_date) : 'Sin fecha'}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold ${overdue > 0 ? 'bg-danger-soft text-danger-ink' : card.due_date ? 'bg-warn-soft text-warn-ink' : 'bg-ground text-ink-3'}`}
                >
                  <Calendar className="size-3.5" aria-hidden="true" /> {card.due_date ? `${longDate(card.due_date)} · ${shortDate(card.due_date)}` : 'Sin fecha'}
                  {canEdit && <span className="ml-1 font-normal opacity-70">· cambiar</span>}
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Prioridad</h3>
                <select
                  className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold"
                  style={{ background: prio.bg, color: prio.text }}
                  value={card.priority}
                  disabled={!canEdit}
                  onChange={(e) => update.mutate({ cardId, patch: { priority: e.target.value as Priority } })}
                  aria-label="Prioridad"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Descripción</h3>
              {editingDesc && canEdit ? (
                <div className="flex flex-col gap-2">
                  <textarea className="input min-h-[120px]" autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        update.mutate({ cardId, patch: { description: desc } })
                        setEditingDesc(false)
                      }}
                    >
                      Guardar
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => { setDesc(card.description); setEditingDesc(false) }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`min-h-[44px] whitespace-pre-wrap rounded-[10px] bg-ground px-3.5 py-3 text-sm leading-relaxed text-ink-2 ${canEdit ? 'cursor-text hover:bg-line/60' : ''}`}
                  onClick={() => canEdit && setEditingDesc(true)}
                >
                  {card.description || <span className="text-muted">{canEdit ? 'Añade una descripción: qué hay que hacer, con qué, para quién…' : 'Sin descripción'}</span>}
                </div>
              )}
            </section>

            <AttachmentList projectId={projectId} cardId={cardId} kind="reference" items={refs} project={project} canEdit={canEdit} />
            <AttachmentList projectId={projectId} cardId={cardId} kind="deliverable" items={dels} project={project} canEdit={canEdit} />
            <Checklist projectId={projectId} cardId={cardId} items={card.checklist_items} canEdit={canEdit} />
            <Comments cardId={cardId} comments={card.comments} activity={history?.activity ?? []} canEdit={canEdit} />
          </div>

          {/* Columna lateral */}
          {canEdit && (
            <div ref={pickerRef} className="relative flex flex-[1_1_200px] flex-col gap-2 md:max-w-[220px]">
              <h3 className="px-0.5 pb-1 text-xs font-bold uppercase tracking-wide text-muted">Añadir a la tarjeta</h3>
              <SideBtn icon={<Users />} onClick={() => setPicker('people')}>Responsables</SideBtn>
              <SideBtn icon={<Tag />} onClick={() => setPicker('labels')}>Etiquetas</SideBtn>
              <SideBtn icon={<Calendar />} onClick={() => setDateModal(true)}>Fecha límite</SideBtn>
              <h3 className="px-0.5 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-muted">Acciones</h3>
              <SideBtn icon={<Archive className="rotate-90" />} onClick={() => setPicker('move')}>Mover a…</SideBtn>
              <SideBtn
                icon={<Copy />}
                onClick={() =>
                  createCard.mutate({ listId: card.list_id, title: `${card.title} (copia)`, dueDate: card.due_date, assignees: card.card_assignees.map((a) => a.user_id) })
                }
              >
                Duplicar
              </SideBtn>
              <SideBtn
                icon={<Archive />}
                danger
                onClick={() => {
                  if (window.confirm(`¿Eliminar la tarea "${card.title}"?\n\nPodrás recuperarla desde la Papelera durante 30 días.`)) {
                    softDelete.mutate({ table: 'cards', id: cardId }, { onSuccess: onClose })
                  }
                }}
              >
                Eliminar
              </SideBtn>
              {!card.completed_at ? (
                <button type="button" className="btn-primary mt-2.5 justify-center" onClick={markDone}>
                  <Check className="size-4" aria-hidden="true" /> Marcar terminada
                </button>
              ) : (
                <button type="button" className="btn-secondary mt-2.5 justify-center" onClick={() => update.mutate({ cardId, patch: { completed_at: null, list_id: (lists ?? []).find((l) => !l.is_done)?.id ?? card.list_id } })}>
                  Reabrir tarea
                </button>
              )}
              <p className="px-0.5 py-1 text-[11px] leading-snug text-muted">Al marcar terminada se pedirá el enlace del entregable si aún no lo tiene.</p>

              {picker === 'people' && (
                <Popover title="Responsables">
                  {memberProfiles.map((p) => {
                    const on = card.card_assignees.some((a) => a.user_id === p.id)
                    return (
                      <button key={p.id} type="button" onClick={() => toggleAssignee.mutate({ cardId, userId: p.id, on: !on })} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-ground ${on ? 'font-semibold' : ''}`}>
                        <Avatar person={p} size={24} /> <span className="flex-1 truncate">{p.full_name}</span>
                        {on && <Check className="size-4 text-accent" aria-hidden="true" />}
                      </button>
                    )
                  })}
                  {profile && !memberProfiles.some((p) => p.id === profile.id) && <p className="px-2 text-xs text-muted">Solo se pueden asignar personas que pertenezcan al proyecto.</p>}
                </Popover>
              )}
              {picker === 'labels' && (
                <Popover title="Etiquetas">
                  {(labels ?? []).map((l) => {
                    const on = card.card_labels.some((x) => x.label_id === l.id)
                    return (
                      <button key={l.id} type="button" onClick={() => toggleLabel.mutate({ cardId, labelId: l.id, on: !on })} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-ground">
                        <span className="chip flex-1 justify-start px-2.5 py-1" style={{ background: l.color, color: l.text_color }}>
                          {l.name}
                        </span>
                        {on && <Check className="size-4 text-accent" aria-hidden="true" />}
                      </button>
                    )
                  })}
                  {(labels ?? []).length === 0 && <p className="px-2 text-xs text-muted">No hay etiquetas. El administrador las crea en Administración › Etiquetas.</p>}
                </Popover>
              )}
              {picker === 'move' && (
                <Popover title="Mover a la lista…">
                  {(lists ?? []).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      disabled={l.id === card.list_id}
                      onClick={() => {
                        setPicker(null)
                        if (l.is_done && dels.length === 0) return setDeliverablePrompt(l.id)
                        update.mutate({ cardId, patch: { list_id: l.id } })
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-ground disabled:opacity-50"
                    >
                      {l.name} {l.is_done && <span className="chip bg-ok-soft text-ok-ink">Terminado</span>}
                    </button>
                  ))}
                </Popover>
              )}
            </div>
          )}
        </div>
      </div>

      {dateModal && (
        <ChangeDueDateModal projectId={projectId} cardId={cardId} cardTitle={card.title} project={project} currentDate={card.due_date} history={history?.dueChanges ?? []} onClose={() => setDateModal(false)} />
      )}
      {deliverablePrompt && (
        <DeliverablePrompt
          projectId={projectId}
          cardId={cardId}
          project={project}
          onDone={() => {
            update.mutate({ cardId, patch: { list_id: deliverablePrompt } })
            setDeliverablePrompt(null)
          }}
          onCancel={() => setDeliverablePrompt(null)}
        />
      )}
    </div>
  )
}

function SideBtn({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium ${danger ? 'bg-ground text-danger-text hover:bg-danger-soft' : 'bg-ground text-ink-2 hover:bg-line'}`}>
      <span className="text-muted [&>svg]:size-[15px]">{icon}</span>
      {children}
    </button>
  )
}

function Popover({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="absolute right-0 top-8 z-10 flex w-[260px] flex-col gap-0.5 rounded-xl border border-line bg-surface p-2 shadow-[0_12px_32px_rgba(0,0,0,.14)]">
      <div className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-muted">{title}</div>
      <div className="max-h-[320px] overflow-y-auto">{children}</div>
    </div>
  )
}
