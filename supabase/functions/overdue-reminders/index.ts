// Edge Function: overdue-reminders
// Una vez al día (cron 08:00 Lima = 13:00 UTC) crea una notificación "Tarea vencida"
// para el responsable y el coordinador de cada tarea que venció AYER (una sola vez).
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') !== secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('No autorizado', { status: 401 })
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const { data: org } = await supabase.from('org_settings').select('settings').eq('id', 1).single()
  if ((org?.settings as Record<string, unknown> | null)?.notify_overdue === false) return Response.json({ created: 0, skipped: 'desactivado' })

  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, title, project_id, due_date, card_assignees(user_id), projects(name, coordinator_id)')
    .eq('due_date', yesterday)
    .is('completed_at', null)
    .is('deleted_at', null)
  if (error) return new Response(error.message, { status: 500 })

  let created = 0
  for (const c of cards ?? []) {
    const proj = c.projects as unknown as { name: string; coordinator_id: string | null } | null
    const recipients = new Set<string>((c.card_assignees as { user_id: string }[]).map((a) => a.user_id))
    if (proj?.coordinator_id) recipients.add(proj.coordinator_id)
    for (const user_id of recipients) {
      await supabase.from('notifications').insert({
        user_id,
        type: 'overdue',
        title: 'Tarea vencida',
        body: `La tarea "${c.title}" del proyecto ${proj?.name ?? ''} venció el ${c.due_date.split('-').reverse().join('/')} y sigue sin terminar.`,
        project_id: c.project_id,
        card_id: c.id,
      })
      created++
    }
  }
  return Response.json({ created })
})
