import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { DriveIcon } from '@/components/ui/DriveIcon'
import { friendlyError } from '@/lib/errors'
import { driveConfigured } from '@/lib/drivePicker'
import type { Project } from '@/types/database'
import { chooseFromDrive, useAddAttachments, useAddLink } from './attachments'

/** Al pasar una tarea a "Terminado" sin entregable: pedimos el enlace de dónde quedó el resultado. */
export function DeliverablePrompt({ projectId, cardId, project, onDone, onCancel }: { projectId: string; cardId: string; project: Project; onDone: () => void; onCancel: () => void }) {
  const addFiles = useAddAttachments(projectId, cardId)
  const addLink = useAddLink(projectId, cardId)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const busy = addFiles.isPending || addLink.isPending

  async function fromDrive() {
    setError(null)
    try {
      const files = await chooseFromDrive(project.drive_folder_id, project.drive_allow_outside)
      if (files.length === 0) return
      await addFiles.mutateAsync({ kind: 'deliverable', files })
      onDone()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  async function fromLink() {
    setError(null)
    try {
      await addLink.mutateAsync({ kind: 'deliverable', url })
      onDone()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <Modal title="¿Dónde quedó el entregable?" subtitle="Para marcar la tarea como terminada, indica en qué carpeta o archivo de Drive dejaste el resultado." onClose={onCancel} width={520}>
      <div className="flex flex-col gap-4">
        {driveConfigured() && (
          <button type="button" className="btn-primary py-2.5" onClick={fromDrive} disabled={busy}>
            <DriveIcon /> Elegir en Drive{project.drive_folder_name ? ` (abre en ${project.drive_folder_name})` : ''}
          </button>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="label">O pega el enlace</span>
          <div className="flex gap-2">
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" />
            <button type="button" className="btn-secondary shrink-0" onClick={fromLink} disabled={busy || !url.trim()}>
              Guardar
            </button>
          </div>
        </div>
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}
        <div className="flex justify-between text-[13px]">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar, dejarla donde estaba
          </button>
          <button type="button" className="text-muted underline" onClick={onDone}>
            Terminar sin entregable
          </button>
        </div>
      </div>
    </Modal>
  )
}
