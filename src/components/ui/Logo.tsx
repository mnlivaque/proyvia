export function Logo({ size = 30, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="inline-flex items-center justify-center rounded-lg"
        style={{ width: size, height: size, background: light ? '#fff' : 'var(--color-accent)' }}
        aria-hidden="true"
      >
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={light ? '#0F766E' : '#fff'} strokeWidth="2.4" strokeLinecap="round">
          <path d="M5 5h4v14H5zM15 5h4v9h-4z" />
        </svg>
      </span>
      <span className="text-[17px] font-bold tracking-tight" style={{ color: light ? '#fff' : 'var(--color-ink)' }}>
        Proyvia
      </span>
    </span>
  )
}
