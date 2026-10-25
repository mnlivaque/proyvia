-- Proyvia · 0002 · Funciones auxiliares y triggers

-- ---------------------------------------------------------------------------
-- Funciones de permisos (las usa RLS). SECURITY DEFINER para no caer en
-- recursión de políticas; STABLE para que Postgres las cachee por consulta.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and approved and deleted_at is null
  );
$$;

create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approved and deleted_at is null
  );
$$;

create or replace function public.is_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = p_project and pm.user_id = auth.uid()
      and p.approved and p.deleted_at is null
  );
$$;

create or replace function public.can_edit(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.project_members pm
    join public.profiles p on p.id = pm.user_id
    where pm.project_id = p_project and pm.user_id = auth.uid()
      and pm.role in ('owner', 'editor') and p.approved and p.deleted_at is null
  );
$$;

create or replace function public.is_coordinator(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects where id = p_project and coordinator_id = auth.uid()
  );
$$;

create or replace function public.card_project(p_card uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select project_id from public.cards where id = p_card;
$$;

-- ---------------------------------------------------------------------------
-- Perfil automático al registrarse. El PRIMER usuario queda admin y aprobado.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n_users int;
  palette text[] := array['#7C3AED','#0891B2','#DB2777','#EA580C','#65A30D','#4F46E5','#0D9488','#B45309','#9333EA','#2563EB'];
begin
  select count(*) into n_users from public.profiles;
  insert into public.profiles (id, full_name, email, avatar_url, color, role, approved, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'avatar_url',
    palette[1 + (n_users % array_length(palette, 1))],
    case when n_users = 0 then 'admin' else 'member' end,
    n_users = 0,
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantener el correo del perfil sincronizado si cambia en auth
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','projects','lists','cards','comments','org_settings']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Registro de actividad
-- ---------------------------------------------------------------------------
create or replace function public.log_activity(
  p_project uuid, p_card uuid, p_action text, p_data jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = public as $$
  insert into public.activity (project_id, card_id, user_id, action, data)
  values (p_project, p_card, auth.uid(), p_action, coalesce(p_data, '{}'::jsonb));
$$;

create or replace function public.cards_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_list text; new_list text;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.project_id, new.id, 'card.created', jsonb_build_object('title', new.title));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.deleted_at is not null and old.deleted_at is null then
      perform public.log_activity(new.project_id, new.id, 'card.deleted', jsonb_build_object('title', new.title));
    elsif new.deleted_at is null and old.deleted_at is not null then
      perform public.log_activity(new.project_id, new.id, 'card.restored', jsonb_build_object('title', new.title));
    end if;

    if new.list_id <> old.list_id then
      select name into old_list from public.lists where id = old.list_id;
      select name into new_list from public.lists where id = new.list_id;
      perform public.log_activity(new.project_id, new.id, 'card.moved',
        jsonb_build_object('title', new.title, 'from', old_list, 'to', new_list));
    end if;

    if new.completed_at is not null and old.completed_at is null then
      perform public.log_activity(new.project_id, new.id, 'card.completed', jsonb_build_object('title', new.title));
    elsif new.completed_at is null and old.completed_at is not null then
      perform public.log_activity(new.project_id, new.id, 'card.reopened', jsonb_build_object('title', new.title));
    end if;

    if new.title <> old.title then
      perform public.log_activity(new.project_id, new.id, 'card.renamed', jsonb_build_object('from', old.title, 'to', new.title));
    end if;
    return new;
  end if;
  return null;
end;
$$;
drop trigger if exists cards_activity on public.cards;
create trigger cards_activity after insert or update on public.cards
  for each row execute function public.cards_activity();

-- Al mover a una lista "Terminado" se marca completada; al salir, se reabre.
create or replace function public.cards_sync_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  done boolean;
begin
  select is_done into done from public.lists where id = new.list_id;
  if coalesce(done, false) and new.completed_at is null then
    new.completed_at = now();
  elsif not coalesce(done, false) and new.completed_at is not null and (tg_op = 'INSERT' or new.list_id <> old.list_id) then
    new.completed_at = null;
  end if;
  return new;
end;
$$;
drop trigger if exists cards_sync_completed on public.cards;
create trigger cards_sync_completed before insert or update of list_id on public.cards
  for each row execute function public.cards_sync_completed();

-- ---------------------------------------------------------------------------
-- Cambio de fecha límite: se hace SOLO por esta función (exige justificación),
-- registra el cambio y crea notificaciones para admin + coordinador.
-- ---------------------------------------------------------------------------
create or replace function public.change_due_date(p_card uuid, p_new_date date, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.cards%rowtype;
  min_chars int;
  actor text;
  proj public.projects%rowtype;
  recipient uuid;
  msg text;
begin
  select * into c from public.cards where id = p_card and deleted_at is null;
  if not found then raise exception 'La tarea no existe'; end if;
  if not public.can_edit(c.project_id) then raise exception 'No tienes permiso para editar esta tarea'; end if;

  select coalesce((settings ->> 'due_date_reason_min_chars')::int, 20) into min_chars from public.org_settings where id = 1;
  if char_length(coalesce(p_reason, '')) < min_chars then
    raise exception 'La justificación debe tener al menos % caracteres', min_chars;
  end if;
  if c.due_date is not distinct from p_new_date then
    raise exception 'La nueva fecha es igual a la actual';
  end if;

  update public.cards set due_date = p_new_date where id = p_card;
  insert into public.due_date_changes (card_id, user_id, old_date, new_date, reason)
  values (p_card, auth.uid(), c.due_date, p_new_date, p_reason);

  select full_name into actor from public.profiles where id = auth.uid();
  select * into proj from public.projects where id = c.project_id;

  perform public.log_activity(c.project_id, c.id, 'card.due_date_changed',
    jsonb_build_object('title', c.title, 'from', c.due_date, 'to', p_new_date, 'reason', p_reason));

  msg := format('%s cambió la fecha de vencimiento de "%s" del %s al %s por el siguiente motivo: %s',
                actor, c.title,
                coalesce(to_char(c.due_date, 'DD/MM/YYYY'), 'sin fecha'),
                coalesce(to_char(p_new_date, 'DD/MM/YYYY'), 'sin fecha'),
                p_reason);

  -- Destinatarios: todos los administradores + el coordinador del proyecto (sin duplicar, sin el propio autor)
  for recipient in
    select distinct id from (
      select id from public.profiles where role = 'admin' and approved and deleted_at is null
      union select proj.coordinator_id where proj.coordinator_id is not null
    ) r where id is not null and id <> auth.uid()
  loop
    insert into public.notifications (user_id, type, title, body, project_id, card_id)
    values (recipient, 'due_date_changed', 'Cambio de fecha de vencimiento', msg, c.project_id, c.id);
  end loop;
end;
$$;

-- Nadie cambia due_date directamente: solo vía change_due_date (o al crear la tarjeta).
create or replace function public.guard_due_date()
returns trigger language plpgsql as $$
begin
  -- Desde el cliente (rol authenticated) no se puede tocar due_date directamente.
  -- change_due_date es SECURITY DEFINER (corre como su dueño, postgres) y sí pasa.
  if new.due_date is distinct from old.due_date and current_user in ('authenticated', 'anon') then
    raise exception 'Para cambiar la fecha límite usa la opción "Cambiar fecha" (requiere justificación)';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_due_date on public.cards;
create trigger guard_due_date before update of due_date on public.cards
  for each row execute function public.guard_due_date();

-- ---------------------------------------------------------------------------
-- Notificación al asignar una tarea
-- ---------------------------------------------------------------------------
create or replace function public.notify_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.cards%rowtype; actor text;
begin
  select * into c from public.cards where id = new.card_id;
  select full_name into actor from public.profiles where id = auth.uid();
  perform public.log_activity(c.project_id, c.id, 'card.assigned', jsonb_build_object('title', c.title, 'user_id', new.user_id));
  if new.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notifications (user_id, type, title, body, project_id, card_id)
    values (new.user_id, 'assigned', 'Te asignaron una tarea',
            format('%s te asignó la tarea "%s"', coalesce(actor, 'Alguien'), c.title), c.project_id, c.id);
  end if;
  return new;
end;
$$;
drop trigger if exists notify_assignment on public.card_assignees;
create trigger notify_assignment after insert on public.card_assignees
  for each row execute function public.notify_assignment();

-- ---------------------------------------------------------------------------
-- Aviso a los administradores cuando alguien se registra y espera aprobación
-- ---------------------------------------------------------------------------
create or replace function public.notify_pending_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  if new.approved then return new; end if;
  for a in select id from public.profiles where role = 'admin' and approved and deleted_at is null loop
    insert into public.notifications (user_id, type, title, body)
    values (a, 'pending_account', 'Nueva cuenta esperando aprobación',
            format('%s (%s) creó su cuenta y espera que la apruebes.', new.full_name, new.email));
  end loop;
  return new;
end;
$$;
drop trigger if exists notify_pending_profile on public.profiles;
create trigger notify_pending_profile after insert on public.profiles
  for each row execute function public.notify_pending_profile();

-- ---------------------------------------------------------------------------
-- Entregable adjuntado → actividad
-- ---------------------------------------------------------------------------
create or replace function public.attachments_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare c public.cards%rowtype;
begin
  select * into c from public.cards where id = new.card_id;
  perform public.log_activity(c.project_id, c.id,
    case when new.kind = 'deliverable' then 'card.deliverable_added' else 'card.reference_added' end,
    jsonb_build_object('title', c.title, 'name', new.name, 'url', new.url));
  return new;
end;
$$;
drop trigger if exists attachments_activity on public.attachments;
create trigger attachments_activity after insert on public.attachments
  for each row execute function public.attachments_activity();

-- ---------------------------------------------------------------------------
-- Papelera: borrado lógico y recuperación en cascada
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete(p_table text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare proj uuid;
begin
  if p_table not in ('projects','lists','cards','labels','profiles') then
    raise exception 'Tabla no permitida';
  end if;
  if p_table = 'projects' then
    if not (public.is_admin() or exists (select 1 from project_members where project_id = p_id and user_id = auth.uid() and role = 'owner')) then
      raise exception 'Solo el administrador o el dueño puede eliminar un tablero';
    end if;
    update public.projects set deleted_at = now(), deleted_by = auth.uid() where id = p_id and deleted_at is null;
    perform public.log_activity(p_id, null, 'project.deleted', '{}'::jsonb);
  elsif p_table = 'lists' then
    select project_id into proj from public.lists where id = p_id;
    if not public.can_edit(proj) then raise exception 'Sin permiso'; end if;
    update public.lists set deleted_at = now(), deleted_by = auth.uid() where id = p_id and deleted_at is null;
    perform public.log_activity(proj, null, 'list.deleted', jsonb_build_object('list_id', p_id));
  elsif p_table = 'cards' then
    select project_id into proj from public.cards where id = p_id;
    if not public.can_edit(proj) then raise exception 'Sin permiso'; end if;
    update public.cards set deleted_at = now(), deleted_by = auth.uid() where id = p_id and deleted_at is null;
  elsif p_table = 'labels' then
    if not public.is_admin() then raise exception 'Solo el administrador'; end if;
    update public.labels set deleted_at = now(), deleted_by = auth.uid() where id = p_id and deleted_at is null;
  elsif p_table = 'profiles' then
    if not public.is_admin() then raise exception 'Solo el administrador'; end if;
    update public.profiles set deleted_at = now(), deleted_by = auth.uid() where id = p_id and deleted_at is null;
  end if;
end;
$$;

create or replace function public.restore_deleted(p_table text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare proj uuid;
begin
  if not public.is_admin() then raise exception 'Solo el administrador puede recuperar elementos'; end if;
  if p_table = 'projects' then
    update public.projects set deleted_at = null, deleted_by = null where id = p_id;
    perform public.log_activity(p_id, null, 'project.restored', '{}'::jsonb);
  elsif p_table = 'lists' then
    update public.lists set deleted_at = null, deleted_by = null where id = p_id returning project_id into proj;
    perform public.log_activity(proj, null, 'list.restored', jsonb_build_object('list_id', p_id));
  elsif p_table = 'cards' then
    update public.cards set deleted_at = null, deleted_by = null where id = p_id;
  elsif p_table = 'labels' then
    update public.labels set deleted_at = null, deleted_by = null where id = p_id;
  elsif p_table = 'profiles' then
    update public.profiles set deleted_at = null, deleted_by = null where id = p_id;
  else
    raise exception 'Tabla no permitida';
  end if;
end;
$$;

-- Purga definitiva de lo que lleva más días en papelera que la retención configurada.
create or replace function public.purge_trash()
returns int language plpgsql security definer set search_path = public as $$
declare days int; n int := 0; k int;
begin
  select coalesce((settings ->> 'trash_retention_days')::int, 30) into days from public.org_settings where id = 1;
  delete from public.cards where deleted_at < now() - make_interval(days => days); get diagnostics k = row_count; n := n + k;
  delete from public.lists where deleted_at < now() - make_interval(days => days); get diagnostics k = row_count; n := n + k;
  delete from public.labels where deleted_at < now() - make_interval(days => days); get diagnostics k = row_count; n := n + k;
  delete from public.projects where deleted_at < now() - make_interval(days => days); get diagnostics k = row_count; n := n + k;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aprobación de cuentas (solo admin) y creación de proyecto con listas por defecto
-- ---------------------------------------------------------------------------
create or replace function public.approve_user(p_user uuid, p_role text default 'member', p_projects uuid[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare p uuid;
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;
  update public.profiles set approved = true, role = coalesce(p_role, 'member') where id = p_user;
  foreach p in array coalesce(p_projects, '{}'::uuid[]) loop
    insert into public.project_members (project_id, user_id, role) values (p, p_user, 'editor')
    on conflict do nothing;
  end loop;
  perform public.log_activity(null, null, 'user.approved', jsonb_build_object('user_id', p_user, 'role', p_role, 'projects', p_projects));
  insert into public.notifications (user_id, type, title, body)
  values (p_user, 'approved', 'Tu cuenta fue aprobada', 'Ya puedes entrar a Proyvia y ver tus proyectos.');
end;
$$;

create or replace function public.create_project(p_name text, p_color text default '#2563EB', p_description text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not public.is_approved() then raise exception 'Cuenta no aprobada'; end if;
  insert into public.projects (name, color, description, created_by, coordinator_id)
  values (p_name, p_color, p_description, auth.uid(), auth.uid()) returning id into pid;
  insert into public.project_members (project_id, user_id, role) values (pid, auth.uid(), 'owner');
  insert into public.lists (project_id, name, position, is_done) values
    (pid, 'Por hacer', 1000, false),
    (pid, 'En proceso', 2000, false),
    (pid, 'En revisión', 3000, false),
    (pid, 'Terminado', 4000, true);
  perform public.log_activity(pid, null, 'project.created', jsonb_build_object('name', p_name));
  return pid;
end;
$$;

-- Marca "visto" para saber quién está activo
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
