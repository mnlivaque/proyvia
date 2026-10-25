-- Proyvia · 0001 · Esquema base
-- Se aplica con: npx supabase db push   (o pegando en el SQL Editor de Supabase)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Perfiles (uno por usuario de auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  full_name             text not null default '',
  email                 text not null default '',
  avatar_url            text,
  color                 text not null default '#0F766E',
  role                  text not null default 'member' check (role in ('admin', 'member')),
  approved              boolean not null default false,
  must_change_password  boolean not null default false,
  last_seen_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  deleted_by            uuid references public.profiles (id)
);
comment on table public.profiles is 'Datos públicos de cada usuario. approved=false hasta que un admin apruebe.';

-- ---------------------------------------------------------------------------
-- Ajustes de la organización (una sola fila)
-- ---------------------------------------------------------------------------
create table public.org_settings (
  id          int primary key default 1 check (id = 1),
  name        text not null default 'Proyvia',
  settings    jsonb not null default '{
    "order_by_due_date": true,
    "mark_overdue": true,
    "overdue_notice_on_login": true,
    "require_due_date_reason": true,
    "due_date_reason_min_chars": 20,
    "confirm_delete": true,
    "trash_retention_days": 30,
    "notify_due_date_change": true,
    "notify_overdue": true,
    "notify_assignment": true,
    "notify_pending_account": true,
    "weekly_summary": false,
    "sender_email": "",
    "open_signup": true,
    "require_approval": true,
    "force_password_change": true,
    "google_login": true,
    "session_idle_days": 7,
    "timezone": "America/Lima"
  }'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id)
);
insert into public.org_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Proyectos (cada proyecto = un tablero)
-- ---------------------------------------------------------------------------
create table public.projects (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  description               text not null default '',
  color                     text not null default '#2563EB',
  coordinator_id            uuid references public.profiles (id),
  drive_folder_id           text,
  drive_folder_name         text,
  drive_folder_path         text,
  drive_subfolder_per_card  boolean not null default false,
  drive_allow_outside       boolean not null default true,
  archived                  boolean not null default false,
  created_by                uuid references public.profiles (id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,
  deleted_by                uuid references public.profiles (id)
);

create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

-- ---------------------------------------------------------------------------
-- Listas (columnas del tablero)
-- ---------------------------------------------------------------------------
create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null,
  position    numeric not null default 1000,
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles (id)
);
create index lists_project_idx on public.lists (project_id, position);

-- ---------------------------------------------------------------------------
-- Tarjetas (tareas). Dentro de una lista se ordenan SIEMPRE por fecha límite.
-- ---------------------------------------------------------------------------
create table public.cards (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  list_id       uuid not null references public.lists (id) on delete cascade,
  title         text not null,
  description   text not null default '',
  due_date      date,
  priority      text not null default 'media' check (priority in ('baja', 'media', 'alta', 'urgente')),
  completed_at  timestamptz,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  deleted_by    uuid references public.profiles (id)
);
create index cards_project_list_idx on public.cards (project_id, list_id, due_date);
create index cards_due_idx on public.cards (due_date) where deleted_at is null and completed_at is null;

create table public.card_assignees (
  card_id      uuid not null references public.cards (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  assigned_by  uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  primary key (card_id, user_id)
);
create index card_assignees_user_idx on public.card_assignees (user_id);

-- ---------------------------------------------------------------------------
-- Etiquetas (project_id null = de todos los proyectos)
-- ---------------------------------------------------------------------------
create table public.labels (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete cascade,
  name        text not null,
  color       text not null default '#DBEAFE',
  text_color  text not null default '#1E3A8A',
  description text not null default '',
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles (id)
);

create table public.card_labels (
  card_id   uuid not null references public.cards (id) on delete cascade,
  label_id  uuid not null references public.labels (id) on delete cascade,
  primary key (card_id, label_id)
);

-- ---------------------------------------------------------------------------
-- Lista de pasos, adjuntos (Drive / enlace), comentarios
-- ---------------------------------------------------------------------------
create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.cards (id) on delete cascade,
  text        text not null,
  done        boolean not null default false,
  position    numeric not null default 1000,
  created_at  timestamptz not null default now()
);
create index checklist_card_idx on public.checklist_items (card_id, position);

create table public.attachments (
  id             uuid primary key default gen_random_uuid(),
  card_id        uuid not null references public.cards (id) on delete cascade,
  kind           text not null default 'reference' check (kind in ('reference', 'deliverable')),
  source         text not null default 'url' check (source in ('drive', 'url')),
  url            text not null,
  name           text not null,
  drive_file_id  text,
  mime_type      text,
  icon_url       text,
  added_by       uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index attachments_card_idx on public.attachments (card_id);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.cards (id) on delete cascade,
  user_id     uuid not null references public.profiles (id),
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index comments_card_idx on public.comments (card_id, created_at);

-- ---------------------------------------------------------------------------
-- Cambios de fecha límite (con justificación obligatoria)
-- ---------------------------------------------------------------------------
create table public.due_date_changes (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.cards (id) on delete cascade,
  user_id     uuid not null references public.profiles (id),
  old_date    date,
  new_date    date,
  reason      text not null check (char_length(reason) >= 1),
  created_at  timestamptz not null default now()
);
create index due_date_changes_card_idx on public.due_date_changes (card_id, created_at);

-- ---------------------------------------------------------------------------
-- Notificaciones (en la app; el correo lo envía una Edge Function)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  type           text not null,
  title          text not null,
  body           text not null default '',
  project_id     uuid references public.projects (id) on delete set null,
  card_id        uuid references public.cards (id) on delete set null,
  read_at        timestamptz,
  email_sent_at  timestamptz,
  created_at     timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

-- ---------------------------------------------------------------------------
-- Actividad (auditoría; nunca se borra)
-- ---------------------------------------------------------------------------
create table public.activity (
  id          bigint generated always as identity primary key,
  project_id  uuid references public.projects (id) on delete set null,
  card_id     uuid references public.cards (id) on delete set null,
  user_id     uuid references public.profiles (id) on delete set null,
  action      text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index activity_project_idx on public.activity (project_id, created_at desc);
create index activity_user_idx on public.activity (user_id, created_at desc);
create index activity_card_idx on public.activity (card_id, created_at desc);
