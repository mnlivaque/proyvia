import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Un solo cliente para toda la app. Usa la anon key (pública por diseño):
// lo que cada usuario puede ver o tocar lo decide RLS en la base de datos.
//
// Nota: los tipos de filas viven en src/types/database.ts y se aplican en los
// hooks (src/data/*). Cuando el proyecto esté enlazado se pueden generar los
// tipos oficiales con `npx supabase gen types typescript --linked` y pasarlos
// aquí como genérico: createClient<Database>(...).
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})
