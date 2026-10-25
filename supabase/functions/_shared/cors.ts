// Orígenes permitidos para las Edge Functions (solo la app).
const ALLOWED = ['https://proyvia.livaque.app', 'http://localhost:5173']

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') ?? ''
  const allow = ALLOWED.includes(origin) || /^https:\/\/[\w-]+\.proyvia\.pages\.dev$/.test(origin) ? origin : ALLOWED[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'content-type': 'application/json; charset=utf-8' } })
}
