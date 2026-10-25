import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'

export function RecoverPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/cambiar-contrasena`,
    })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    setSent(true)
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Recuperar contraseña</h2>
        {sent ? (
          <p className="text-sm text-muted">
            Si existe una cuenta con <strong className="text-ink">{email}</strong>, te llegará un correo con el enlace para crear una contraseña nueva.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <p className="text-[13px] text-muted">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
            <label className="flex flex-col gap-1.5">
              <span className="label">Correo electrónico</span>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" />
            </label>
            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}
            <button className="btn-primary py-2.5 text-sm" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}
        <Link to="/login" className="text-center text-[13px] font-medium text-accent">
          ← Volver a ingresar
        </Link>
      </div>
    </AuthLayout>
  )
}
