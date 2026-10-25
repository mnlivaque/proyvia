export const PROJECT_COLORS = ['#2563EB', '#D97706', '#059669', '#DB2777', '#7C3AED', '#0891B2', '#EA580C', '#4F46E5', '#65A30D', '#B45309']

export const PERSON_COLORS = ['#7C3AED', '#0891B2', '#DB2777', '#EA580C', '#65A30D', '#4F46E5', '#0D9488', '#B45309', '#9333EA', '#2563EB']

/** Pares fondo / texto con contraste ≥ 4.5:1 para etiquetas. */
export const LABEL_COLORS: { bg: string; text: string; name: string }[] = [
  { bg: '#DBEAFE', text: '#1E3A8A', name: 'Azul' },
  { bg: '#FEF3C7', text: '#78350F', name: 'Amarillo' },
  { bg: '#DCFCE7', text: '#14532D', name: 'Verde' },
  { bg: '#FEE2E2', text: '#991B1B', name: 'Rojo' },
  { bg: '#E0E7FF', text: '#3730A3', name: 'Índigo' },
  { bg: '#FCE7F3', text: '#9D174D', name: 'Rosa' },
  { bg: '#E5E7EB', text: '#374151', name: 'Gris' },
  { bg: '#CCFBF1', text: '#134E4A', name: 'Turquesa' },
  { bg: '#FFEDD5', text: '#9A3412', name: 'Naranja' },
  { bg: '#EDE9FE', text: '#5B21B6', name: 'Violeta' },
]

export const PRIORITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  baja: { bg: '#E5E7EB', text: '#374151', label: 'Prioridad baja' },
  media: { bg: '#DBEAFE', text: '#1E3A8A', label: 'Prioridad media' },
  alta: { bg: '#FEF3C7', text: '#78350F', label: 'Prioridad alta' },
  urgente: { bg: '#FEE2E2', text: '#991B1B', label: 'Urgente' },
}
