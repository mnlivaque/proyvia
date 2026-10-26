/** Stickers para decorar y marcar tarjetas, como en Trello. Se guardan en cards.stickers (máx. 8). */
export const STICKERS: { s: string; name: string }[] = [
  { s: '✅', name: 'Listo' },
  { s: '⭐', name: 'Destacado' },
  { s: '🔥', name: 'Urgente' },
  { s: '⚠️', name: 'Atención' },
  { s: '🚩', name: 'Bandera' },
  { s: '📌', name: 'Fijado' },
  { s: '💡', name: 'Idea' },
  { s: '🎯', name: 'Objetivo' },
  { s: '🚀', name: 'Lanzamiento' },
  { s: '👍', name: 'Aprobado' },
  { s: '👀', name: 'Revisar' },
  { s: '⏳', name: 'En espera' },
  { s: '🔒', name: 'Bloqueado' },
  { s: '❓', name: 'Duda' },
  { s: '💬', name: 'Conversar' },
  { s: '🐞', name: 'Error' },
  { s: '📐', name: 'Plano' },
  { s: '🗺️', name: 'Mapa' },
  { s: '📄', name: 'Documento' },
  { s: '📊', name: 'Datos' },
  { s: '🏗️', name: 'Obra' },
  { s: '🧭', name: 'Campo' },
  { s: '📞', name: 'Llamar' },
  { s: '🎉', name: 'Celebrar' },
]

export const MAX_STICKERS = 8

export function stickerName(s: string): string {
  return STICKERS.find((x) => x.s === s)?.name ?? 'Sticker'
}
