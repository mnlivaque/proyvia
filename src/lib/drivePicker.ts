// Google Picker: el usuario navega TODO su Drive (Mi unidad y Unidades compartidas)
// con su propia cuenta de Google y elige archivos o carpetas. Solo lectura
// (scope drive.readonly): Proyvia nunca modifica nada en Drive.
import { env } from './env'

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

export interface PickedFile {
  id: string
  name: string
  url: string
  mimeType: string
  iconUrl: string
  isFolder: boolean
}

declare global {
  interface Window {
    gapi?: { load: (lib: string, cb: () => void) => void }
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: { client_id: string; scope: string; callback: (r: { access_token?: string; error?: string }) => void; prompt?: string }) => {
            requestAccessToken: (o?: { prompt?: string }) => void
          }
        }
      }
      picker: {
        PickerBuilder: new () => PickerBuilder
        ViewId: Record<string, string>
        DocsView: new (viewId?: string) => DocsView
        Feature: Record<string, string>
        Action: { PICKED: string; CANCEL: string }
      }
    }
  }
}

interface DocsView {
  setIncludeFolders: (b: boolean) => DocsView
  setSelectFolderEnabled: (b: boolean) => DocsView
  setParent: (id: string) => DocsView
  setEnableDrives: (b: boolean) => DocsView
  setMimeTypes: (m: string) => DocsView
  setMode: (m: string) => DocsView
}
interface PickerBuilder {
  addView: (v: DocsView | string) => PickerBuilder
  setOAuthToken: (t: string) => PickerBuilder
  setDeveloperKey: (k: string) => PickerBuilder
  setAppId: (id: string) => PickerBuilder
  setLocale: (l: string) => PickerBuilder
  setTitle: (t: string) => PickerBuilder
  enableFeature: (f: string) => PickerBuilder
  setCallback: (cb: (data: { action: string; docs?: Array<Record<string, string>> }) => void) => PickerBuilder
  setOrigin: (o: string) => PickerBuilder
  build: () => { setVisible: (v: boolean) => void }
}

let scriptsReady: Promise<void> | null = null
let accessToken: string | null = null
let tokenExpiry = 0

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(s)
  })
}

async function ensureScripts(): Promise<void> {
  if (!scriptsReady) {
    scriptsReady = (async () => {
      await Promise.all([loadScript('https://apis.google.com/js/api.js'), loadScript('https://accounts.google.com/gsi/client')])
      await new Promise<void>((res) => window.gapi!.load('picker', res))
    })()
  }
  return scriptsReady
}

export function driveConfigured(): boolean {
  return Boolean(env.VITE_GOOGLE_CLIENT_ID && env.VITE_GOOGLE_API_KEY)
}

async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry - 60_000) return accessToken
  await ensureScripts()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error ?? 'Sin permiso para Google Drive'))
        accessToken = r.access_token
        tokenExpiry = Date.now() + 55 * 60_000
        resolve(accessToken)
      },
    })
    client.requestAccessToken({ prompt: accessToken ? '' : 'consent' })
  })
}

export interface PickOptions {
  /** Carpeta del proyecto donde abrir el explorador (si la hay) */
  parentFolderId?: string | null
  /** Solo permitir elegir carpetas (para configurar la carpeta de un proyecto) */
  foldersOnly?: boolean
  multiple?: boolean
  title?: string
}

/** Abre el explorador de Drive. Resuelve con los archivos elegidos o [] si se canceló. */
export async function pickFromDrive(opts: PickOptions = {}): Promise<PickedFile[]> {
  if (!driveConfigured()) throw new Error('Google Drive no está configurado. Pide al administrador que complete la configuración (docs/GOOGLE_DRIVE.md).')
  const token = await getToken()
  const g = window.google!.picker

  const buildView = (viewId?: string) => {
    const v = new g.DocsView(viewId)
    v.setIncludeFolders(true)
    v.setEnableDrives(true)
    if (opts.foldersOnly) {
      v.setSelectFolderEnabled(true)
      v.setMimeTypes('application/vnd.google-apps.folder')
    }
    if (opts.parentFolderId) v.setParent(opts.parentFolderId)
    return v
  }

  return new Promise((resolve) => {
    let builder = new g.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(env.VITE_GOOGLE_API_KEY)
      .setLocale('es')
      .setOrigin(window.location.origin)
      .setTitle(opts.title ?? (opts.foldersOnly ? 'Elige la carpeta del proyecto' : 'Elige archivos de Drive'))
      .addView(buildView())
      .addView(buildView(g.ViewId.DOCS))
      .addView(g.ViewId.RECENTLY_PICKED)
    if (env.VITE_GOOGLE_APP_ID) builder = builder.setAppId(env.VITE_GOOGLE_APP_ID)
    if (opts.multiple) builder = builder.enableFeature(g.Feature.MULTISELECT_ENABLED)
    builder = builder.enableFeature(g.Feature.SUPPORT_DRIVES)

    builder
      .setCallback((data) => {
        if (data.action === g.Action.PICKED) {
          resolve(
            (data.docs ?? []).map((d) => ({
              id: d.id,
              name: d.name,
              url: d.url,
              mimeType: d.mimeType,
              iconUrl: d.iconUrl,
              isFolder: d.mimeType === 'application/vnd.google-apps.folder',
            })),
          )
        } else if (data.action === g.Action.CANCEL) {
          resolve([])
        }
      })
      .build()
      .setVisible(true)
  })
}

/** Nombre legible del tipo de archivo para mostrar en los adjuntos. */
export function fileKind(mime: string | null | undefined, name: string): string {
  const ext = name.split('.').pop()?.toUpperCase() ?? ''
  if (!mime) return ext || 'Enlace'
  if (mime.includes('folder')) return 'Carpeta'
  if (mime.includes('spreadsheet') || /xls/i.test(ext)) return 'XLS'
  if (mime.includes('document') || /doc/i.test(ext)) return 'DOC'
  if (mime.includes('presentation') || /ppt/i.test(ext)) return 'PPT'
  if (mime.includes('pdf')) return 'PDF'
  if (mime.startsWith('image/')) return 'IMG'
  if (/dwg|dxf/i.test(ext)) return 'DWG'
  if (/zip|rar|7z/i.test(ext)) return 'ZIP'
  return ext || 'Archivo'
}

export const KIND_COLORS: Record<string, string> = {
  XLS: '#1D7F3B',
  DOC: '#1E6FD9',
  PPT: '#C2410C',
  PDF: '#C62828',
  IMG: '#7C3AED',
  DWG: '#1E6FD9',
  ZIP: '#6B7280',
  Carpeta: '#D97706',
  Enlace: '#0F766E',
}

/** Detecta si un enlace pegado es de Google Drive y saca el id del archivo. */
export function parseDriveUrl(url: string): { id: string } | null {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|drive\/folders\/|open\?id=)([\w-]+)/) ?? url.match(/docs\.google\.com\/\w+\/d\/([\w-]+)/)
  return m ? { id: m[1] } : null
}
