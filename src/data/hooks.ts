import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import type { Label, List, Notification, OrgSettings, Profile, Project, ProjectMember } from '@/types/database'
import { keys } from './keys'
import type { CardRow } from './types'

function throwIf<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error
  return res.data as T
}

// ---------------------------------------------------------------------------
// Ajustes y perfiles
// ---------------------------------------------------------------------------
export function useOrgSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: async () => throwIf(await supabase.from('org_settings').select('*').eq('id', 1).single()) as OrgSettings,
    staleTime: 5 * 60_000,
  })
}

export function useProfiles() {
  return useQuery({
    queryKey: keys.profiles,
    queryFn: async () =>
      throwIf(await supabase.from('profiles').select('*').is('deleted_at', null).order('full_name')) as Profile[],
    staleTime: 2 * 60_000,
  })
}

export function useProfileMap() {
  const q = useProfiles()
  const map = new Map<string, Profile>()
  for (const p of q.data ?? []) map.set(p.id, p)
  return { ...q, map }
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------
export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: async () =>
      throwIf(await supabase.from('projects').select('*').is('deleted_at', null).order('name')) as Project[],
  })
}

/**
 * Proyectos de los que la persona es MIEMBRO. Es lo que se muestra en el inicio,
 * el selector y Mis tareas, también para administradores: el admin ve todos los
 * proyectos solo en Administración → Proyectos.
 */
export function useMyProjects() {
  const { user } = useAuth()
  const projects = useProjects()
  const memberships = useQuery({
    // Comparte el prefijo 'memberships' con las consultas de Administración para invalidarse junto a ellas.
    queryKey: ['memberships', 'mine', user?.id],
    enabled: !!user,
    queryFn: async () =>
      throwIf(await supabase.from('project_members').select('project_id').eq('user_id', user!.id)) as { project_id: string }[],
  })
  const ids = new Set((memberships.data ?? []).map((m) => m.project_id))
  return {
    ...projects,
    isLoading: projects.isLoading || memberships.isLoading,
    data: projects.data?.filter((p) => ids.has(p.id)),
  }
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.project(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => throwIf(await supabase.from('projects').select('*').eq('id', projectId!).single()) as Project,
  })
}

export function useMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.members(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () =>
      throwIf(await supabase.from('project_members').select('*').eq('project_id', projectId!)) as ProjectMember[],
  })
}

/** Resumen de tareas de todos mis proyectos (para el selector de proyectos). */
export function useCardsSummary() {
  return useQuery({
    queryKey: keys.allCardsSummary,
    queryFn: async () =>
      throwIf(
        await supabase
          .from('cards')
          .select('id, project_id, list_id, due_date, completed_at, card_assignees(user_id)')
          .is('deleted_at', null),
      ) as Pick<CardRow, 'id' | 'project_id' | 'list_id' | 'due_date' | 'completed_at' | 'card_assignees'>[],
  })
}

// ---------------------------------------------------------------------------
// Tablero
// ---------------------------------------------------------------------------
export function useLists(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.lists(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () =>
      throwIf(
        await supabase.from('lists').select('*').eq('project_id', projectId!).is('deleted_at', null).order('position'),
      ) as List[],
  })
}

export const CARD_SELECT =
  '*, card_assignees(user_id), card_labels(label_id), attachments(kind, deleted_at), checklist_items(done)'

type RawCard = CardRow & { attachments: { kind: string; deleted_at: string | null }[]; checklist_items: { done: boolean }[] }

export function normalizeCard(c: RawCard): CardRow {
  const all = (c.attachments ?? []).filter((a) => !a.deleted_at)
  const atts = all.filter((a) => a.kind !== 'image')
  const { attachments: _a, checklist_items: _c, ...rest } = c
  return {
    ...rest,
    stickers: rest.stickers ?? [],
    attachments_count: atts.length,
    deliverable_count: atts.filter((a) => a.kind === 'deliverable').length,
    images_count: all.length - atts.length,
    checklist_total: (c.checklist_items ?? []).length,
    checklist_done: (c.checklist_items ?? []).filter((i) => i.done).length,
  }
}

export function useCards(projectId: string | undefined) {
  return useQuery({
    queryKey: keys.cards(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => {
      const rows = throwIf(
        await supabase.from('cards').select(CARD_SELECT).eq('project_id', projectId!).is('deleted_at', null),
      ) as unknown as RawCard[]
      return rows.map(normalizeCard)
    },
  })
}

export function useLabels(projectId?: string) {
  return useQuery({
    queryKey: keys.labels(projectId),
    queryFn: async () => {
      let q = supabase.from('labels').select('*').is('deleted_at', null).order('name')
      if (projectId) q = q.or(`project_id.is.null,project_id.eq.${projectId}`)
      return throwIf(await q) as Label[]
    },
  })
}

/** Todas las tarjetas asignadas a una persona, de todos sus proyectos. */
export function useCardsOfUser(userId: string | undefined) {
  return useQuery({
    queryKey: keys.myCards(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const ids = throwIf(await supabase.from('card_assignees').select('card_id').eq('user_id', userId!)) as { card_id: string }[]
      if (ids.length === 0) return [] as CardRow[]
      const rows = throwIf(
        await supabase
          .from('cards')
          .select(CARD_SELECT)
          .in('id', ids.map((i) => i.card_id))
          .is('deleted_at', null),
      ) as unknown as RawCard[]
      return rows.map(normalizeCard)
    },
  })
}

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------
export function useNotifications() {
  const { user } = useAuth()
  return useQuery({
    queryKey: keys.notifications,
    enabled: !!user,
    queryFn: async () =>
      throwIf(
        await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
      ) as Notification[],
  })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return
      throwIf(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).select('id'))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  })
}

// ---------------------------------------------------------------------------
// Realtime: cuando otra persona cambia algo del proyecto, refrescamos la caché.
// ---------------------------------------------------------------------------
export function useRealtimeProject(projectId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!projectId) return
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: keys.cards(projectId) })
      qc.invalidateQueries({ queryKey: keys.lists(projectId) })
    }
    const channel = supabase
      .channel(`project:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `project_id=eq.${projectId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists', filter: `project_id=eq.${projectId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_assignees' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_labels' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, invalidate)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, qc])
}

export function useRealtimeNotifications() {
  const qc = useQueryClient()
  const { user } = useAuth()
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: keys.notifications }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, qc])
}
