import { Link } from 'react-router-dom'
import { useProfiles } from '@/data/hooks'

export function PendingAccountsBanner() {
  const { data } = useProfiles()
  const pending = (data ?? []).filter((p) => !p.approved)
  if (pending.length === 0) return null
  return (
    <div className="rounded-xl border border-[#FDE68A] bg-warn-bg px-3.5 py-3 text-[13px] leading-relaxed text-warn-ink">
      <strong>
        {pending.length} {pending.length === 1 ? 'persona espera' : 'personas esperan'} aprobación
      </strong>{' '}
      para entrar a Proyvia.{' '}
      <Link to="/admin/usuarios" className="font-semibold text-[#92400E] underline">
        Revisar en Administración →
      </Link>
    </div>
  )
}
