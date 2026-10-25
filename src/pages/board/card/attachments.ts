import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { keys } from '@/data/keys'
import { useAuth } from '@/auth/AuthProvider'
import { fileKind, parseDriveUrl, pickFromDrive, type PickedFile } from '@/lib/drivePicker'
import type { AttachmentKind } from '@/types/database'

export function useAddAttachments(projectId: string, cardId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ kind, files }: { kind: AttachmentKind; files: PickedFile[] }) => {
      if (files.length === 0) return
      const { error } = await supabase.from('attachments').insert(
        files.map((f) => ({
          card_id: cardId,
          kind,
          source: 'drive' as const,
          url: f.url,
          name: f.name,
          drive_file_id: f.id,
          mime_type: f.mimeType,
          icon_url: f.iconUrl,
          added_by: user!.id,
        })),
      )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.card(cardId) })
      qc.invalidateQueries({ queryKey: keys.cards(projectId) })
    },
  })
}

export function useAddLink(projectId: string, cardId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ kind, url, name }: { kind: AttachmentKind; url: string; name?: string }) => {
      const clean = url.trim()
      if (!/^https?:\/\//i.test(clean)) throw new Error('El enlace debe empezar con http:// o https://')
      const drive = parseDriveUrl(clean)
      const label = name?.trim() || (drive ? 'Archivo de Drive' : new URL(clean).hostname.replace(/^www\./, ''))
      const { error } = await supabase.from('attachments').insert({
        card_id: cardId,
        kind,
        source: drive ? ('drive' as const) : ('url' as const),
        url: clean,
        name: label,
        drive_file_id: drive?.id ?? null,
        mime_type: null,
        icon_url: null,
        added_by: user!.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.card(cardId) })
      qc.invalidateQueries({ queryKey: keys.cards(projectId) })
    },
  })
}

export function useRemoveAttachment(projectId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('attachments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.card(cardId) })
      qc.invalidateQueries({ queryKey: keys.cards(projectId) })
    },
  })
}

/** Abre el explorador de Drive (en la carpeta del proyecto si la tiene) y devuelve lo elegido. */
export async function chooseFromDrive(parentFolderId: string | null | undefined, allowOutside: boolean): Promise<PickedFile[]> {
  return pickFromDrive({ parentFolderId: parentFolderId ?? undefined, multiple: true, title: allowOutside ? 'Elige archivos de Drive' : 'Elige archivos de la carpeta del proyecto' })
}

export { fileKind }
