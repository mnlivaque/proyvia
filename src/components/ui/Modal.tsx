import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, subtitle, onClose, children, width = 560 }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-[rgba(17,24,39,.55)] p-4 pt-[5vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className="w-full rounded-2xl bg-surface shadow-[0_24px_60px_rgba(0,0,0,.35)]" style={{ maxWidth: width }}>
        <div className="flex items-start gap-3.5 border-b border-ground px-6 pb-3.5 pt-5">
          <div className="flex-1">
            <h2 className="text-xl font-bold leading-tight">{title}</h2>
            {subtitle && <div className="mt-1 text-[13px] text-muted">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex size-8.5 items-center justify-center rounded-lg bg-ground text-ink-2 hover:bg-line">
            <X className="size-4.5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
