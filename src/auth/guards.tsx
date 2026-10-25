import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { PageSpinner } from '@/components/ui/PageSpinner'

/** Requiere sesión iniciada. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Requiere cuenta aprobada por un administrador (y contraseña ya cambiada si era obligatorio). */
export function RequireApproved() {
  const { profile, loading, isApproved } = useAuth()
  if (loading) return <PageSpinner />
  if (!profile) return <PageSpinner />
  if (!isApproved) return <Navigate to="/pendiente" replace />
  if (profile.must_change_password) return <Navigate to="/cambiar-contrasena" replace />
  return <Outlet />
}

/** Solo administradores. */
export function RequireAdmin() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <PageSpinner />
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

/** Para /login y /registro: si ya hay sesión, manda adentro. */
export function RedirectIfAuthed() {
  const { user, loading } = useAuth()
  if (loading) return <PageSpinner />
  if (user) return <Navigate to="/" replace />
  return <Outlet />
}
