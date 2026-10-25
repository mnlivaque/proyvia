import { useEffect, useRef } from 'react'

// Cloudflare Turnstile: verificación anti-bots sin fricción (punto 7).
// El token se pasa a Supabase Auth, que lo valida con la clave secreta.
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
    }
  }
}

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let widgetId: string | null = null
    let cancelled = false

    const render = () => {
      if (cancelled || !ref.current || !window.turnstile) return
      widgetId = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        language: 'es',
        theme: 'light',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    }

    if (window.turnstile) {
      render()
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.onload = render
      document.head.appendChild(script)
    }

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [siteKey, onToken])

  return <div ref={ref} className="min-h-[65px]" />
}
