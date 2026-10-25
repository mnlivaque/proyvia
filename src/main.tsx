import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { queryClient } from './lib/queryClient'
import { initSentry, Sentry } from './lib/sentry'

initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

function ErrorFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div className="panel max-w-md p-8">
        <h1 className="text-lg font-bold">Algo salió mal</h1>
        <p className="mt-2 text-sm text-muted">
          Ya quedó registrado el error. Recarga la página; si sigue pasando, avisa al administrador.
        </p>
        <button className="btn-primary mt-5" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    </div>
  )
}
