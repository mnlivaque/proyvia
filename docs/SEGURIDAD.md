# Seguridad y operación: los 10 puntos

Cómo Proyvia cumple cada punto de la lista "de demo a app de verdad".

| # | Punto | Cómo se cumple en Proyvia |
|---|---|---|
| 1 | **Front comprimido, sin source maps** | `vite.config.ts`: `sourcemap: false`, `minify: 'esbuild'`, chunks por librería. `dist/` no contiene `.map`. Solo hay claves **públicas** en el front (anon key, Client ID, API key restringida por dominio); `.env*` está en `.gitignore`. La `service_role` de Supabase vive únicamente en los secretos de las Edge Functions. |
| 2 | **Base de datos con RLS** | `supabase/migrations/0003_rls.sql`: RLS activado en las 15 tablas. Un usuario no aprobado no ve nada; un miembro solo ve sus proyectos; `viewer` solo lee; el admin ve todo. Las filas en papelera solo las ve el admin. Las acciones delicadas (cambiar fecha, aprobar, eliminar, recuperar) solo pasan por funciones `SECURITY DEFINER` que validan permisos. Nadie puede subir su propio rol (`with check` en `profiles`). |
| 3 | **Control de versiones** | Git + GitHub (`mnlivaque/proyvia`), rama `main` protegida, previews por rama en Cloudflare, migraciones numeradas en `supabase/migrations`, `CHANGELOG.md`, versión (commit) visible en la pantalla de ingreso y en `/api/health`. |
| 4 | **APIs** | Supabase expone REST (PostgREST) y Realtime sobre las mismas políticas RLS: cualquier integración futura (Excel, Power BI, scripts) usa `https://<ref>.supabase.co/rest/v1/` con un token de usuario y recibe solo lo que ese usuario puede ver. RPC documentadas en `docs/API.md`. Edge Functions para lo que necesita privilegios. `GET /api/health` en Cloudflare. |
| 5 | **Hosting y deployment** | Cloudflare Pages conectado a GitHub: cada push despliega; dominio `proyvia.livaque.app` con HTTPS automático; `_redirects` para la SPA. |
| 6 | **Seguridad** | `public/_headers`: CSP estricta (solo Supabase, Google, Turnstile, Sentry), HSTS con preload, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Turnstile en el registro. Validación con `zod` en formularios. Confirmación de correo. Aprobación del admin. Cambio de contraseña obligatorio para cuentas creadas con contraseña temporal. Redirect URLs restringidas en Supabase. PKCE en OAuth. Borrado lógico + confirmación escribiendo el nombre para tableros. Auditoría inmutable en `activity` (solo lectura para todos). |
| 7 | **Rate limiting** | Supabase Auth limita intentos de ingreso, registros y correos (`supabase/config.toml` → `[auth.rate_limit]`). Turnstile frena bots. Regla WAF de Cloudflare sobre `/api/*` y `/login` (60 req/min/IP). Realtime limitado a 10 eventos/s por cliente. |
| 8 | **Caché** | Assets con hash + `Cache-Control: immutable` (1 año) en el CDN; `index.html` sin caché para que cada despliegue llegue de inmediato. TanStack Query en el cliente (`staleTime` 30 s, actualizaciones optimistas al mover tarjetas). Realtime en vez de polling. Índices en Postgres para las consultas del tablero (`cards_project_list_idx`, `card_assignees_user_idx`, `activity_*_idx`). Pantallas internas con carga diferida (`lazy`). |
| 9 | **Escalabilidad** | Front estático en CDN global. Postgres gestionado (Supabase escala verticalmente sin cambios de código). Paginación en actividad. Borrado lógico y purga programada. Consultas por proyecto (no "todo de golpe"). 1 000 usuarios y decenas de miles de tareas caben de sobra en el plan gratuito/Pro. |
| 10 | **Monitoreo** | Sentry (errores + rendimiento, release por commit, sin PII). Cloudflare Web Analytics. Logs de Supabase (API, Auth, Postgres, Edge Functions). `/api/health` para un monitor externo (p. ej. UptimeRobot gratis). Tabla `activity` + pantalla "Actividad y registro" con exportación a Excel. |

## Qué NO hacer

- No pegar la `service_role` key en ningún archivo del front ni en Cloudflare Pages.
- No desactivar RLS "para probar". Si una consulta no devuelve datos, revisa la política.
- No borrar filas directamente en producción: usa la Papelera.
- No agregar dominios externos a la CSP sin revisar qué cargan.

## Revisión periódica (cada 3 meses)

1. `npm audit` y `npm update` en una rama; probar; merge.
2. Revisar en Supabase → Auth → Users que no haya cuentas raras pendientes.
3. Revisar en Sentry los errores recurrentes.
4. Descargar la **copia de seguridad en Excel** (Administración → Ajustes) y guardarla en Drive.
