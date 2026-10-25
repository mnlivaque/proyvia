import type { Profile } from '@/types/database'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type Person = Pick<Profile, 'full_name' | 'color' | 'avatar_url'>

export function Avatar({ person, size = 28, ring = false, title }: { person: Person; size?: number; ring?: boolean; title?: string }) {
  const fontSize = Math.max(9, Math.round(size * 0.38))
  return (
    <span
      className="avatar"
      title={title ?? person.full_name}
      aria-label={person.full_name}
      style={{
        width: size,
        height: size,
        fontSize,
        background: person.color,
        boxShadow: ring ? '0 0 0 2px #fff' : undefined,
        overflow: 'hidden',
      }}
    >
      {person.avatar_url ? (
        <img src={person.avatar_url} alt="" width={size} height={size} className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials(person.full_name)
      )}
    </span>
  )
}

export function AvatarStack({ people, size = 26, max = 4 }: { people: Person[]; size?: number; max?: number }) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <span className="inline-flex">
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar person={p} size={size} ring />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="avatar"
          style={{ width: size, height: size, fontSize: 10, marginLeft: -8, background: '#E5E7EB', color: '#374151', boxShadow: '0 0 0 2px #fff' }}
        >
          +{rest}
        </span>
      )}
    </span>
  )
}
