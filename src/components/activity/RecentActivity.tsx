import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { keys } from '@/data/keys'
import { useMyProjects, useProfileMap } from '@/data/hooks'
import { Avatar } from '@/components/ui/Avatar'
import { relativeTime } from '@/lib/dates'
import type { Activity } from '@/types/database'
import { describeActivity } from './describe'

export function RecentActivity({ limit = 8, projectId }: { limit?: number; projectId?: string }) {
  const { map } = useProfileMap()
  const { data: projects } = useMyProjects()
  const myIds = (projects ?? []).map((p) => p.id)
  const { data, isLoading } = useQuery({
    queryKey: keys.activity({ limit: String(limit), projectId, mine: projectId ? undefined : myIds.join(',') }),
    enabled: !!projectId || projects !== undefined,
    queryFn: async () => {
      let q = supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(limit)
      if (projectId) q = q.eq('project_id', projectId)
      // En el inicio solo se muestra la actividad de los proyectos propios.
      else if (myIds.length) q = q.in('project_id', myIds)
      else return [] as Activity[]
      const { data, error } = await q
      if (error) throw error
      return data as Activity[]
    },
    staleTime: 15_000,
  })

  return (
    <div className="panel px-4 py-1.5">
      {isLoading && <div className="py-3 text-sm text-muted">Cargando…</div>}
      {data && data.length === 0 && <div className="py-3 text-sm text-muted">Todavía no hay actividad.</div>}
      {(data ?? []).map((a) => {
        const who = a.user_id ? map.get(a.user_id) : undefined
        const project = projects?.find((p) => p.id === a.project_id)
        const text = describeActivity(a, map)
        return (
          <div key={a.id} className="flex items-start gap-2.5 border-t border-ground py-2.5 text-[13px] first:border-0">
            {who ? <Avatar person={who} size={26} /> : <span className="avatar size-[26px] bg-line-2 text-[10px]">?</span>}
            <div className="min-w-0">
              <div>
                <strong>{who?.full_name ?? 'Sistema'}</strong> {text.verb}{' '}
                {a.card_id && a.project_id ? (
                  <Link to={`/p/${a.project_id}/c/${a.card_id}`} className="font-medium text-accent hover:underline">
                    {text.object}
                  </Link>
                ) : (
                  <span className="font-medium">{text.object}</span>
                )}
                {text.extra && <span className="text-ink-3"> {text.extra}</span>}
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                {project?.name ?? ''}
                {project ? ' · ' : ''}
                {relativeTime(a.created_at)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
