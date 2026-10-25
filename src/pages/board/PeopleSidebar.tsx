import { Users } from 'lucide-react'
import type { Profile } from '@/types/database'
import type { CardRow } from '@/data/types'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  people: Profile[]
  cards: CardRow[]
  selected: Set<string>
  unassigned: boolean
  onToggle: (id: string, multi: boolean) => void
  onAll: () => void
  onUnassigned: () => void
}

/** Barra derecha "Tareas por persona": un clic muestra solo las tareas de esa persona. */
export function PeopleSidebar({ people, cards, selected, unassigned, onToggle, onAll, onUnassigned }: Props) {
  const pending = cards.filter((c) => !c.completed_at)
  const countFor = (id: string) => pending.filter((c) => c.card_assignees.some((a) => a.user_id === id)).length
  const noOne = pending.filter((c) => c.card_assignees.length === 0).length
  const sorted = [...people].sort((a, b) => countFor(b.id) - countFor(a.id) || a.full_name.localeCompare(b.full_name))

  return (
    <aside className="hidden w-[236px] shrink-0 flex-col gap-1.5 border-l border-line bg-surface px-3 py-3.5 lg:flex" aria-label="Tareas por persona">
      <div className="flex flex-col gap-0.5 px-1 pb-2">
        <h2 className="text-sm font-bold">Tareas por persona</h2>
        <span className="text-xs text-muted">Toca un nombre para ver sus pendientes</span>
      </div>

      <PersonButton active={selected.size === 0 && !unassigned} onClick={onAll} count={pending.length} icon={<span className="avatar size-8 bg-line text-ink-2"><Users className="size-4" aria-hidden="true" /></span>}>
        <span className="text-sm font-medium">Todos</span>
      </PersonButton>
      <PersonButton active={unassigned} onClick={onUnassigned} count={noOne} icon={<span className="avatar size-8 border border-dashed border-muted bg-ground text-muted">?</span>}>
        <span className="text-sm font-medium">Sin asignar</span>
      </PersonButton>

      <div className="my-1.5 h-px bg-line" role="separator" />

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {sorted.map((p) => (
          <li key={p.id}>
            <PersonButton active={selected.has(p.id)} onClick={(e) => onToggle(p.id, e.ctrlKey || e.metaKey)} count={countFor(p.id)} icon={<Avatar person={p} size={32} />}>
              <span className="flex min-w-0 flex-col">
                <span className={`truncate text-sm ${selected.has(p.id) ? 'font-semibold' : 'font-medium'}`}>{p.full_name}</span>
              </span>
            </PersonButton>
          </li>
        ))}
        {people.length === 0 && <li className="px-2 text-xs text-muted">Este proyecto aún no tiene personas asignadas.</li>}
      </ul>

      <p className="mt-auto px-1 pt-2.5 text-[11px] leading-snug text-muted">Clic en una persona para ver solo sus tareas. Mantén Ctrl para elegir varias.</p>
    </aside>
  )
}

function PersonButton({ active, onClick, count, icon, children }: { active: boolean; onClick: (e: React.MouseEvent) => void; count: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-[10px] border px-2.5 py-2 text-left transition-colors ${active ? 'border-accent-line bg-accent-soft' : 'border-transparent hover:bg-ground'}`}
    >
      {icon}
      {children}
      <span className={`ml-auto rounded-full px-2 py-px text-xs ${active ? 'bg-surface font-semibold text-accent-ink' : 'bg-ground text-muted'}`}>{count}</span>
    </button>
  )
}
