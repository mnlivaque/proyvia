import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useMyProjects, useProfileMap } from '@/data/hooks'
import { daysOverdue, shortDate } from '@/lib/dates'
import { useClickOutside } from './TopBar'

interface Hit {
  id: string
  title: string
  description: string
  project_id: string
  due_date: string | null
  completed_at: string | null
  lists: { name: string } | null
  card_assignees: { user_id: string }[]
  via?: 'comment'
  snippet?: string
}

/** Quita los caracteres que rompen el filtro `or` de PostgREST. */
function clean(q: string): string {
  return q.replace(/[,()*%\\]/g, ' ').trim()
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** Buscador de tareas en todos los proyectos propios: título, descripción y comentarios. Atajo: tecla "/". */
export function GlobalSearch() {
  const navigate = useNavigate()
  const { data: projects } = useMyProjects()
  const { map: people } = useProfileMap()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const term = clean(useDebounced(q, 250))
  const myIds = (projects ?? []).map((p) => p.id)

  const { data: hits, isFetching } = useQuery({
    queryKey: ['global-search', term, myIds.join(',')],
    enabled: term.length >= 2 && myIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const like = `%${term}%`
      const select = 'id, title, description, project_id, due_date, completed_at, lists(name), card_assignees(user_id)'
      const [byCard, byComment] = await Promise.all([
        supabase
          .from('cards')
          .select(select)
          .in('project_id', myIds)
          .is('deleted_at', null)
          .or(`title.ilike.${like},description.ilike.${like}`)
          .order('completed_at', { ascending: true, nullsFirst: true })
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(20),
        supabase.from('comments').select('card_id, body').ilike('body', like).is('deleted_at', null).limit(20),
      ])
      if (byCard.error) throw byCard.error
      const out = (byCard.data ?? []) as unknown as Hit[]
      const seen = new Set(out.map((h) => h.id))
      const extra = (byComment.data ?? []).filter((c) => !seen.has(c.card_id))
      if (extra.length) {
        const { data } = await supabase
          .from('cards')
          .select(select)
          .in('id', [...new Set(extra.map((c) => c.card_id))])
          .in('project_id', myIds)
          .is('deleted_at', null)
        for (const h of (data ?? []) as unknown as Hit[]) {
          out.push({ ...h, via: 'comment', snippet: extra.find((c) => c.card_id === h.id)?.body })
        }
      }
      return out.slice(0, 25)
    },
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setActive(0), [term])

  const list = hits ?? []
  function go(h: Hit) {
    setOpen(false)
    setQ('')
    navigate(`/p/${h.project_id}/c/${h.id}`)
  }

  return (
    <div ref={ref} className="relative min-w-0 flex-1 sm:max-w-[420px]">
      <label className="flex items-center gap-2 rounded-lg border border-line-2 bg-ground px-3 py-1.5 focus-within:border-accent focus-within:bg-surface focus-within:ring-2 focus-within:ring-accent-soft">
        <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="sr-only">Buscar tareas en todos tus proyectos</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            if (e.key === 'Enter' && list[active]) go(list[active])
            if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
          }}
          placeholder="Buscar tareas en todos tus proyectos…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          role="combobox"
          aria-expanded={open && term.length >= 2}
          aria-controls="global-search-results"
        />
        {q ? (
          <button type="button" aria-label="Borrar búsqueda" onClick={() => { setQ(''); inputRef.current?.focus() }} className="text-muted hover:text-ink">
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : (
          <kbd className="hidden rounded border border-line-2 bg-surface px-1.5 text-[11px] text-muted md:inline">/</kbd>
        )}
      </label>

      {open && term.length >= 2 && (
        <div id="global-search-results" role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.16)] sm:min-w-[460px]">
          {isFetching && list.length === 0 && <p className="px-3 py-3 text-sm text-muted">Buscando…</p>}
          {!isFetching && list.length === 0 && <p className="px-3 py-3 text-sm text-muted">No hay tareas con “{term}”.</p>}
          {list.map((h, i) => {
            const p = projects?.find((x) => x.id === h.project_id)
            const od = daysOverdue(h.due_date, h.completed_at)
            const who = h.card_assignees.map((a) => people.get(a.user_id)?.full_name).filter(Boolean).join(', ')
            return (
              <button
                key={h.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={`flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left ${i === active ? 'bg-accent-soft' : 'hover:bg-ground'}`}
              >
                <span className={`text-sm font-medium ${h.completed_at ? 'text-muted line-through' : ''}`}>
                  <Highlight text={h.title} term={term} />
                </span>
                {h.via === 'comment' && h.snippet && (
                  <span className="flex items-center gap-1 truncate text-xs text-ink-3">
                    <MessageSquare className="size-3 shrink-0" aria-hidden="true" /> <Highlight text={excerpt(h.snippet, term)} term={term} />
                  </span>
                )}
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  {p && (
                    <span className="inline-flex items-center gap-1">
                      <i className="inline-block size-2 rounded-[2px]" style={{ background: p.color }} aria-hidden="true" />
                      {p.name}
                    </span>
                  )}
                  {h.lists?.name && <span>· {h.lists.name}</span>}
                  {h.due_date && <span className={od > 0 ? 'font-semibold text-danger-text' : ''}>· {od > 0 ? `vencida (${shortDate(h.due_date)})` : shortDate(h.due_date)}</span>}
                  {who && <span>· {who}</span>}
                </span>
              </button>
            )
          })}
          {list.length > 0 && <p className="px-3 pb-1 pt-2 text-[11px] text-muted">↑ ↓ para moverte · Enter para abrir · busca en títulos, descripciones y comentarios</p>}
        </div>
      )}
    </div>
  )
}

function excerpt(text: string, term: string): string {
  const i = text.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return text.slice(0, 90)
  const start = Math.max(0, i - 30)
  return (start > 0 ? '…' : '') + text.slice(start, start + 90)
}

function Highlight({ text, term }: { text: string; term: string }) {
  const i = text.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0 || !term) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-warn-soft px-0.5 text-ink">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  )
}
