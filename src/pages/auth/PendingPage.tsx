import { useAuth } from '@/auth/AuthProvider'
import { Logo } from '@/components/ui/Logo'
import { Navigate } from 'react-router-dom'

export function PendingPage() {
  const { profile, isApproved, signOut, refreshProfile } = useAuth()
  if (isApproved) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="panel w-full max-w-md p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warn-soft text-warn-text">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        </span>
        <h1 className="text-xl font-bold">Tu cuenta espera aprobación</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Hola, <strong className="text-ink">{profile?.full_name}</strong>. Un administrador debe aprobar tu cuenta y agregarte a tus proyectos. Te avisaremos por correo cuando esté lista.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-secondary" onClick={() => refreshProfile()}>
            Volver a comprobar
          </button>
          <button className="btn-ghost" onClick={() => signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
