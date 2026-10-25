import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { keys } from './keys'
import type { Activity, OrgSettingsValues, ProjectMember, TrashItem } from '@/types/database'

export { useProfiles, useProjects, useOrgSettings } from './hooks'

/** Todas las membresías (solo el admin las ve todas gracias a RLS). */
export function useMembersOfAll() {
  return useQuery({
    queryKey: ['memberships'],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_members').select('*')
      if (error) throw error
      return data as ProjectMember[]
    },
  })
}

export function useTrash() {
  return useQuery({
    queryKey: keys.trash,
    queryFn: async () => {
      const { data, error } = await supabase.from('trash_items').select('*').order('deleted_at', { ascending: false })
      if (error) throw error
      return data as TrashItem[]
    },
  })
}

export interface ActivityFilters {
  projectId?: string
  userId?: string
  action?: string
  from?: string
  to?: string
  text?: string
  limit: number
}

export function useActivity(f: ActivityFilters) {
  return useQuery({
    queryKey: keys.activity({ ...f, limit: String(f.limit) }),
    queryFn: async () => {
      let q = supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(f.limit)
      if (f.projectId) q = q.eq('project_id', f.projectId)
      if (f.userId) q = q.eq('user_id', f.userId)
      if (f.action) q = q.like('action', `${f.action}%`)
      if (f.from) q = q.gte('created_at', `${f.from}T00:00:00`)
      if (f.to) q = q.lte('created_at', `${f.to}T23:59:59`)
      if (f.text) q = q.ilike('data::text', `%${f.text}%`)
      const { data, error } = await q
      if (error) throw error
      return data as Activity[]
    },
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ settings, name }: { settings: OrgSettingsValues; name?: string }) => {
      const patch: Record<string, unknown> = { settings }
      if (name !== undefined) patch.name = name
      const { error } = await supabase.from('org_settings').update(patch).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from('projects').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: keys.projects })
      qc.invalidateQueries({ queryKey: keys.project(id) })
    },
  })
}
