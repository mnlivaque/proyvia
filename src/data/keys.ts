// Claves de caché de TanStack Query, centralizadas para invalidar sin errores de tipeo.
export const keys = {
  settings: ['org_settings'] as const,
  profiles: ['profiles'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  members: (projectId: string) => ['members', projectId] as const,
  lists: (projectId: string) => ['lists', projectId] as const,
  cards: (projectId: string) => ['cards', projectId] as const,
  card: (cardId: string) => ['card', cardId] as const,
  labels: (projectId?: string) => ['labels', projectId ?? 'all'] as const,
  myCards: (userId: string) => ['my_cards', userId] as const,
  overdue: (userId: string) => ['overdue', userId] as const,
  notifications: ['notifications'] as const,
  activity: (filters: Record<string, string | undefined>) => ['activity', filters] as const,
  trash: ['trash'] as const,
  allCardsSummary: ['cards_summary'] as const,
}
