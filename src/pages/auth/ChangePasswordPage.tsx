import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Logo } from '@/components/ui/Logo'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/errors'

/** Obligatorio en el primer ingreso para cuentas creadas por el administrador (Excel). */
export function ChangePasswordPage() {
  const { refreshProfile, profile } = useAuth()
  const navigate = useNavigate()
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (p1.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (p1 !== p2) return setError('Las dos contraseñas no coinciden.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: p1 })
    if (error) {
      setBusy(false)
      return setError(friendlyError(error))
    }
    await supabase.from('profiles').update({ must_change_password: false }).eq('id', profile!.id)
    await refreshProfile()
    setBusy(false)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={onSubmit} className="panel w-full max-w-md p-8">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-xl font-bold">Elige tu propia contraseña</h1>
        <p className="mt-1 text-sm text-muted">
          Tu cuenta la creó un administrador con una contraseña temporal. Por seguridad, cámbiala ahora.
        </p>
        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="label">Nueva contraseña</span>
            <input className="input" type="password" autoComplete="new-password" minLength={8} required value={p1} onChange={(e) => setP1(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">Repite la contraseña</span>
            <input className="input" type="password" autoComplete="new-password" minLength={8} required value={p2} onChange={(e) => setP2(e.target.value)} />
          </label>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}
          <button className="btn-primary py-2.5 text-sm" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar y continuar'}
          </button>
        </div>
      </form>
    </div>
  )
}
