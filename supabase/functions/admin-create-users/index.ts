// Edge Function: admin-create-users
// Crea cuentas (una o varias, desde el Excel) con contraseña temporal.
// Solo la puede llamar un ADMINISTRADOR aprobado; usa la service key del lado
// servidor (nunca llega al navegador). Despliegue: npx supabase functions deploy admin-create-users
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

interface NewUser {
  full_name: string
  email: string
  password: string
  role?: 'admin' | 'member'
  project_ids?: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1) ¿Quién llama? Validamos su JWT y que sea admin aprobado.
  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: me, error: meErr } = await caller.auth.getUser()
  if (meErr || !me.user) return json(req, { error: 'No autenticado' }, 401)
  const { data: isAdmin } = await caller.rpc('is_admin')
  if (!isAdmin) return json(req, { error: 'Solo el administrador puede crear usuarios' }, 403)

  // 2) Validamos la entrada (máximo 200 por llamada).
  let body: { users?: NewUser[] }
  try {
    body = await req.json()
  } catch {
    return json(req, { error: 'Cuerpo inválido' }, 400)
  }
  const users = (body.users ?? []).slice(0, 200)
  if (users.length === 0) return json(req, { error: 'No hay usuarios para crear' }, 400)

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const created: string[] = []
  const failed: { email: string; error: string }[] = []

  for (const u of users) {
    const email = String(u.email ?? '').trim().toLowerCase()
    const full_name = String(u.full_name ?? '').trim()
    const password = String(u.password ?? '')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { failed.push({ email, error: 'Correo inválido' }); continue }
    if (!/\s/.test(full_name)) { failed.push({ email, error: 'Falta nombre y apellido' }); continue }
    if (password.length < 8) { failed.push({ email, error: 'Contraseña menor a 8 caracteres' }); continue }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // la crea el admin: no hace falta confirmar correo
      user_metadata: { full_name, must_change_password: true },
    })
    if (error || !data.user) { failed.push({ email, error: error?.message ?? 'Error desconocido' }); continue }

    const uid = data.user.id
    // El trigger ya creó el perfil; lo dejamos aprobado y con el rol pedido.
    await admin.from('profiles').update({ approved: true, role: u.role === 'admin' ? 'admin' : 'member', must_change_password: true, full_name }).eq('id', uid)
    if (u.project_ids?.length) {
      await admin.from('project_members').upsert(u.project_ids.map((project_id) => ({ project_id, user_id: uid, role: 'editor' })), { onConflict: 'project_id,user_id' })
    }
    await admin.from('activity').insert({ user_id: me.user.id, action: 'user.created_by_admin', data: { user_id: uid, full_name, email, projects: u.project_ids ?? [] } })
    created.push(email)
  }

  return json(req, { created: created.length, failed })
})
