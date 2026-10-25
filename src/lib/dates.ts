import { differenceInCalendarDays, format, isToday, isTomorrow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function parseDate(d: string): Date {
  return parseISO(d)
}

/** "24 oct", "hoy", "mañana" */
export function shortDate(d: string | null | undefined): string {
  if (!d) return 'Sin fecha'
  const date = parseDate(d)
  if (isToday(date)) return 'hoy'
  if (isTomorrow(date)) return 'mañana'
  return format(date, 'd MMM', { locale: es })
}

/** "Sábado 25 de octubre de 2026" */
export function longDate(d: string | null | undefined): string {
  if (!d) return 'Sin fecha'
  const s = format(parseDate(d), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Días de atraso (positivo) si está vencida y sin terminar; 0 si no. */
export function daysOverdue(due: string | null | undefined, completedAt: string | null | undefined): number {
  if (!due || completedAt) return 0
  const diff = differenceInCalendarDays(new Date(), parseDate(due))
  return diff > 0 ? diff : 0
}

export function isOverdue(due: string | null | undefined, completedAt: string | null | undefined): boolean {
  return daysOverdue(due, completedAt) > 0
}

/** Vence hoy o en los próximos 7 días (y no está terminada). */
export function isDueSoon(due: string | null | undefined, completedAt: string | null | undefined): boolean {
  if (!due || completedAt) return false
  const diff = differenceInCalendarDays(parseDate(due), new Date())
  return diff >= 0 && diff <= 7
}

export function relativeTime(iso: string): string {
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  if (isToday(d)) return `hoy ${format(d, 'HH:mm')}`
  const days = differenceInCalendarDays(new Date(), d)
  if (days === 1) return `ayer ${format(d, 'HH:mm')}`
  if (days < 7) return `hace ${days} días`
  return format(d, "d MMM HH:mm", { locale: es })
}

/** Orden de tarjetas dentro de una lista: por fecha límite, de la más antigua a la más reciente; sin fecha al final. */
export function compareByDueDate<T extends { due_date: string | null; created_at: string }>(a: T, b: T): number {
  if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.created_at.localeCompare(b.created_at)
  if (a.due_date) return -1
  if (b.due_date) return 1
  return a.created_at.localeCompare(b.created_at)
}
