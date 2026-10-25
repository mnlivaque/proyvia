# Despliegue de Proyvia

Pasos para dejar la app en producción en **https://proyvia.livaque.app**. Cada paso dice quién lo hace
(tú en el navegador, o la terminal). Todo es gratis en los planes básicos de Supabase, Cloudflare, Resend y Sentry.

## 1. Supabase (base de datos, login, realtime)

1. Entra a https://supabase.com/dashboard y crea el proyecto (región: *South America (São Paulo)* es la más cercana a Lima). Guarda la **contraseña de la base de datos**.
2. En **Project Settings → API** copia `Project URL` y `anon public key` → van en `.env.local` (local) y en las variables de Cloudflare (producción). **Nunca** uses la `service_role` en el front.
3. Aplica las migraciones. Opción A (terminal, en la carpeta del proyecto):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```
   Opción B: abre **SQL Editor** y pega en orden el contenido de `supabase/migrations/0001…`, `0002…`, `0003…`, `0004…`.
4. **Authentication → URL Configuration**: `Site URL` = `https://proyvia.livaque.app`; `Redirect URLs` = `https://proyvia.livaque.app/**`, `http://localhost:5173/**`.
5. **Authentication → Providers → Email**: deja activado *Confirm email*. **Google**: pega el Client ID y el Client Secret de `docs/GOOGLE_DRIVE.md` (mismo cliente OAuth).
6. **Authentication → Attack protection**: activa *Captcha* → Cloudflare Turnstile y pega la **secret key** de Turnstile (la site key va en el front, `VITE_TURNSTILE_SITE_KEY`).
7. **Database → Extensions**: activa `pg_cron` (purga de papelera) y, si vas a usar cron para correos, también `pg_net`.
8. El **primer usuario que se registre queda como administrador** automáticamente. Regístrate tú primero.

### Edge Functions (crear usuarios, correos, recordatorios)

```bash
npx supabase secrets set RESEND_API_KEY=re_xxx APP_URL=https://proyvia.livaque.app CRON_SECRET=<una-frase-larga-aleatoria>
npx supabase functions deploy admin-create-users
npx supabase functions deploy send-notification-emails --no-verify-jwt
npx supabase functions deploy overdue-reminders --no-verify-jwt
```

Programar los crons (SQL Editor; reemplaza `<ref>` y `<CRON_SECRET>`):

```sql
select cron.schedule('proyvia_emails', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/send-notification-emails',
    headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb);
$$);
select cron.schedule('proyvia_overdue', '0 13 * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/overdue-reminders',
    headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb);
$$);
```

## 2. Resend (correos de aviso)

1. Crea cuenta en https://resend.com (gratis: 3 000 correos/mes).
2. **Domains → Add domain**: `livaque.app`. Agrega en Cloudflare DNS los registros que te indica (SPF, DKIM, DMARC). Espera a *Verified*.
3. **API Keys → Create**: cópiala en el secreto `RESEND_API_KEY` (paso anterior).
4. En la app, **Administración → Ajustes → Correo remitente**: `avisos@livaque.app`.

## 3. GitHub

```bash
git add -A
git commit -m "Proyvia v0.1.0"
```
Crea el repositorio **privado** `mnlivaque/proyvia` en https://github.com/new y luego:
```bash
git remote add origin https://github.com/mnlivaque/proyvia.git
git push -u origin main
```
Recomendado: **Settings → Branches → Add rule** para `main` (require pull request antes de merge).

## 4. Cloudflare Pages (hosting)

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → elige `mnlivaque/proyvia`.
2. Configuración de build:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: variable `NODE_VERSION` = `22`
3. **Variables de entorno** (Production y Preview):
   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | https://xxxx.supabase.co |
   | `VITE_SUPABASE_ANON_KEY` | eyJ… |
   | `VITE_GOOGLE_CLIENT_ID` | …apps.googleusercontent.com |
   | `VITE_GOOGLE_API_KEY` | AIza… |
   | `VITE_GOOGLE_APP_ID` | número del proyecto de Google Cloud |
   | `VITE_TURNSTILE_SITE_KEY` | 0x4AAA… |
   | `VITE_SENTRY_DSN` | https://…ingest.sentry.io/… |
   | `VITE_APP_VERSION` | `$CF_PAGES_COMMIT_SHA` |
4. **Save and Deploy**. En 1–2 minutos tendrás `https://proyvia.pages.dev`. Cada push a `main` despliega; cada rama crea una URL de vista previa.
5. **Custom domains → Set up a custom domain**: `proyvia.livaque.app`. Como el DNS está en Cloudflare, el registro CNAME se crea solo y el certificado HTTPS se emite en minutos.

### Rate limiting (plan gratuito: 1 regla)

**Security → WAF → Rate limiting rules → Create**: nombre `proyvia-api`; *If incoming requests match*: `(http.request.uri.path contains "/api/") or (http.request.uri.path eq "/login")`; *Rate*: 60 peticiones / 1 minuto por IP; *Action*: Block por 10 s. (Los límites de Supabase Auth y Turnstile ya protegen el registro y el ingreso.)

### Web Analytics

**Workers & Pages → tu proyecto → Metrics → Enable Web Analytics**. Sin cookies, gratis.

## 5. Sentry (errores)

1. https://sentry.io → crear proyecto **React**. Copia el **DSN** a `VITE_SENTRY_DSN` en Cloudflare.
2. (Opcional) para ver el código original en los errores sin publicar los mapas: `npm i -D @sentry/vite-plugin` y seguir https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/ con el token en la variable `SENTRY_AUTH_TOKEN` de Cloudflare. Los mapas suben solo a Sentry; `dist/` sigue sin `.map`.

## 6. Comprobación final

- `https://proyvia.livaque.app/api/health` responde `{"status":"ok",…}`.
- https://securityheaders.com/?q=proyvia.livaque.app da **A**.
- Regístrate (quedas admin), crea un proyecto, invita a alguien, cambia una fecha con justificación y revisa que llegue el correo.
- En Supabase → **Logs** no hay errores de RLS.

## Actualizaciones

```bash
git add -A && git commit -m "describe el cambio" && git push
```
Cloudflare despliega solo. Si hay un cambio de base de datos, agrega una migración nueva en `supabase/migrations/00xx_*.sql` y corre `npx supabase db push` **antes** del push.
