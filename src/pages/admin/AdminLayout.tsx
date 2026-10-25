import { NavLink, Outlet } from 'react-router-dom'
import { Activity, FolderKanban, Settings, Tag, Users } from 'lucide-react'
import { DriveIcon } from '@/components/ui/DriveIcon'
import { useProfiles } from '@/data/hooks'

export default function AdminLayout() {
  const { data: profiles } = useProfiles()
  const pending = (profiles ?? []).filter((p) => !p.approved).length

  const item = 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-ground [&>svg]:size-4 [&>svg]:text-muted'
  const active = 'bg-accent-soft font-semibold text-accent-ink hover:bg-accent-soft [&>svg]:text-accent'

  return (
    <div className="flex flex-1 flex-wrap">
      <nav className="flex w-full shrink-0 flex-col gap-1 border-b border-line bg-surface px-3 py-4 md:w-[230px] md:border-b-0 md:border-r" aria-label="Administración">
        <NavLink to="usuarios" className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
          <Users /> Usuarios
          {pending > 0 && <span className="ml-auto rounded-full bg-danger px-1.5 py-px text-[11px] font-semibold text-white">{pending}</span>}
        </NavLink>
        <NavLink to="proyectos" className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
          <FolderKanban /> Proyectos
        </NavLink>
        <NavLink to="etiquetas" className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
          <Tag /> Etiquetas
        </NavLink>
        <NavLink to="drive" className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
          <DriveIcon /> Carpetas de Drive por proyecto
        </NavLink>
        <NavLink to="actividad" className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
          <Activity /> Actividad y registro
        </NavLink>
        <NavLink to="ajustes" className={({ isActive }) => `${item} ${isActive ? active : ''}`}>
          <Settings /> Ajustes
        </NavLink>
      </nav>
      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 px-4 py-6 sm:px-7">
        <Outlet />
      </main>
    </div>
  )
}

export function AdminHeader({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3.5">
      <div>
        <h1 className="text-[22px] font-bold">{title}</h1>
        {children && <p className="mt-1 text-[13px] text-muted">{children}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Box({ title, subtitle, actions, children, tone }: { title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; tone?: 'warn' | 'accent' }) {
  const border = tone === 'warn' ? 'border-[#FDE68A]' : tone === 'accent' ? 'border-accent-line' : 'border-line'
  const head = tone === 'warn' ? 'bg-warn-bg border-[#FDE68A]' : tone === 'accent' ? 'bg-[#F0FDFA] border-accent-line' : 'border-ground'
  return (
    <section className={`panel overflow-hidden ${border}`}>
      {title && (
        <div className={`flex flex-wrap items-center gap-2.5 border-b px-4 py-3 ${head}`}>
          <h2 className={`text-sm font-bold ${tone === 'warn' ? 'text-warn-ink' : tone === 'accent' ? 'text-accent-ink' : ''}`}>{title}</h2>
          {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="mx-4 my-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">
      {error}
    </p>
  )
}
