import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { keys } from '@/data/keys'
import type { CardRow } from '@/data/types'
import { useAuth } from '@/auth/AuthProvider'

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error
  return res.data as T
}

/** Mover tarjeta a otra lista (optimista). El orden dentro de la lista lo da la fecha límite. */
export function useMoveCard(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cardId, listId }: { cardId: string; listId: string }) =>
      must(await supabase.from('cards').update({ list_id: listId }).eq('id', cardId).select('id').single()),
    onMutate: async ({ cardId, listId }) => {
      await qc.cancelQueries({ queryKey: keys.cards(projectId) })
      const prev = qc.getQueryData<CardRow[]>(keys.cards(projectId))
      qc.setQueryData<CardRow[]>(keys.cards(projectId), (old) => (old ?? []).map((c) => (c.id === cardId ? { ...c, list_id: listId } : c)))
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.cards(projectId), ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.cards(projectId) })
      qc.invalidateQueries({ queryKey: keys.allCardsSummary })
    },
  })
}

export function useCreateCard(projectId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { listId: string; title: string; dueDate?: string | null; assignees?: string[] }) => {
      const card = must(
        await supabase
          .from('cards')
          .insert({ project_id: projectId, list_id: input.listId, title: input.title.trim(), due_date: input.dueDate ?? null, created_by: user!.id })
          .select('id')
          .single(),
      ) as { id: string }
      if (input.assignees?.length) {
        must(await supabase.from('card_assignees').insert(input.assignees.map((u) => ({ card_id: card.id, user_id: u, assigned_by: user!.id }))).select('card_id'))
      }
      return card.id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.cards(projectId) })
      qc.invalidateQueries({ queryKey: keys.allCardsSummary })
    },
  })
}

export function useUpdateCard(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cardId, patch }: { cardId: string; patch: Partial<Pick<CardRow, 'title' | 'description' | 'priority' | 'list_id' | 'completed_at'>> }) =>
      must(await supabase.from('cards').update(patch).eq('id', cardId).select('id').single()),
    onSuccess: (_d, { cardId }) => {
      qc.invalidateQueries({ queryKey: keys.cards(projectId) })
      qc.invalidateQueries({ queryKey: keys.card(cardId) })
      qc.invalidateQueries({ queryKey: keys.allCardsSummary })
    },
  })
}

export function useChangeDueDate(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cardId, newDate, reason }: { cardId: string; newDate: string | null; reason: string }) => {
      const { error } = await supabase.rpc('change_due_date', { p_card: cardId, p_new_date: newDate, p_reason: reason })
      if (error) throw error
    },
    onSuccess: (_d, { cardId }) => {
      qc.invalidateQueries({ queryKey: keys.cards(projectId) })
      qc.invalidateQueries({ queryKey: keys.card(cardId) })
      qc.invalidateQueries({ queryKey: keys.allCardsSummary })
    },
  })
}

export function useToggleAssignee(projectId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ cardId, userId, on }: { cardId: string; userId: string; on: boolean }) => {
      if (on) must(await supabase.from('card_assignees').insert({ card_id: cardId, user_id: userId, assigned_by: user!.id }).select('card_id'))
      else must(await supabase.from('card_assignees').delete().eq('card_id', cardId).eq('user_id', userId).select('card_id'))
    },
    onSuccess: (_d, { cardId }) => {
      qc.invalidateQueries({ queryKey: keys.cards(projectId) })
      qc.invalidateQueries({ queryKey: keys.card(cardId) })
      qc.invalidateQueries({ queryKey: keys.allCardsSummary })
    },
  })
}

export function useToggleLabel(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cardId, labelId, on }: { cardId: string; labelId: string; on: boolean }) => {
      if (on) must(await supabase.from('card_labels').insert({ card_id: cardId, label_id: labelId }).select('card_id'))
      else must(await supabase.from('card_labels').delete().eq('card_id', cardId).eq('label_id', labelId).select('card_id'))
    },
    onSuccess: (_d, { cardId }) => {
      qc.invalidateQueries({ queryKey: keys.cards(projectId) })
      qc.invalidateQueries({ queryKey: keys.card(cardId) })
    },
  })
}

export function useCreateList(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, position }: { name: string; position: number }) =>
      must(await supabase.from('lists').insert({ project_id: projectId, name: name.trim(), position }).select('id').single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.lists(projectId) }),
  })
}

export function useUpdateList(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ listId, patch }: { listId: string; patch: { name?: string; position?: number; is_done?: boolean } }) =>
      must(await supabase.from('lists').update(patch).eq('id', listId).select('id').single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.lists(projectId) }),
  })
}

export function useSoftDelete(projectId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ table, id }: { table: 'projects' | 'lists' | 'cards' | 'labels' | 'profiles'; id: string }) => {
      const { error } = await supabase.rpc('soft_delete', { p_table: table, p_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      if (projectId) {
        qc.invalidateQueries({ queryKey: keys.cards(projectId) })
        qc.invalidateQueries({ queryKey: keys.lists(projectId) })
      }
      qc.invalidateQueries({ queryKey: keys.projects })
      qc.invalidateQueries({ queryKey: keys.labels() })
      qc.invalidateQueries({ queryKey: keys.trash })
      qc.invalidateQueries({ queryKey: keys.allCardsSummary })
    },
  })
}

export function useRestore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await supabase.rpc('restore_deleted', { p_table: table, p_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}
