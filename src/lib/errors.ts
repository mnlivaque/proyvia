// Traduce los errores de Supabase a mensajes claros en español.
const MAP: Array<[RegExp, string]> = [
  [
    /FunctionsFetchError|FunctionsHttpError|FunctionsRelayError|Failed to send a request to the Edge Function|Edge Function returned|NOT_FOUND|requested function was not found/i,
    'El servicio del servidor para crear usuarios (Edge Function "admin-create-users") aún no está desplegado. Mientras tanto, la persona puede registrarse sola en la app y tú la apruebas en esta pantalla. Cómo desplegarlo: docs/ESTADO.md, paso 3.',
  ],
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Primero confirma tu correo: revisa tu bandeja de entrada.'],
  [/user already registered/i, 'Ya existe una cuenta con ese correo. Prueba ingresar.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
  [/rate limit|too many requests/i, 'Demasiados intentos. Espera un momento y vuelve a probar.'],
  [/signups not allowed/i, 'El registro está cerrado. Pide al administrador que cree tu cuenta.'],
  [/network|fetch/i, 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'],
  [/row-level security|permission denied/i, 'No tienes permiso para hacer esto.'],
  [/jwt expired/i, 'Tu sesión venció. Vuelve a ingresar.'],
]

export function friendlyError(err: unknown, fallback = 'Ocurrió un error. Inténtalo de nuevo.'): string {
  const e = err as { message?: unknown; name?: unknown; context?: { status?: number } } | null
  // Los errores de Edge Functions traen el detalle en name/context, no siempre en message.
  const msg =
    typeof err === 'string'
      ? err
      : e && typeof e === 'object'
        ? [e.name, e.message, e.context?.status === 404 ? 'NOT_FOUND' : ''].filter(Boolean).map(String).join(' ')
        : ''
  if (!msg) return fallback
  for (const [re, text] of MAP) if (re.test(msg)) return text
  // Los mensajes que levantan nuestras funciones SQL ya vienen en español.
  if (/[áéíóúñ¿¡]/i.test(msg) || /^(La |El |No |Solo |Para |Cuenta |Sin )/.test(msg)) return msg
  return fallback
}
