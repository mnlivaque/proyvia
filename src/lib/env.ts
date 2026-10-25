import { z } from 'zod'

// Validamos las variables públicas al arrancar: si falta una, la app lo dice claro
// en vez de fallar en silencio más adelante.
const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_GOOGLE_CLIENT_ID: z.string().optional().default(''),
  VITE_GOOGLE_API_KEY: z.string().optional().default(''),
  VITE_GOOGLE_APP_ID: z.string().optional().default(''),
  VITE_TURNSTILE_SITE_KEY: z.string().optional().default(''),
  VITE_SENTRY_DSN: z.string().optional().default(''),
  VITE_APP_VERSION: z.string().optional().default('dev'),
})

const parsed = schema.safeParse(import.meta.env)

if (!parsed.success) {
  const faltan = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
  throw new Error(
    `Faltan o son inválidas estas variables de entorno: ${faltan}. ` +
      'Copia .env.example a .env.local y completa los valores.',
  )
}

export const env = parsed.data
export const isProd = import.meta.env.PROD
