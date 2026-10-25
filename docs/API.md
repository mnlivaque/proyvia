# API de Proyvia

Toda la lógica de datos está en Supabase. El front usa `@supabase/supabase-js`; cualquier otra herramienta puede usar la **REST** (`https://<ref>.supabase.co/rest/v1/<tabla>`) con la cabecera `apikey: <anon key>` y `Authorization: Bearer <token del usuario>`. RLS aplica siempre: cada quien recibe solo lo que puede ver en la app.

## Tablas

| Tabla | Qué guarda | Quién escribe |
|---|---|---|
| `profiles` | nombre, correo, color, rol (`admin`/`member`), `approved`, `must_change_password` | cada uno su fila (sin rol/aprobación); admin todo |
| `org_settings` | ajustes generales (1 fila, columna `settings` jsonb) | admin |
| `projects` | proyectos/tableros, coordinador, carpeta de Drive, archivado | dueño/admin (crear vía `create_project`) |
| `project_members` | quién pertenece a qué proyecto y con qué rol (`owner`/`editor`/`viewer`) | dueño/admin |
| `lists` | columnas del tablero (`position`, `is_done`) | editores |
| `cards` | tareas (`due_date` solo vía `change_due_date`) | editores |
| `card_assignees` | responsables de cada tarea | editores |
| `labels`, `card_labels` | etiquetas (globales si `project_id` es null) | admin / editores del proyecto |
| `checklist_items` | lista de pasos | editores |
| `attachments` | adjuntos (`kind`: `reference`/`deliverable`; `source`: `drive`/`url`) | editores |
| `comments` | comentarios | editores (autor edita el suyo) |
| `due_date_changes` | historial de cambios de fecha con justificación | solo vía `change_due_date` |
| `notifications` | avisos por usuario (`read_at`, `email_sent_at`) | triggers; cada uno marca los suyos como leídos |
| `activity` | auditoría inmutable | triggers / `log_activity` |

Vistas: `overdue_cards` (vencidas con `days_overdue`), `trash_items` (papelera con `days_left`).

## Funciones RPC (`supabase.rpc('nombre', {...})`)

| Función | Parámetros | Qué hace |
|---|---|---|
| `create_project` | `p_name, p_color?, p_description?` | crea el proyecto con 4 listas por defecto; quien lo crea queda dueño y coordinador |
| `change_due_date` | `p_card, p_new_date, p_reason` | valida permiso y justificación (mín. configurable), guarda el cambio, registra actividad y **notifica** a admins + coordinador |
| `approve_user` | `p_user, p_role?, p_projects?` | admin aprueba una cuenta y la agrega a proyectos |
| `soft_delete` | `p_table, p_id` | manda a la papelera (`projects/lists/cards/labels/profiles`) |
| `restore_deleted` | `p_table, p_id` | admin recupera de la papelera |
| `purge_trash` | — | borra lo que superó la retención (lo llama `pg_cron`) |
| `touch_last_seen` | — | marca "visto por última vez" |
| `is_admin`, `is_approved`, `is_member(p_project)`, `can_edit(p_project)` | — | helpers de permisos (también usables desde el cliente) |

## Edge Functions (`supabase.functions.invoke('nombre', { body })`)

| Función | Quién | Cuerpo | Respuesta |
|---|---|---|---|
| `admin-create-users` | admin autenticado | `{ users: [{ full_name, email, password, role?, project_ids? }] }` (máx. 200) | `{ created, failed: [{ email, error }] }` |
| `send-notification-emails` | cron (cabecera `x-cron-secret`) | — | `{ sent }` |
| `overdue-reminders` | cron | — | `{ created }` |

## Cloudflare Pages Functions

| Ruta | Respuesta |
|---|---|
| `GET /api/health` | `{ status, service, time, version, branch, checks }` |

## Realtime

Canales `postgres_changes` sobre `cards`, `lists`, `card_assignees`, `card_labels`, `attachments`, `checklist_items`, `comments`, `notifications`. El front invalida su caché al recibir un evento; RLS filtra qué eventos llegan a cada usuario.

## Ejemplo: leer mis tareas vencidas con curl

```bash
curl "https://<ref>.supabase.co/rest/v1/overdue_cards?select=title,due_date,days_overdue" \
  -H "apikey: <anon>" -H "Authorization: Bearer <token>"
```
