// Tipos de la base de datos. Escritos a mano a partir de supabase/migrations.
// Cuando el proyecto esté enlazado se pueden regenerar con:
//   npx supabase gen types typescript --linked > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'admin' | 'member'
export type MemberRole = 'owner' | 'editor' | 'viewer'
export type Priority = 'baja' | 'media' | 'alta' | 'urgente'
export type AttachmentKind = 'reference' | 'deliverable' | 'image'
export type AttachmentSource = 'drive' | 'url' | 'storage'

export interface Profile {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  color: string
  role: UserRole
  approved: boolean
  must_change_password: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
}

export interface OrgSettingsValues {
  order_by_due_date: boolean
  mark_overdue: boolean
  overdue_notice_on_login: boolean
  require_due_date_reason: boolean
  due_date_reason_min_chars: number
  confirm_delete: boolean
  trash_retention_days: number
  notify_due_date_change: boolean
  notify_overdue: boolean
  notify_assignment: boolean
  notify_pending_account: boolean
  weekly_summary: boolean
  sender_email: string
  open_signup: boolean
  require_approval: boolean
  force_password_change: boolean
  google_login: boolean
  session_idle_days: number
  timezone: string
}

export interface OrgSettings {
  id: number
  name: string
  settings: OrgSettingsValues
  updated_at: string
  updated_by: string | null
}

export interface Project {
  id: string
  name: string
  description: string
  color: string
  coordinator_id: string | null
  drive_folder_id: string | null
  drive_folder_name: string | null
  drive_folder_path: string | null
  drive_subfolder_per_card: boolean
  drive_allow_outside: boolean
  archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
}

export interface ProjectMember {
  project_id: string
  user_id: string
  role: MemberRole
  created_at: string
}

export interface List {
  id: string
  project_id: string
  name: string
  position: number
  is_done: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
}

export interface Card {
  id: string
  project_id: string
  list_id: string
  title: string
  description: string
  due_date: string | null
  priority: Priority
  completed_at: string | null
  stickers: string[]
  cover_path: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
}

export interface CardAssignee {
  card_id: string
  user_id: string
  assigned_by: string | null
  created_at: string
}

export interface Label {
  id: string
  project_id: string | null
  name: string
  color: string
  text_color: string
  description: string
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

export interface CardLabel {
  card_id: string
  label_id: string
}

export interface ChecklistItem {
  id: string
  card_id: string
  text: string
  done: boolean
  position: number
  created_at: string
}

export interface Attachment {
  id: string
  card_id: string
  kind: AttachmentKind
  source: AttachmentSource
  url: string
  name: string
  drive_file_id: string | null
  storage_path: string | null
  mime_type: string | null
  icon_url: string | null
  added_by: string | null
  created_at: string
  deleted_at: string | null
}

export interface Comment {
  id: string
  card_id: string
  user_id: string
  body: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface DueDateChange {
  id: string
  card_id: string
  user_id: string
  old_date: string | null
  new_date: string | null
  reason: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  project_id: string | null
  card_id: string | null
  read_at: string | null
  email_sent_at: string | null
  created_at: string
}

export interface Activity {
  id: number
  project_id: string | null
  card_id: string | null
  user_id: string | null
  action: string
  data: Json
  created_at: string
}

export interface TrashItem {
  kind: 'projects' | 'lists' | 'cards' | 'labels' | 'profiles'
  id: string
  title: string
  project_id: string | null
  deleted_at: string
  deleted_by: string | null
  days_left: number
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile>
      org_settings: Table<OrgSettings>
      projects: Table<Project>
      project_members: Table<ProjectMember>
      lists: Table<List>
      cards: Table<Card>
      card_assignees: Table<CardAssignee>
      labels: Table<Label>
      card_labels: Table<CardLabel>
      checklist_items: Table<ChecklistItem>
      attachments: Table<Attachment>
      comments: Table<Comment>
      due_date_changes: Table<DueDateChange>
      notifications: Table<Notification>
      activity: Table<Activity>
    }
    Views: {
      overdue_cards: { Row: Card & { days_overdue: number }; Relationships: [] }
      trash_items: { Row: TrashItem; Relationships: [] }
    }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_approved: { Args: Record<string, never>; Returns: boolean }
      is_member: { Args: { p_project: string }; Returns: boolean }
      can_edit: { Args: { p_project: string }; Returns: boolean }
      change_due_date: { Args: { p_card: string; p_new_date: string | null; p_reason: string }; Returns: undefined }
      soft_delete: { Args: { p_table: string; p_id: string }; Returns: undefined }
      restore_deleted: { Args: { p_table: string; p_id: string }; Returns: undefined }
      approve_user: { Args: { p_user: string; p_role?: string; p_projects?: string[] }; Returns: undefined }
      create_project: { Args: { p_name: string; p_color?: string; p_description?: string }; Returns: string }
      touch_last_seen: { Args: Record<string, never>; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
