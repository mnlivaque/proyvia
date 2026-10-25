# Estado del despliegue y pendientes del responsable

Actualizado: 25 de octubre de 2026 (madrugada). Lo hizo Claude mientras el responsable dormía.

## Lo que YA está hecho

| Pieza | Estado | Dónde |
|---|---|---|
| Código v0.1.0 | ✅ Compilado, sin source maps, 0 vulnerabilidades | `D:\02.-Claude\Z.- Utilidades\TrelloMTC` |
| Repositorio GitHub | ✅ Creado y con el código subido | https://github.com/mnlivaque/proyvia |
| Supabase: proyecto `proyvia` | ✅ Creado (org *predidata*, región São Paulo) | https://supabase.com/dashboard/project/oqwbpvynoocwyauunewe |
| Base de datos | ✅ 4 migraciones aplicadas (15 tablas + 2 vistas, RLS, funciones, triggers, realtime) | SQL Editor |
| Etiquetas iniciales | ✅ Plano, Padrón, Campo, Urgente, Coordinación, Informe | tabla `labels` |
| Auth: URLs | ✅ Site URL `https://proyvia.livaque.app`; redirects para producción, localhost y previews | Auth → URL Configuration |
| Cuenta administradora | ✅ Invitación enviada a **mila.livaque.chatgpt@gmail.com** (primer usuario → admin aprobado, nombre "Mila Livaque") | Auth → Users |
| Proyecto de ejemplo | ✅ "Plano CBC — Grupo 2" con 5 tareas (una vencida, una terminada con entregable) | tablero |
| Hosting | ✅ Cloudflare Pages, proyecto `proyvia`, **carga directa** del build | https://proyvia.pages.dev |
| Dominio | ✅ `proyvia.livaque.app` agregado al proyecto (CNAME creado por Cloudflare; puede tardar unos minutos en activarse) | Pages → Dominios personalizados |

## Lo que te toca a TI (en orden; ~15 minutos en total)

1. **Entra por primera vez.** Abre el correo de Supabase "You have been invited" → el enlace te lleva a la app para crear tu contraseña. Si el enlace venció, en https://proyvia.pages.dev/login usa "¿Olvidaste tu contraseña?".
2. **GitHub pide verificación por correo ("Confirm access")** para dos cosas que no pude terminar:
   - Hacer **privado** el repo: https://github.com/mnlivaque/proyvia/settings → Danger Zone → Change visibility → Private.
   - Instalar la app **Cloudflare Workers and Pages** en GitHub (solo para `proyvia`), para que cada `git push` despliegue solo: https://github.com/apps/cloudflare-workers-and-pages/installations/new
   Luego, en Cloudflare → Workers y Pages → `proyvia` → Configuración, conecta el repositorio (build `npm run build`, salida `dist`, variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
   *Mientras tanto, para publicar cambios:* `npm run build` y en Cloudflare → `proyvia` → **Crear implementación** → subir la carpeta `dist` (o el ZIP).
3. **Edge Functions** (crear usuarios desde Excel, correos, recordatorios). Necesitan tu sesión de la CLI:
   ```bash
   cd "D:\02.-Claude\Z.- Utilidades\TrelloMTC"
   npx supabase login
   npx supabase link --project-ref oqwbpvynoocwyauunewe
   npx supabase secrets set APP_URL=https://proyvia.livaque.app CRON_SECRET=<frase-larga-aleatoria>
   npx supabase functions deploy admin-create-users
   npx supabase functions deploy send-notification-emails --no-verify-jwt
   npx supabase functions deploy overdue-reminders --no-verify-jwt
   ```
   Hasta que esto se haga, "Crear usuarios desde Excel" dará error; aprobar usuarios registrados sí funciona.
4. **Correos automáticos**: cuenta en https://resend.com, verificar `livaque.app`, y `npx supabase secrets set RESEND_API_KEY=re_...`. Luego programar los crons (SQL en `docs/DESPLIEGUE.md`, sección Edge Functions). Las notificaciones **dentro de la app** ya funcionan sin esto.
5. **Google Drive** (explorador de archivos): seguir `docs/GOOGLE_DRIVE.md` (~20 min). Hasta entonces, en las tarjetas se puede **pegar el enlace** de Drive sin problema.
6. **Opcional:** Turnstile (anti-bots en el registro), Sentry (errores) y Cloudflare Web Analytics; pasos en `docs/DESPLIEGUE.md`.

## Notas

- La **contraseña de la base de datos** la generó Supabase al crear el proyecto y no quedó guardada. Si alguna vez la necesitas (solo para herramientas externas), restablécela en Supabase → Project Settings → Database → Reset database password.
- `.env.local` y `.env.production` (claves públicas de Supabase) están en la carpeta del proyecto y **no** se suben a git.
- `/api/health` (Cloudflare Pages Function) solo se publica con la integración Git o con `wrangler pages deploy`; con la carga directa desde el panel no se incluye.
- El archivo `public/_redirects` se quitó: Cloudflare Pages ya sirve `index.html` para rutas de la app sin necesidad de esa regla.
