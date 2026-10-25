// Edge Function: send-notification-emails
// Envía por correo (Resend) las notificaciones que aún no se han enviado.
// La dispara un cron de Supabase cada 5 minutos (ver docs/DESPLIEGUE.md) o un
// Database Webhook sobre la tabla notifications. Requiere los secretos:
//   RESEND_API_KEY, APP_URL (https://proyvia.livaque.app), CRON_SECRET
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Solo la llama el cron / webhook con el secreto compartido.
  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') !== secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('No autorizado', { status: 401 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const appUrl = Deno.env.get('APP_URL') ?? 'https://proyvia.livaque.app'

  const { data: org } = await supabase.from('org_settings').select('name, settings').eq('id', 1).single()
  const settings = (org?.settings ?? {}) as Record<string, unknown>
  const from = (settings.sender_email as string) || Deno.env.get('SENDER_EMAIL') || 'Proyvia <onboarding@resend.dev>'

  const enabled: Record<string, boolean> = {
    due_date_changed: settings.notify_due_date_change !== false,
    overdue: settings.notify_overdue !== false,
    assigned: settings.notify_assignment !== false,
    pending_account: settings.notify_pending_account !== false,
    approved: true,
  }

  const { data: pending, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, project_id, card_id, created_at')
    .is('email_sent_at', null)
    .order('created_at')
    .limit(100)
  if (error) return new Response(error.message, { status: 500 })
  if (!pending?.length) return Response.json({ sent: 0 })

  const userIds = [...new Set(pending.map((n) => n.user_id))]
  const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', userIds)
  const emailOf = new Map((profiles ?? []).map((p) => [p.id, p]))

  let sent = 0
  for (const n of pending) {
    const to = emailOf.get(n.user_id)
    if (!to?.email || !enabled[n.type]) {
      await supabase.from('notifications').update({ email_sent_at: new Date().toISOString() }).eq('id', n.id)
      continue
    }
    const link = n.project_id && n.card_id ? `${appUrl}/p/${n.project_id}/c/${n.card_id}` : n.type === 'pending_account' ? `${appUrl}/admin/usuarios` : appUrl
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2937">
        <div style="background:#0F766E;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:700">${org?.name ?? 'Proyvia'}</div>
        <div style="border:1px solid #E5E7EB;border-top:0;padding:20px;border-radius:0 0 12px 12px">
          <p style="margin:0 0 6px;font-size:16px;font-weight:700">${escape(n.title)}</p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#374151">Hola, ${escape(to.full_name.split(' ')[0])}. ${escape(n.body)}</p>
          <a href="${link}" style="display:inline-block;background:#0F766E;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px">Abrir en Proyvia</a>
          <p style="margin:20px 0 0;font-size:12px;color:#6B7280">Este aviso es automático. Puedes cambiar qué avisos recibes desde Administración › Ajustes.</p>
        </div>
      </div>`

    if (!resendKey) {
      console.log('[sin RESEND_API_KEY] correo no enviado a', to.email, n.title)
    } else {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [to.email], subject: `${n.title} · ${org?.name ?? 'Proyvia'}`, html }),
      })
      if (!r.ok) {
        console.error('Resend', r.status, await r.text())
        continue // se reintenta en la próxima corrida
      }
    }
    await supabase.from('notifications').update({ email_sent_at: new Date().toISOString() }).eq('id', n.id)
    sent++
  }
  return Response.json({ sent })
})

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
