import { QueryClient } from '@tanstack/react-query'

// Caché del lado del cliente (punto 8). Los datos se consideran frescos 30 s;
// Realtime invalida las consultas cuando otra persona cambia algo.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
})
