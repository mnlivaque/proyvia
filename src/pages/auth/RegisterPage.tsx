import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { env } from '@/lib/env'
import { friendlyError } from '@/lib/errors'
import { AuthLayout } from './AuthLayout'
import { Divider, Tabs } from './LoginPage'
import { GoogleButton } from './GoogleButton'
import { Turnstile } from './Turnstile'

const schema = z.object({
  fullName: z.string().trim().min(5, 'Escribe tu nombre y apellido completos.').regex(/\s/, 'Escribe nombre y apellido.'),
  email: z.string().trim().email('Escribe un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
})

export function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = schema.safeParse({ fullName, email, password })
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    if (env.VITE_TURNSTILE_SITE_KEY && !captcha) return setError('Completa la verificación "No soy un robot".')

    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        captchaToken: captcha ?? undefined,
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    setDone(true)
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-4 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok-ink">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
          </span>
          <h2 className="text-xl font-bold">Revisa tu correo</h2>
          <p className="text-sm text-muted">
            Te enviamos un enlace a <strong className="text-ink">{email}</strong> para confirmar tu cuenta. Después, un administrador la aprobará y te asignará a tus proyectos.
          </p>
          <a href="/login" className="btn-secondary">
            Volver a ingresar
          </a>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        <Tabs active="registro" />
        <div>
          <h2 className="text-xl font-bold">Crear cuenta</h2>
          <p className="mt-1 text-[13px] text-muted">Usa tu nombre y apellido completos: así te verá el equipo.</p>
        </div>
        {env.VITE_GOOGLE_CLIENT_ID && (
          <>
            <GoogleButton label="Registrarme con Google" />
            <Divider />
          </>
        )}
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5">
            <span className="label">Nombre y apellido</span>
            <input className="input" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej.: Ana Castro" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Correo electrónico</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Contraseña</span>
            <input className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </label>
          {env.VITE_TURNSTILE_SITE_KEY && <Turnstile siteKey={env.VITE_TURNSTILE_SITE_KEY} onToken={setCaptcha} />}
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}
          <button className="btn-primary py-2.5 text-sm" type="submit" disabled={busy}>
            {busy ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="text-xs leading-relaxed text-muted">
          Tu cuenta quedará <strong className="text-ink-2">pendiente de aprobación</strong>. No verás ningún proyecto hasta que un administrador te apruebe.
        </p>
      </div>
    </AuthLayout>
  )
}
