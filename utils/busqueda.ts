// Utilidades de búsqueda: ignoran mayúsculas/minúsculas y acentos, y permiten
// buscar por varias palabras en cualquier orden (cada palabra puede coincidir
// con cualquier parte de cualquier campo, incluida una continuación).

const DIACRITICOS = /[̀-ͯ]/g;

export function normalizarTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(DIACRITICOS, '') // quita acentos/diacríticos
    .toLowerCase()
    .trim();
}

// Devuelve true si todas las palabras de `query` aparecen (como substring,
// en cualquier orden) en alguno de los `campos` provistos.
export function coincideBusqueda(query: string, ...campos: (string | null | undefined)[]): boolean {
  const palabras = normalizarTexto(query).split(/\s+/).filter(Boolean);
  if (!palabras.length) return true;

  const textoCompleto = campos.map(normalizarTexto).join(' ');
  return palabras.every((palabra) => textoCompleto.includes(palabra));
}
