import { daysOverdue, isDueSoon } from './dates'

/** Filtro por estado de las tareas, compartido por el tablero y Mis tareas. */
export type StatusFilter = 'all' | 'pending' | 'overdue' | 'week' | 'done' | `list:${string}`

interface StatusCard {
  due_date: string | null
  completed_at: string | null
  list_id: string
}

export function matchesStatus(c: StatusCard, s: StatusFilter): boolean {
  switch (s) {
    case 'all':
      return true
    case 'pending':
      return !c.completed_at
    case 'overdue':
      return daysOverdue(c.due_date, c.completed_at) > 0
    case 'week':
      return isDueSoon(c.due_date, c.completed_at)
    case 'done':
      return !!c.completed_at
    default:
      return c.list_id === s.slice(5)
  }
}

export const STATUS_OPTIONS: { value: StatusFilter; label: string; tone: string }[] = [
  { value: 'all', label: 'Todas', tone: '' },
  { value: 'pending', label: 'Pendientes', tone: '' },
  { value: 'overdue', label: 'Vencidas', tone: 'danger' },
  { value: 'week', label: 'Vencen esta semana', tone: 'warn' },
  { value: 'done', label: 'Terminadas', tone: 'ok' },
]

/** Normaliza texto para buscar sin importar tildes ni mayúsculas. */
export function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
