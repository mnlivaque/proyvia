import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { keys } from '@/data/keys'
import { useAuth } from '@/auth/AuthProvider'
import { friendlyError } from '@/lib/errors'
import { extensionFor, IMAGE_BUCKET, prepareImage, useSignedUrls } from '@/lib/images'
import type { Attachment } from '@/types/database'

interface Props {
  projectId: string
  cardId: string
  images: Attachment[]
  coverPath: string | null
  canEdit: boolean
}

/** Imágenes de la tarea: subir, pegar (Ctrl+V), arrastrar, elegir portada y ver en grande. */
export function CardImages({ projectId, cardId, images, coverPath, canEdit }: Props) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [viewer, setViewer] = useState<number | null>(null)
  const { data: urls } = useSignedUrls(images.map((i) => i.storage_path))

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.card(cardId) })
    qc.invalidateQueries({ queryKey: keys.cards(projectId) })
  }

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const first = images.length === 0 && !coverPath
      let firstPath: string | null = null
      for (const file of files) {
        const blob = await prepareImage(file)
        const path = `${projectId}/${cardId}/${crypto.randomUUID()}.${extensionFor(blob.type || file.type)}`
        const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: blob.type || file.type, cacheControl: '3600' })
        if (up.error) throw up.error
        const ins = await supabase.from('attachments').insert({
          card_id: cardId,
          kind: 'image',
          source: 'storage',
          url: `storage://${IMAGE_BUCKET}/${path}`,
          storage_path: path,
          name: file.name || 'Imagen pegada',
          mime_type: blob.type || file.type,
          added_by: user!.id,
        })
        if (ins.error) throw ins.error
        firstPath ??= path
      }
      // La primera imagen de una tarea pasa a ser su portada.
      if (first && firstPath) await supabase.from('cards').update({ cover_path: firstPath }).eq('id', cardId)
    },
    onSuccess: invalidate,
    onError: (e) => setError(friendlyError(e, 'No se pudo subir la imagen.')),
  })

  const setCover = useMutation({
    mutationFn: async (path: string | null) => {
      const { error } = await supabase.from('cards').update({ cover_path: path }).eq('id', cardId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (img: Attachment) => {
      const { error } = await supabase.from('attachments').update({ deleted_at: new Date().toISOString() }).eq('id', img.id)
      if (error) throw error
      if (img.storage_path && img.storage_path === coverPath) await supabase.from('cards').update({ cover_path: null }).eq('id', cardId)
    },
    onSuccess: invalidate,
  })

  function addFiles(list: FileList | File[] | null) {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    setError(null)
    upload.mutate(files)
  }

  // Pegar una imagen (captura de pantalla) con Ctrl+V mientras la tarjeta está abierta.
  useEffect(() => {
    if (!canEdit) return
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (files.length) {
        e.preventDefault()
        addFiles(files)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  })

  return (
    <section
      className={`flex flex-col gap-2 rounded-xl ${dragging ? 'bg-accent-soft outline-2 outline-dashed outline-accent' : ''}`}
      onDragOver={(e) => {
        if (!canEdit) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (canEdit) addFiles(e.dataTransfer.files)
      }}
    >
      <div className="flex items-center gap-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Imágenes</h3>
        {canEdit && <span className="text-xs text-ink-3">arrastra aquí, pega con Ctrl+V o usa el botón</span>}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img, i) => {
            const url = img.storage_path ? urls?.get(img.storage_path) : undefined
            const isCover = !!img.storage_path && img.storage_path === coverPath
            return (
              <figure key={img.id} className="group relative overflow-hidden rounded-[10px] border border-line bg-ground">
                <button type="button" onClick={() => setViewer(i)} className="block aspect-[4/3] w-full" aria-label={`Ver ${img.name}`}>
                  {url ? <img src={url} alt={img.name} className="size-full object-cover" loading="lazy" /> : <span className="block size-full animate-pulse bg-line" />}
                </button>
                {isCover && <span className="chip absolute left-1.5 top-1.5 bg-accent text-white">Portada</span>}
                {canEdit && (
                  <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      title={isCover ? 'Quitar de portada' : 'Usar como portada'}
                      aria-label={isCover ? 'Quitar de portada' : 'Usar como portada'}
                      onClick={() => setCover.mutate(isCover ? null : img.storage_path)}
                      className="flex size-7 items-center justify-center rounded-md bg-white/90 text-ink-2 shadow hover:bg-white"
                    >
                      <Star className={`size-3.5 ${isCover ? 'fill-warn text-warn' : ''}`} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="Quitar imagen"
                      aria-label="Quitar imagen"
                      onClick={() => window.confirm('¿Quitar esta imagen de la tarea?') && remove.mutate(img)}
                      className="flex size-7 items-center justify-center rounded-md bg-white/90 text-danger-text shadow hover:bg-white"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </figure>
            )
          })}
        </div>
      )}

      {images.length === 0 && !canEdit && <p className="text-[13px] text-muted">Sin imágenes.</p>}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            <ImagePlus className="size-4 text-accent" aria-hidden="true" /> {upload.isPending ? 'Subiendo…' : 'Añadir imagen'}
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          <span className="text-xs text-muted">PNG, JPG, GIF o WEBP · hasta 10 MB · las fotos grandes se reducen solas</span>
        </div>
      )}
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}

      {viewer !== null && images[viewer] && (
        <Lightbox
          url={images[viewer].storage_path ? urls?.get(images[viewer].storage_path!) : undefined}
          name={images[viewer].name}
          index={viewer}
          total={images.length}
          onPrev={() => setViewer((v) => (v! - 1 + images.length) % images.length)}
          onNext={() => setViewer((v) => (v! + 1) % images.length)}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  )
}

function Lightbox({ url, name, index, total, onPrev, onNext, onClose }: { url?: string; name: string; index: number; total: number; onPrev: () => void; onNext: () => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose, onPrev, onNext])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={name} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
        <X className="size-5" aria-hidden="true" />
      </button>
      {total > 1 && (
        <>
          <button type="button" onClick={onPrev} aria-label="Anterior" className="absolute left-4 flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button type="button" onClick={onNext} aria-label="Siguiente" className="absolute right-4 flex size-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </>
      )}
      <figure className="flex max-h-full max-w-full flex-col items-center gap-2">
        {url ? <img src={url} alt={name} className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain" /> : <span className="text-white">Cargando…</span>}
        <figcaption className="text-sm text-white/80">
          {name} · {index + 1} de {total}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="ml-3 text-white underline">
              Abrir original
            </a>
          )}
        </figcaption>
      </figure>
    </div>
  )
}
