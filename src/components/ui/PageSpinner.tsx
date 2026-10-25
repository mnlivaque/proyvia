export function PageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="size-5 animate-spin rounded-full border-2 border-line-2 border-t-accent" aria-hidden="true" />
        {label}
      </div>
    </div>
  )
}
