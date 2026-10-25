-- Proyvia · 0003 · Row-Level Security (punto 2: nadie toca datos ajenos)
-- Regla general: solo usuarios APROBADOS ven algo; solo ven proyectos donde son
-- miembros; los "viewer" solo leen; el admin ve todo. Las filas en papelera
-- (deleted_at no nulo) solo las ve el admin.

alter table public.profiles          enable row level security;
alter table public.org_settings      enable row level security;
alter table public.projects          enable row level security;
alter table public.project_members   enable row level security;
alter table public.lists             enable row level security;
alter table public.cards             enable row level security;
alter table public.card_assignees    enable row level security;
alter table public.labels            enable row level security;
alter table public.card_labels       enable row level security;
alter table public.checklist_items   enable row level security;
alter table public.attachments       enable row level security;
alter table public.comments          enable row level security;
alter table public.due_date_changes  enable row level security;
alter table public.notifications     enable row level security;
alter table public.activity          enable row level security;

-- profiles -------------------------------------------------------------------
create policy "perfil: cada uno ve el suyo; aprobados ven a los demás; admin ve todo"
  on public.profiles for select using (
    id = auth.uid() or public.is_admin() or (public.is_approved() and deleted_at is null)
  );
create policy "perfil: cada uno edita el suyo (sin tocar rol ni aprobación)"
  on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid())
              and approved = (select approved from public.profiles where id = auth.uid()));
create policy "perfil: admin edita cualquiera"
  on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- org_settings -----------------------------------------------------------------
create policy "ajustes: aprobados leen" on public.org_settings for select using (public.is_approved());
create policy "ajustes: admin edita" on public.org_settings for update using (public.is_admin()) with check (public.is_admin());

-- projects -----------------------------------------------------------------------
create policy "proyectos: miembros ven los suyos (no eliminados); admin todo"
  on public.projects for select using (public.is_admin() or (deleted_at is null and public.is_member(id)));
create policy "proyectos: dueño o admin edita"
  on public.projects for update using (
    public.is_admin() or exists (select 1 from public.project_members where project_id = id and user_id = auth.uid() and role = 'owner')
  );
-- insert solo vía create_project(); delete físico nunca desde el cliente.

-- project_members ------------------------------------------------------------------
create policy "miembros: los del proyecto ven la lista"
  on public.project_members for select using (public.is_member(project_id));
create policy "miembros: dueño o admin agrega"
  on public.project_members for insert with check (
    public.is_admin() or exists (select 1 from public.project_members pm where pm.project_id = project_id and pm.user_id = auth.uid() and pm.role = 'owner')
  );
create policy "miembros: dueño o admin cambia rol"
  on public.project_members for update using (
    public.is_admin() or exists (select 1 from public.project_members pm where pm.project_id = project_id and pm.user_id = auth.uid() and pm.role = 'owner')
  );
create policy "miembros: dueño o admin quita"
  on public.project_members for delete using (
    public.is_admin() or exists (select 1 from public.project_members pm where pm.project_id = project_id and pm.user_id = auth.uid() and pm.role = 'owner')
  );

-- lists ------------------------------------------------------------------------------
create policy "listas: miembros ven" on public.lists for select using (public.is_admin() or (deleted_at is null and public.is_member(project_id)));
create policy "listas: editores crean" on public.lists for insert with check (public.can_edit(project_id));
create policy "listas: editores editan" on public.lists for update using (public.can_edit(project_id));

-- cards --------------------------------------------------------------------------------
create policy "tareas: miembros ven" on public.cards for select using (public.is_admin() or (deleted_at is null and public.is_member(project_id)));
create policy "tareas: editores crean" on public.cards for insert with check (public.can_edit(project_id) and created_by = auth.uid());
create policy "tareas: editores editan" on public.cards for update using (public.can_edit(project_id));

-- card_assignees --------------------------------------------------------------------------
create policy "asignados: miembros ven" on public.card_assignees for select using (public.is_member(public.card_project(card_id)));
create policy "asignados: editores asignan" on public.card_assignees for insert with check (public.can_edit(public.card_project(card_id)));
create policy "asignados: editores quitan" on public.card_assignees for delete using (public.can_edit(public.card_project(card_id)));

