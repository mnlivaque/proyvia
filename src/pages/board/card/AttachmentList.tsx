import { useState } from 'react'
import { ExternalLink, Link2, Trash2 } from 'lucide-react'
import { DriveIcon } from '@/components/ui/DriveIcon'
import { useProfileMap } from '@/data/hooks'
import { driveConfigured, fileKind, KIND_COLORS } from '@/lib/drivePicker'
import { friendlyError } from '@/lib/errors'
import { relativeTime } from '@/lib/dates'
import type { Attachment, AttachmentKind, Project } from '@/types/database'
import { chooseFromDrive, useAddAttachments, useAddLink, useRemoveAttachment } from './attachments'

interface Props {
  projectId: string
  cardId: string
  kind: AttachmentKind
  items: Attachment[]
  project: Project
  canEdit: boolean
}

const COPY: Record<AttachmentKind, { title: string; hint: string; empty: string; add: string }> = {
  reference: { title: 'Documentos de referencia', hint: 'dónde están los insumos', empty: 'Aún no hay documentos de referencia.', add: 'Elegir en Drive' },
  deliverable: { title: 'Entregable', hint: 'dónde dejaste el resultado · se pide al pasar a "Terminado"', empty: 'Todavía no hay entregable.', add: 'Añadir entregable de Drive' },
}

export function AttachmentList({ projectId, cardId, kind, items, project, canEdit }: Props) {
  const { map } = useProfileMap()
  const addFiles = useAddAttachments(projectId, cardId)
  const addLink = useAddLink(projectId, cardId)
  const remove = useRemoveAttachment(projectId, cardId)
  const [linkMode, setLinkMode] = useState(false)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const c = COPY[kind]

  async function fromDrive() {
    setError(null)
    try {
      const files = await chooseFromDrive(project.drive_folder_id, project.drive_allow_outside)
      if (files.length) await addFiles.mutateAsync({ kind, files })
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  async function saveLink() {
    setError(null)
    try {
      await addLink.mutateAsync({ kind, url, name })
      setUrl('')
      setName('')
      setLinkMode(false)
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  const isDeliverable = kind === 'deliverable'

  return (
    <section className={`flex flex-col gap-2 ${isDeliverable ? 'rounded-xl border border-dashed border-accent-line bg-[#F0FDFA] p-3.5' : ''}`}>
      <div className="flex items-center gap-2.5">
        <h3 className={`text-xs font-bold uppercase tracking-wide ${isDeliverable ? 'text-accent' : 'text-muted'}`}>{c.title}</h3>
        <span className="text-xs text-ink-3">{c.hint}</span>
      </div>

      {items.length === 0 && <p className="text-[13px] text-muted">{c.empty}</p>}
      {items.map((a) => {
        const k = fileKind(a.mime_type, a.name)
        const who = a.added_by ? map.get(a.added_by) : undefined
        return (
          <div key={a.id} className="group flex items-center gap-3 rounded-[10px] border border-line bg-surface px-3 py-2.5">
            {a.icon_url ? (
              <img src={a.icon_url} alt="" width={36} height={36} className="size-9 rounded-lg object-contain p-1" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ background: KIND_COLORS[k] ?? '#6B7280' }}>
                {k.slice(0, 4)}
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium text-ink hover:text-accent">
                {a.name}
              </a>
              <span className="truncate text-xs text-muted">
                {a.source === 'drive' ? 'Google Drive' : new URL(a.url).hostname} · {who?.full_name ?? ''} · {relativeTime(a.created_at)}
              </span>
            </div>
            <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir" className="text-muted hover:text-accent">
              {a.source === 'drive' ? <DriveIcon className="size-4.5" /> : <ExternalLink className="size-4.5" aria-hidden="true" />}
            </a>
            {canEdit && (
              <button type="button" aria-label="Quitar adjunto" onClick={() => remove.mutate(a.id)} className="invisible text-muted hover:text-danger group-hover:visible">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )
      })}

      {canEdit && (
        <div className="flex flex-col gap-2">
          {linkMode ? (
            <form
              className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface p-2.5"
              onSubmit={(e) => {
                e.preventDefault()
                saveLink()
              }}
            >
              <input className="input py-1.5 text-[13px]" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/… o cualquier enlace" />
              <input className="input py-1.5 text-[13px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre para mostrar (opcional)" />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={!url.trim() || addLink.isPending}>
                  Guardar enlace
                </button>
                <button type="button" className="btn-ghost" onClick={() => setLinkMode(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {driveConfigured() && (
                <button type="button" className={isDeliverable ? 'btn-primary' : 'btn-secondary'} onClick={fromDrive} disabled={addFiles.isPending}>
                  <DriveIcon className={`size-4 ${isDeliverable ? '' : 'text-accent'}`} /> {c.add}
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => setLinkMode(true)}>
                <Link2 className="size-4" aria-hidden="true" /> Pegar enlace
              </button>
            </div>
          )}
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}
        </div>
      )}
    </section>
  )
}
