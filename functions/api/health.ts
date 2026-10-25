// Cloudflare Pages Function: GET /api/health
// Punto 10 (monitoreo): un endpoint simple para comprobar que el sitio responde
// y que las variables de entorno críticas existen (sin revelar sus valores).

interface Env {
  VITE_SUPABASE_URL?: string
  CF_PAGES_COMMIT_SHA?: string
  CF_PAGES_BRANCH?: string
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const body = {
    status: 'ok',
    service: 'proyvia',
    time: new Date().toISOString(),
    version: env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    branch: env.CF_PAGES_BRANCH ?? 'local',
    checks: {
      supabaseUrlConfigured: Boolean(env.VITE_SUPABASE_URL),
    },
  }
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
