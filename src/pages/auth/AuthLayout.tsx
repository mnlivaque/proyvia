import type { ReactNode } from 'react'
import { Logo } from '@/components/ui/Logo'
import { env } from '@/lib/env'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-wrap">
      <section className="flex flex-[1_1_480px] flex-col gap-10 bg-accent px-8 py-12 text-white sm:px-16 sm:py-14">
        <Logo light size={40} />
        <div className="flex max-w-[460px] flex-col gap-3.5">
          <h1 className="text-[32px] leading-[1.15] font-bold tracking-tight sm:text-4xl">El seguimiento de tus proyectos, en un solo lugar.</h1>
          <p className="text-base leading-relaxed text-accent-soft">
            Tableros por proyecto, tareas por persona y los archivos del equipo enlazados desde Google Drive.
          </p>
        </div>
        <ul className="flex max-w-[460px] flex-col gap-4 text-sm leading-relaxed text-[#E6FFFA]">
          <Feature title="Un clic por persona.">Elige un nombre en la barra lateral y ves solo sus tareas.</Feature>
          <Feature title="Drive integrado.">Cada tarea guarda dónde están los insumos y dónde quedó el entregable.</Feature>
          <Feature title="Acceso controlado.">Cada persona entra con su cuenta y solo ve los proyectos a los que pertenece.</Feature>
        </ul>
        <div className="mt-auto text-xs text-accent-line">proyvia.livaque.app · v{env.VITE_APP_VERSION}</div>
      </section>
      <section className="flex flex-[1_1_480px] items-center justify-center px-6 py-10">
        <div className="panel w-full max-w-[400px] p-8 shadow-[0_10px_30px_rgba(0,0,0,.06)]">{children}</div>
      </section>
    </div>
  )
}

function Feature({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg className="mt-0.5 size-5 shrink-0 text-accent-line" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 13l4 4L19 7" />
      </svg>
      <span>
        <strong>{title}</strong> {children}
      </span>
    </li>
  )
}
