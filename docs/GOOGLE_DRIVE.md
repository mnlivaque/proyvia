# Conectar Google Drive (y el ingreso con Google)

Proyvia usa el **Google Picker**: cada persona navega su propio Drive, con su cuenta, y elige archivos o carpetas.
La app solo guarda el nombre y el enlace del archivo (permiso **de solo lectura** `drive.readonly`); nunca modifica ni borra nada en Drive.

Se necesita un proyecto en Google Cloud con dos credenciales. Lo haces una sola vez (~20 minutos).

## 1. Proyecto en Google Cloud

1. Entra a https://console.cloud.google.com con la cuenta de Google del equipo (la que administra el Drive).
2. Arriba a la izquierda: **Seleccionar proyecto → Proyecto nuevo** → nombre `Proyvia` → Crear.
3. Anota el **Número del proyecto** (en la página de inicio del proyecto): va en `VITE_GOOGLE_APP_ID`.

## 2. Activar las APIs

**APIs y servicios → Biblioteca**: busca y habilita
- **Google Picker API**
- **Google Drive API**

## 3. Pantalla de consentimiento

**APIs y servicios → Pantalla de consentimiento de OAuth** (o "Google Auth Platform → Branding"):
- Tipo de usuario: **Externo** (si todos usan cuentas @livaque.app de Google Workspace, elige **Interno** y te ahorras la verificación).
- Nombre de la app: `Proyvia`. Correo de asistencia: el tuyo. Dominio autorizado: `livaque.app`.
- **Permisos (scopes)**: agrega `.../auth/drive.readonly`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.
- Si es *Externo*: en **Público / Usuarios de prueba** agrega los correos del equipo mientras la app esté "En pruebas" (hasta 100). Para quitar el aviso de "app no verificada" se publica la app; con el scope `drive.readonly` Google puede pedir una verificación breve.

## 4. Credenciales

**APIs y servicios → Credenciales → Crear credenciales**:

### a) ID de cliente de OAuth (para el Picker y para "Ingresar con Google")
- Tipo: **Aplicación web**. Nombre: `Proyvia web`.
- **Orígenes de JavaScript autorizados**:
  - `https://proyvia.livaque.app`
  - `http://localhost:5173`
- **URIs de redireccionamiento autorizados** (para Supabase Auth):
  - `https://<ref>.supabase.co/auth/v1/callback`  (la URL exacta la muestra Supabase en *Authentication → Providers → Google*)
- Guarda: copia **ID de cliente** → `VITE_GOOGLE_CLIENT_ID` y también a Supabase (Providers → Google, junto con el **Secreto de cliente**).

### b) Clave de API (para el Picker)
- **Crear credenciales → Clave de API**. Nombre: `Proyvia Picker`.
- **Restricciones de aplicación**: *Referentes HTTP* → agrega `https://proyvia.livaque.app/*` y `http://localhost:5173/*`.
- **Restricciones de API**: solo *Google Picker API*.
- Copia la clave → `VITE_GOOGLE_API_KEY`.

> Estas dos claves son públicas por diseño (van en el navegador). La seguridad la dan las restricciones de dominio y el permiso de solo lectura.

## 5. Variables de entorno

En `.env.local` (local) y en Cloudflare Pages (producción):
```
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=AIza...
VITE_GOOGLE_APP_ID=123456789012
```

## 6. En la app

- **Administración → Carpetas de Drive por proyecto**: elige la carpeta de cada proyecto. Al adjuntar desde una tarea, el explorador se abre ahí.
- En cualquier tarea: **Elegir en Drive** (referencias o entregable) o **Pegar enlace**.
- La primera vez, Google pedirá a cada persona permiso de lectura de su Drive; después no vuelve a preguntar (~1 hora por sesión de token).

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| "Google Drive no está configurado" | Faltan `VITE_GOOGLE_CLIENT_ID` o `VITE_GOOGLE_API_KEY`. |
| Ventana de Google: *Error 400: redirect_uri_mismatch* | Falta el origen `https://proyvia.livaque.app` en el cliente OAuth. |
| *Esta app no está verificada* | La app está "En pruebas": agrega al usuario como tester o publica la app. |
| El Picker abre pero no muestra archivos | La clave de API no tiene habilitada *Google Picker API* o el referente no coincide. |
| Alguien no puede abrir un archivo | No tiene permiso en Drive. Proyvia respeta los permisos de Drive. |