-- labels -----------------------------------------------------------------------------------
create policy "etiquetas: aprobados ven globales y las de sus proyectos"
  on public.labels for select using (
    public.is_admin() or (deleted_at is null and public.is_approved() and (project_id is null or public.is_member(project_id)))
  );
create policy "etiquetas: admin crea globales; editores crean de su proyecto"
  on public.labels for insert with check (
    (project_id is null and public.is_admin()) or (project_id is not null and public.can_edit(project_id))
  );
create policy "etiquetas: admin edita globales; editores las de su proyecto"
  on public.labels for update using (
    (project_id is null and public.is_admin()) or (project_id is not null and public.can_edit(project_id))
  );

create policy "tarjeta-etiqueta: miembros ven" on public.card_labels for select using (public.is_member(public.card_project(card_id)));
create policy "tarjeta-etiqueta: editores ponen" on public.card_labels for insert with check (public.can_edit(public.card_project(card_id)));
create policy "tarjeta-etiqueta: editores quitan" on public.card_labels for delete using (public.can_edit(public.card_project(card_id)));

-- checklist_items ------------------------------------------------------------------------------
create policy "pasos: miembros ven" on public.checklist_items for select using (public.is_member(public.card_project(card_id)));
create policy "pasos: editores crean" on public.checklist_items for insert with check (public.can_edit(public.card_project(card_id)));
create policy "pasos: editores editan" on public.checklist_items for update using (public.can_edit(public.card_project(card_id)));
create policy "pasos: editores borran" on public.checklist_items for delete using (public.can_edit(public.card_project(card_id)));

-- attachments ----------------------------------------------------------------------------------------
create policy "adjuntos: miembros ven" on public.attachments for select using (deleted_at is null and public.is_member(public.card_project(card_id)));
create policy "adjuntos: editores agregan" on public.attachments for insert with check (public.can_edit(public.card_project(card_id)) and added_by = auth.uid());
create policy "adjuntos: editores quitan (lógico)" on public.attachments for update using (public.can_edit(public.card_project(card_id)));

-- comments -----------------------------------------------------------------------------------------------
create policy "comentarios: miembros ven" on public.comments for select using (deleted_at is null and public.is_member(public.card_project(card_id)));
create policy "comentarios: editores escriben" on public.comments for insert with check (public.can_edit(public.card_project(card_id)) and user_id = auth.uid());
create policy "comentarios: autor edita/oculta el suyo; admin cualquiera"
  on public.comments for update using (user_id = auth.uid() or public.is_admin());

-- due_date_changes (solo lectura; se escribe vía change_due_date) ------------------------------------------
create policy "cambios de fecha: miembros ven" on public.due_date_changes for select using (public.is_member(public.card_project(card_id)));

-- notifications ----------------------------------------------------------------------------------------------
create policy "avisos: cada uno ve los suyos" on public.notifications for select using (user_id = auth.uid());
create policy "avisos: cada uno marca leídos los suyos" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- activity (solo lectura; se escribe vía log_activity) -----------------------------------------------------------
create policy "actividad: miembros ven la de sus proyectos; admin todo"
  on public.activity for select using (public.is_admin() or (project_id is not null and public.is_member(project_id)));

-- Permisos de ejecución de funciones RPC
grant execute on function public.change_due_date(uuid, date, text) to authenticated;
grant execute on function public.soft_delete(text, uuid) to authenticated;
grant execute on function public.restore_deleted(text, uuid) to authenticated;
grant execute on function public.approve_user(uuid, text, uuid[]) to authenticated;
grant execute on function public.create_project(text, text, text) to authenticated;
grant execute on function public.touch_last_seen() to authenticated;
revoke execute on function public.purge_trash() from public, anon, authenticated;
revoke execute on function public.log_activity(uuid, uuid, text, jsonb) from public, anon, authenticated;
