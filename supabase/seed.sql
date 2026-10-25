-- Proyvia · datos de ejemplo para desarrollo local (NO ejecutar en producción).
-- Etiquetas globales iniciales.
insert into public.labels (project_id, name, color, text_color, description) values
  (null, 'Plano',        '#DBEAFE', '#1E3A8A', 'Elaboración o corrección de planos CAD'),
  (null, 'Padrón',       '#FEF3C7', '#78350F', 'Trabajo en el padrón consolidado y DT'),
  (null, 'Campo',        '#DCFCE7', '#14532D', 'Salidas a campo, levantamientos, verificaciones'),
  (null, 'Urgente',      '#FEE2E2', '#991B1B', 'Debe atenderse hoy'),
  (null, 'Coordinación', '#E0E7FF', '#3730A3', 'Reuniones, oficios, respuestas a entidades'),
  (null, 'Informe',      '#E0E7FF', '#3730A3', 'Informes de avance y entregables escritos')
on conflict do nothing;
