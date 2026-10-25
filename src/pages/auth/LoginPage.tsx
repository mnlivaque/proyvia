import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { env } from '@/lib/env'
import { friendlyError } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'
import { GoogleButton } from './GoogleButton'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    navigate(location.state?.from ?? '/', { replace: true })
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        <Tabs active="login" />
        <div>
          <h2 className="text-xl font-bold">Bienvenido de vuelta</h2>
          <p className="mt-1 text-[13px] text-muted">Ingresa con tu correo o con tu cuenta de Google.</p>
        </div>
        {env.VITE_GOOGLE_CLIENT_ID && (
          <>
            <GoogleButton />
            <Divider />
          </>
        )}
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5">
            <span className="label">Correo electrónico</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Contraseña</span>
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
          <div className="flex items-center justify-between text-[13px]">
            <span />
            <Link to="/recuperar" className="font-medium text-accent hover:text-accent-dark">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}
          <button className="btn-primary py-2.5 text-sm" type="submit" disabled={busy}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <div className="rounded-lg border border-line bg-ground px-3 py-2.5 text-xs leading-relaxed text-muted">
          <strong className="text-ink-2">¿Nuevo en el equipo?</strong> Crea tu cuenta; un administrador la aprobará y te asignará a tus proyectos antes de que puedas entrar.
        </div>
      </div>
    </AuthLayout>
  )
}

export function Tabs({ active }: { active: 'login' | 'registro' }) {
  const base = 'flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors'
  return (
    <div className="flex rounded-[10px] bg-ground p-1">
      <Link to="/login" className={`${base} ${active === 'login' ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>
        Ingresar
      </Link>
      <Link to="/registro" className={`${base} ${active === 'registro' ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>
        Crear cuenta
      </Link>
    </div>
  )
}

export function Divider({ text = 'o con tu correo' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-muted">
      <span className="h-px flex-1 bg-line" />
      {text}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}
