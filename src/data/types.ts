import type { Attachment, Card, ChecklistItem, Comment, Label, Profile } from '@/types/database'

/** Tarjeta tal como la pide el tablero: con ids de asignados y etiquetas. */
export interface CardRow extends Card {
  card_assignees: { user_id: string }[]
  card_labels: { label_id: string }[]
  attachments_count?: number
  deliverable_count?: number
  images_count?: number
  checklist_total?: number
  checklist_done?: number
}

/** Tarjeta completa para el modal. */
export interface CardDetail extends Card {
  card_assignees: { user_id: string }[]
  card_labels: { label_id: string }[]
  checklist_items: ChecklistItem[]
  attachments: Attachment[]
  comments: Comment[]
}

export type PersonLite = Pick<Profile, 'id' | 'full_name' | 'color' | 'avatar_url' | 'email' | 'role' | 'approved'>
export type LabelLite = Pick<Label, 'id' | 'name' | 'color' | 'text_color' | 'project_id'>

export interface ProjectSummary {
  total: number
  done: number
  overdue: number
  byList: Record<string, number>
}
