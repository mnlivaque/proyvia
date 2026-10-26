import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export const IMAGE_BUCKET = 'card-images'
const MAX_SIDE = 1920
const MAX_BYTES = 10 * 1024 * 1024

/** URLs firmadas (1 hora) para varias imágenes en una sola petición; se cachean 50 min. */
export function useSignedUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))].sort()
  return useQuery({
    queryKey: ['signed-urls', list],
    enabled: list.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(list, 3600)
      if (error) throw error
      const map = new Map<string, string>()
      for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl)
      return map
    },
  })
}

/** Reduce fotos grandes (máx. 1920 px de lado) antes de subirlas. Los GIF se suben tal cual. */
export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Solo se pueden subir imágenes (PNG, JPG, GIF o WEBP).')
  if (file.type === 'image/gif') {
    if (file.size > MAX_BYTES) throw new Error('El GIF pesa más de 10 MB.')
    return file
  }
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= 2 * 1024 * 1024) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.85))
  if (!blob) return file
  if (blob.size > MAX_BYTES) throw new Error('La imagen pesa más de 10 MB incluso reducida.')
  return blob
}

export function extensionFor(type: string): string {
  return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }[type] ?? 'jpg'
}
