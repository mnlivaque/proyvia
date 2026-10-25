-- Proyvia · 0004 · Realtime, vistas y purga programada

-- Realtime: el tablero se actualiza en vivo cuando otra persona cambia algo.
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.card_assignees;
alter publication supabase_realtime add table public.card_labels;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.attachments;
alter publication supabase_realtime add table public.checklist_items;
alter publication supabase_realtime add table public.notifications;

-- Tareas vencidas (no terminadas, con fecha pasada, no eliminadas)
create or replace view public.overdue_cards
with (security_invoker = true) as
  select c.*, (current_date - c.due_date) as days_overdue
  from public.cards c
  where c.deleted_at is null and c.completed_at is null
    and c.due_date is not null and c.due_date < current_date;

-- Papelera: todo lo eliminado, con días restantes
create or replace view public.trash_items
with (security_invoker = true) as
  select 'projects'::text as kind, p.id, p.name as title, p.id as project_id, p.deleted_at, p.deleted_by,
         (select coalesce((settings->>'trash_retention_days')::int, 30) from public.org_settings where id = 1)
           - (current_date - p.deleted_at::date) as days_left
    from public.projects p where p.deleted_at is not null
  union all
  select 'lists', l.id, l.name, l.project_id, l.deleted_at, l.deleted_by,
         (select coalesce((settings->>'trash_retention_days')::int, 30) from public.org_settings where id = 1)
           - (current_date - l.deleted_at::date)
    from public.lists l where l.deleted_at is not null
  union all
  select 'cards', c.id, c.title, c.project_id, c.deleted_at, c.deleted_by,
         (select coalesce((settings->>'trash_retention_days')::int, 30) from public.org_settings where id = 1)
           - (current_date - c.deleted_at::date)
    from public.cards c where c.deleted_at is not null
  union all
  select 'labels', b.id, b.name, b.project_id, b.deleted_at, b.deleted_by,
         (select coalesce((settings->>'trash_retention_days')::int, 30) from public.org_settings where id = 1)
           - (current_date - b.deleted_at::date)
    from public.labels b where b.deleted_at is not null
  union all
  select 'profiles', u.id, u.full_name, null::uuid, u.deleted_at, u.deleted_by,
         (select coalesce((settings->>'trash_retention_days')::int, 30) from public.org_settings where id = 1)
           - (current_date - u.deleted_at::date)
    from public.profiles u where u.deleted_at is not null;

-- Purga diaria de la papelera (03:00 hora de Lima = 08:00 UTC). Requiere pg_cron
-- (Supabase → Database → Extensions → pg_cron). Si no está, este bloque no falla.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('proyvia_purge_trash', '0 8 * * *', $cron$ select public.purge_trash(); $cron$);
  end if;
exception when others then
  raise notice 'pg_cron no disponible; programa purge_trash() manualmente.';
end $$;
