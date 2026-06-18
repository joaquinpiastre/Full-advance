// Las fechas de pago se manejan como texto "DD/MM/AAAA" en la UI y como
// "AAAA-MM-DD" hacia el backend (columnas DATE), sin pasar por el objeto
// Date para evitar corrimientos de un día por zona horaria.

export function isoADDMMAAAA(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function ddmmaaaaAIso(texto: string): string | null {
  const match = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, ddRaw, mmRaw, yyyy] = match;
  const dd = ddRaw.padStart(2, '0');
  const mm = mmRaw.padStart(2, '0');
  const d = Number(dd), m = Number(mm), y = Number(yyyy);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Verifica que sea una fecha real (ej. rechaza 31/02/2024)
  const fecha = new Date(y, m - 1, d);
  if (fecha.getFullYear() !== y || fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export function hoyDDMMAAAA(): string {
  const hoy = new Date();
  const dd = String(hoy.getDate()).padStart(2, '0');
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${hoy.getFullYear()}`;
}
