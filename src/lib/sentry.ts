import * as Sentry from '@sentry/react'
import { env, isProd } from './env'

// Monitoreo (punto 10). Solo se activa si hay DSN; en desarrollo no envía nada.
export function initSentry() {
  if (!env.VITE_SENTRY_DSN || !isProd) return
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    release: `proyvia@${env.VITE_APP_VERSION}`,
    environment: 'production',
    tracesSampleRate: 0.2,
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend(event) {
      // Nunca enviamos correos ni tokens en los eventos.
      if (event.user) delete event.user.email
      return event
    },
  })
}

export { Sentry }
