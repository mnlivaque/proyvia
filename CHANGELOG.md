# Historial de versiones

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/). Versionado semántico.

## [0.1.0] - 2026-10-25

Primera versión funcional (sin desplegar todavía).

### Añadido
- Ingreso con correo/contraseña y Google; registro con aprobación del administrador; recuperación de contraseña; cambio de contraseña obligatorio para cuentas creadas por el admin.
- Selector de proyectos con avance, vencidas y actividad reciente.
- Tablero Kanban por proyecto: listas, tarjetas arrastrables entre listas, orden automático por fecha límite, alerta "VENCIDA", filtros por persona (barra lateral), etiqueta, vencidas y texto; actualización en vivo (Realtime).
- Tarjeta: responsables, fecha límite (cambio con justificación obligatoria + aviso automático), prioridad, etiquetas, descripción, documentos de referencia y entregable desde Google Drive o enlace, lista de pasos, comentarios y actividad; duplicar, mover, eliminar (papelera).
- Aviso de tareas vencidas al iniciar sesión (propias y, para coordinadores/admins, las del equipo).
- Mis tareas: todas las tareas de una persona en todos los proyectos, con filtro por persona.
- Administración: usuarios (aprobar, crear uno a uno o desde Excel, editar rol y proyectos), proyectos (coordinador, miembros, color, archivar, eliminar escribiendo el nombre), etiquetas, carpetas de Drive por proyecto, actividad y registro con exportación a Excel, ajustes y papelera con recuperación.
- Base de datos Supabase con RLS en todas las tablas, borrado lógico, triggers de actividad y notificaciones, funciones RPC (`change_due_date`, `approve_user`, `create_project`, `soft_delete`, `restore_deleted`, `purge_trash`).
- Edge Functions: `admin-create-users`, `send-notification-emails` (Resend), `overdue-reminders`.
- Cabeceras de seguridad (CSP, HSTS…), build sin source maps, caché inmutable de assets, Sentry opcional, `/api/health`.
