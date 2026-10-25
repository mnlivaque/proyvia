import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { keys } from '@/data/keys'
import { useAuth } from '@/auth/AuthProvider'
import { useProfileMap } from '@/data/hooks'
import { Avatar } from '@/components/ui/Avatar'
import { relativeTime } from '@/lib/dates'
import { describeActivity } from '@/components/activity/describe'
import type { Activity, Comment } from '@/types/database'

export function Comments({ cardId, comments, activity, canEdit }: { cardId: string; comments: Comment[]; activity: Activity[]; canEdit: boolean }) {
  const qc = useQueryClient()
  const { user, profile } = useAuth()
  const { map } = useProfileMap()
  const [body, setBody] = useState('')

  const add = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from('comments').insert({ card_id: cardId, user_id: user!.id, body: text.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setBody('')
      qc.invalidateQueries({ queryKey: keys.card(cardId) })
    },
  })

  // Mezclamos comentarios y actividad en una sola línea de tiempo (más reciente arriba).
  const timeline = [
    ...comments.map((c) => ({ kind: 'comment' as const, at: c.created_at, c })),
    ...activity.map((a) => ({ kind: 'activity' as const, at: a.created_at, a })),
  ].sort((x, y) => y.at.localeCompare(x.at))

  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Comentarios y actividad</h3>
      {canEdit && profile && (
        <form
          className="flex items-start gap-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (body.trim()) add.mutate(body)
          }}
        >
          <Avatar person={profile} size={28} />
          <div className="flex flex-1 flex-col gap-1.5">
            <textarea
              className="input min-h-[40px] resize-y py-2 text-[13px]"
              rows={body ? 3 : 1}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe un comentario…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit()
              }}
            />
            {body && (
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={add.isPending}>
                  Comentar
                </button>
                <button type="button" className="btn-ghost" onClick={() => setBody('')}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </form>
      )}
      <ul className="flex flex-col gap-2.5">
        {timeline.map((t) =>
          t.kind === 'comment' ? (
            <li key={`c-${t.c.id}`} className="flex items-start gap-2.5">
              {map.get(t.c.user_id) && <Avatar person={map.get(t.c.user_id)!} size={28} />}
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="text-[13px]">
                  <strong>{map.get(t.c.user_id)?.full_name ?? 'Alguien'}</strong> <span className="text-muted">· {relativeTime(t.c.created_at)}</span>
                </div>
                <div className="whitespace-pre-wrap text-sm text-ink-2">{t.c.body}</div>
              </div>
            </li>
          ) : (
            <li key={`a-${t.a.id}`} className="flex items-start gap-2.5 text-xs text-muted">
              <span className="w-7 text-center">•</span>
              <span>
                <strong className="text-ink-3">{t.a.user_id ? map.get(t.a.user_id)?.full_name ?? 'Alguien' : 'Sistema'}</strong> {describeActivity(t.a, map).verb}{' '}
                <span>{describeActivity(t.a, map).extra ?? ''}</span> · {relativeTime(t.a.created_at)}
              </span>
            </li>
          ),
        )}
        {timeline.length === 0 && <li className="text-[13px] text-muted">Todavía no hay comentarios.</li>}
      </ul>
    </section>
  )
}
