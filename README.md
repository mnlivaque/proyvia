# Proyvia

Tablero de seguimiento de proyectos y tareas por persona, con archivos enlazados desde Google Drive.
Hecho para un equipo de varios proyectos (≈4) con ≈12 profesionales cada uno.

**Producción:** https://proyvia.livaque.app

## Qué hace

- **Un tablero por proyecto** (listas tipo Kanban) con selector de proyecto siempre visible.
- **Tareas por persona:** barra lateral con cada integrante; un clic muestra solo sus tareas. También en "Mis tareas" (todos los proyectos).
- **Fechas estrictas:** las tareas se ordenan solas por fecha límite; las vencidas llevan alerta roja; al iniciar sesión aparece el aviso de vencidas; cambiar una fecha exige justificación y avisa automáticamente (app + correo) al administrador y al coordinador.
- **Google Drive:** cada tarea guarda *documentos de referencia* (insumos) y *entregable* (resultado) elegidos con el explorador de Drive o pegando un enlace. Cada proyecto tiene su carpeta de Drive.
- **Acceso controlado:** registro con aprobación del administrador, o cuentas creadas por el admin (una por una o desde un Excel). Roles: administrador / miembro; por proyecto: dueño / edita / solo lee.
- **Papelera:** nada se borra al instante; 30 días para recuperar tableros, listas, tareas, etiquetas y usuarios.
- **Actividad y registro:** auditoría completa, filtros y exportación a Excel.

## Stack

| Capa | Tecnología |
|---|---|
| Front-end | Vite + React 19 + TypeScript + Tailwind CSS 4, TanStack Query, dnd-kit |
| Base de datos / Auth / Realtime | Supabase (Postgres con RLS en todas las tablas) |
| Funciones | Supabase Edge Functions (crear usuarios, correos, recordatorios) · Cloudflare Pages Functions (`/api/health`) |
| Hosting | Cloudflare Pages (CDN, HTTPS, dominio propio) |
| Correo | Resend |
| Monitoreo | Sentry + Cloudflare Web Analytics + tabla `activity` |

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```

Scripts: `npm run dev`, `npm run build` (tsc + vite, sin source maps), `npm run preview`, `npm run lint`, `npm run typecheck`.

## Estructura

```
src/
  auth/        AuthProvider (sesión + perfil) y guardias de ruta
  data/        hooks de datos (TanStack Query + Supabase + Realtime)
  pages/       pantallas: auth, proyectos, tablero (board), mis tareas, admin
  components/  UI compartida (avatar, modal, barra superior, aviso de vencidas…)
  lib/         supabase, env, fechas, colores, Google Picker, errores, Sentry
  types/       tipos de la base de datos
supabase/
  migrations/  esquema, funciones/triggers, RLS, realtime/vistas
  functions/   Edge Functions (Deno)
functions/     Cloudflare Pages Functions
docs/          DESPLIEGUE, GOOGLE_DRIVE, SEGURIDAD, API
```

## Documentación

- [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md): Supabase, Cloudflare Pages, dominio, correos, cron.
- [docs/GOOGLE_DRIVE.md](docs/GOOGLE_DRIVE.md): crear el cliente OAuth y la API key del Picker.
- [docs/SEGURIDAD.md](docs/SEGURIDAD.md): cómo se cumplen los 10 puntos (RLS, rate limiting, caché, monitoreo…).
- [docs/API.md](docs/API.md): tablas, funciones RPC y endpoints.
- [CHANGELOG.md](CHANGELOG.md): historial de versiones.
