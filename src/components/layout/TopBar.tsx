import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useMatch, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, Settings, Shield } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Logo } from '@/components/ui/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { useMarkNotificationsRead, useNotifications, useProjects } from '@/data/hooks'
import { relativeTime } from '@/lib/dates'

export function TopBar() {
  const { profile, isAdmin, signOut } = useAuth()
  const match = useMatch('/p/:projectId/*')
  const projectId = match?.params.projectId
  const { data: projects } = useProjects()
  const current = projects?.find((p) => p.id === projectId)

  return (
    <header className="flex h-14 flex-wrap items-center gap-3 border-b border-line bg-surface px-4 sm:gap-5 sm:px-5">
      <Link to="/" className="shrink-0" aria-label="Inicio">
        <Logo />
      </Link>

      <ProjectPicker currentId={projectId} currentName={current?.name} currentColor={current?.color} />

      <nav className="hidden items-center gap-4 sm:flex" aria-label="Vistas">
        {projectId && (
          <Tab to={`/p/${projectId}`} end>
            Tablero
          </Tab>
        )}
        <Tab to="/mis-tareas">Mis tareas</Tab>
        {isAdmin && (
          <Tab to="/admin">
            <Shield className="size-3.5" aria-hidden="true" /> Administración
          </Tab>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <NotificationsMenu />
        {profile && <UserMenu profile={profile} onSignOut={signOut} isAdmin={isAdmin} />}
      </div>
    </header>
  )
}

function Tab({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex h-14 items-center gap-1.5 border-b-2 px-1 text-sm transition-colors ${
          isActive ? 'border-accent font-semibold text-accent' : 'border-transparent text-ink-3 hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function ProjectPicker({ currentId, currentName, currentColor }: { currentId?: string; currentName?: string; currentColor?: string }) {
  const { data: projects } = useProjects()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Escoger proyecto"
        className="flex items-center gap-2.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-sm text-ink hover:bg-ground"
      >
        <span className="text-xs font-medium text-muted">Proyecto:</span>
        {currentName ? (
          <>
            <span className="size-2.5 rounded-[3px]" style={{ background: currentColor }} aria-hidden="true" />
            <span className="max-w-[220px] truncate font-semibold">{currentName}</span>
          </>
        ) : (
          <span className="font-semibold text-muted">Todos</span>
        )}
        <span className="flex items-center gap-1 border-l border-line pl-2.5 text-xs font-semibold text-accent">
          <span className="hidden md:inline">Escoger otro proyecto</span>
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 w-[300px] overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.14)]"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!currentId}
              onClick={() => {
                setOpen(false)
                navigate('/')
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ground"
            >
              <span className="size-2.5 rounded-[3px] bg-line-2" aria-hidden="true" />
              Todos los proyectos
            </button>
          </li>
          <li className="my-1 h-px bg-line" role="separator" />
          {(projects ?? []).filter((p) => !p.archived).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={p.id === currentId}
                onClick={() => {
                  setOpen(false)
                  navigate(`/p/${p.id}`)
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ground ${p.id === currentId ? 'bg-accent-soft font-semibold text-accent-ink' : ''}`}
              >
                <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden="true" />
                <span className="truncate">{p.name}</span>
              </button>
            </li>
          ))}
          {projects && projects.length === 0 && <li className="px-3 py-2 text-sm text-muted">Aún no perteneces a ningún proyecto.</li>}
        </ul>
      )}
    </div>
  )
}

function NotificationsMenu() {
  const { data: items } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const navigate = useNavigate()
  const unread = (items ?? []).filter((n) => !n.read_at)

  function openMenu() {
    setOpen((o) => !o)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openMenu}
        aria-label={unread.length ? `Notificaciones: ${unread.length} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        className="relative flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-ground"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-surface bg-danger" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_12px_32px_rgba(0,0,0,.14)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-sm font-bold">Notificaciones</h2>
            {unread.length > 0 && (
              <button type="button" className="text-xs font-semibold text-accent" onClick={() => markRead.mutate(unread.map((n) => n.id))}>
                Marcar todas como leídas
              </button>
            )}
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {(items ?? []).length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No tienes notificaciones.</li>}
            {(items ?? []).map((n) => (
              <li key={n.id} className={`border-b border-line last:border-0 ${n.read_at ? '' : 'bg-warn-bg'}`}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-ground"
                  onClick={() => {
                    if (!n.read_at) markRead.mutate([n.id])
                    setOpen(false)
                    if (n.project_id && n.card_id) navigate(`/p/${n.project_id}/c/${n.card_id}`)
                    else if (n.type === 'pending_account') navigate('/admin/usuarios')
                  }}
                >
                  <span className="text-[13px] font-semibold">{n.title}</span>
                  <span className="text-[13px] leading-snug text-ink-3">{n.body}</span>
                  <span className="text-[11px] text-muted">{relativeTime(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function UserMenu({ profile, onSignOut, isAdmin }: { profile: { id: string; full_name: string; color: string; avatar_url: string | null; email: string }; onSignOut: () => void; isAdmin: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Mi cuenta" aria-expanded={open} className="rounded-full">
        <Avatar person={profile} size={32} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[260px] overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.14)]">
          <div className="px-3 py-2">
            <div className="text-sm font-semibold">{profile.full_name}</div>
            <div className="truncate text-xs text-muted">{profile.email}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link to={`/mis-tareas/${profile.id}`} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-ground">
            Mis tareas
          </Link>
          {isAdmin && (
            <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-ground">
              <Settings className="size-4 text-muted" aria-hidden="true" /> Administración
            </Link>
          )}
          <button type="button" onClick={onSignOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-ground">
            <LogOut className="size-4 text-muted" aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') onOutside()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [onOutside])
  return ref
}
