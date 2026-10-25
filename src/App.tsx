import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RedirectIfAuthed, RequireAdmin, RequireApproved, RequireAuth } from './auth/guards'
import { PageSpinner } from './components/ui/PageSpinner'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { PendingPage } from './pages/auth/PendingPage'
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage'
import { RecoverPage } from './pages/auth/RecoverPage'

// Las pantallas internas se cargan bajo demanda (chunks más pequeños → carga inicial rápida).
const AppShell = lazy(() => import('./pages/AppShell'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const BoardPage = lazy(() => import('./pages/board/BoardPage'))
const MyTasksPage = lazy(() => import('./pages/MyTasksPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminProjectsPage = lazy(() => import('./pages/admin/AdminProjectsPage'))
const AdminLabelsPage = lazy(() => import('./pages/admin/AdminLabelsPage'))
const AdminDrivePage = lazy(() => import('./pages/admin/AdminDrivePage'))
const AdminActivityPage = lazy(() => import('./pages/admin/AdminActivityPage'))
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'))

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/recuperar" element={<RecoverPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/pendiente" element={<PendingPage />} />
          <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />

          <Route element={<RequireApproved />}>
            <Route element={<AppShell />}>
              <Route index element={<ProjectsPage />} />
              <Route path="/p/:projectId" element={<BoardPage />} />
              <Route path="/p/:projectId/c/:cardId" element={<BoardPage />} />
              <Route path="/mis-tareas" element={<MyTasksPage />} />
              <Route path="/mis-tareas/:userId" element={<MyTasksPage />} />

              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="usuarios" replace />} />
                  <Route path="usuarios" element={<AdminUsersPage />} />
                  <Route path="proyectos" element={<AdminProjectsPage />} />
                  <Route path="etiquetas" element={<AdminLabelsPage />} />
                  <Route path="drive" element={<AdminDrivePage />} />
                  <Route path="actividad" element={<AdminActivityPage />} />
                  <Route path="ajustes" element={<AdminSettingsPage />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
