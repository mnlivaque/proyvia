import { useState } from 'react'
import { Check, ExternalLink, FolderOpen } from 'lucide-react'
import { useProfiles, useProjects, useUpdateProject } from '@/data/adminHooks'
import { DriveIcon } from '@/components/ui/DriveIcon'
import { driveConfigured, pickFromDrive } from '@/lib/drivePicker'
import { friendlyError } from '@/lib/errors'
import type { Project } from '@/types/database'
import { AdminHeader, Box } from './AdminLayout'

export default function AdminDrivePage() {
  const { data: projects } = useProjects()
  const configured = driveConfigured()

  return (
    <>
      <AdminHeader
        title="Carpetas de Drive por proyecto"
        actions={
          configured ? (
            <span className="flex items-center gap-2 rounded-[10px] border border-[#A7F3D0] bg-ok-soft px-3 py-2 text-[13px] text-ok-ink">
              <Check className="size-4" aria-hidden="true" /> Conexión con Google Drive configurada
            </span>
          ) : (
            <span className="rounded-[10px] border border-[#FDE68A] bg-warn-bg px-3 py-2 text-[13px] text-warn-ink">Google Drive aún no está configurado: sigue docs/GOOGLE_DRIVE.md</span>
          )
        }
      >
        Cada proyecto tiene su carpeta en el Google Drive del equipo. Al adjuntar desde una tarea, el explorador se abre ahí.
      </AdminHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(projects ?? []).filter((p) => !p.archived).map((p) => (
          <ProjectDriveCard key={p.id} project={p} />
        ))}
      </div>

      <Box title="Cómo funciona la conexión">
        <div className="grid grid-cols-1 gap-4 px-4 py-3 text-[13px] leading-relaxed text-ink-3 md:grid-cols-3">
          <div>
            <strong className="text-ink">Solo lectura.</strong> Proyvia ve los nombres y enlaces de los archivos para poder adjuntarlos; no modifica ni borra nada en Drive.
          </div>
          <div>
            <strong className="text-ink">Permisos de Drive mandan.</strong> Si una persona no tiene acceso a un archivo en Drive, tampoco podrá abrirlo desde Proyvia.
          </div>
          <div>
            <strong className="text-ink">Cada quien con su cuenta.</strong> Al adjuntar, cada usuario navega su propio Drive con su cuenta de Google; nadie usa la cuenta de otro.
          </div>
        </div>
      </Box>
    </>
  )
}

function ProjectDriveCard({ project }: { project: Project }) {
  const update = useUpdateProject()
  const { data: profiles } = useProfiles()
  const [error, setError] = useState<string | null>(null)
  const coord = profiles?.find((x) => x.id === project.coordinator_id)
  const has = !!project.drive_folder_id

  async function choose() {
    setError(null)
    try {
      const [folder] = await pickFromDrive({ foldersOnly: true, title: `Carpeta de Drive para ${project.name}` })
      if (!folder) return
      await update.mutateAsync({ id: project.id, patch: { drive_folder_id: folder.id, drive_folder_name: folder.name, drive_folder_path: folder.url } })
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <section className={`panel flex flex-col gap-3 p-4.5 ${has ? '' : 'border-[#FDE68A] bg-warn-bg'}`}>
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-[15px] font-bold">
          <i className="size-2.5 rounded-[3px]" style={{ background: project.color }} /> {project.name}
        </span>
        <span className={`chip ml-auto ${has ? 'bg-ok-soft text-ok-ink' : 'bg-warn-soft text-warn-ink'}`}>{has ? 'Carpeta asignada' : 'Sin carpeta'}</span>
      </div>

      {has ? (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-ground px-3 py-2.5 text-[13px]">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warn-soft">
            <FolderOpen className="size-4 text-warn" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{project.drive_folder_name}</div>
            <div className="truncate text-xs text-muted">Google Drive</div>
          </div>
          {project.drive_folder_path && (
            <a href={project.drive_folder_path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
              Abrir <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-warn-ink">Este proyecto aún no tiene carpeta. Mientras no la tenga, al adjuntar desde una tarea el explorador se abre en la raíz del Drive.</p>
      )}

      {has && (
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" className="accent-accent" checked={project.drive_allow_outside} onChange={(e) => update.mutate({ id: project.id, patch: { drive_allow_outside: e.target.checked } })} />
            Permitir adjuntar archivos de fuera de esta carpeta
          </label>
        </div>
      )}

      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-ink" role="alert">{error}</p>}

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">{coord ? `Coordinador: ${coord.full_name}` : 'Sin coordinador'}</span>
        <button type="button" className={`ml-auto ${has ? 'btn-secondary' : 'btn-primary'}`} onClick={choose} disabled={!driveConfigured() || update.isPending}>
          <DriveIcon className="size-4" /> {has ? 'Cambiar carpeta' : 'Elegir carpeta en Drive'}
        </button>
      </div>
    </section>
  )
}
