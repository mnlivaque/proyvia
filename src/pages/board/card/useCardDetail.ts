import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { keys } from '@/data/keys'
import type { CardDetail } from '@/data/types'
import type { Activity, DueDateChange } from '@/types/database'

export function useCardDetail(cardId: string | undefined) {
  return useQuery({
    queryKey: keys.card(cardId ?? ''),
    enabled: !!cardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cards')
        .select('*, card_assignees(user_id), card_labels(label_id), checklist_items(*), attachments(*), comments(*)')
        .eq('id', cardId!)
        .single()
      if (error) throw error
      const d = data as unknown as CardDetail
      d.attachments = (d.attachments ?? []).filter((a) => !a.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at))
      d.comments = (d.comments ?? []).filter((c) => !c.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at))
      d.checklist_items = (d.checklist_items ?? []).sort((a, b) => a.position - b.position)
      return d
    },
  })
}

export function useCardHistory(cardId: string | undefined) {
  return useQuery({
    queryKey: [...keys.card(cardId ?? ''), 'history'],
    enabled: !!cardId,
    queryFn: async () => {
      const [act, dd] = await Promise.all([
        supabase.from('activity').select('*').eq('card_id', cardId!).order('created_at', { ascending: false }).limit(40),
        supabase.from('due_date_changes').select('*').eq('card_id', cardId!).order('created_at', { ascending: false }),
      ])
      if (act.error) throw act.error
      if (dd.error) throw dd.error
      return { activity: act.data as Activity[], dueChanges: dd.data as DueDateChange[] }
    },
  })
}
