const DIACRITICOS = /[̀-ͯ]/g;

export function normalizarTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .trim();
}

// Levenshtein distance capped at maxDist for performance
function editDistance(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = a[i - 1] === b[j - 1]
        ? row[j - 1]
        : 1 + Math.min(row[j - 1], row[j], next[j - 1]);
      next[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDist) return maxDist + 1; // early exit: whole row exceeds threshold
    row = next;
  }
  return row[b.length];
}

// Returns true if all characters of `needle` appear in order inside `haystack`
function esSubsecuencia(needle: string, haystack: string): boolean {
  let ni = 0;
  for (let hi = 0; hi < haystack.length && ni < needle.length; hi++) {
    if (needle[ni] === haystack[hi]) ni++;
  }
  return ni === needle.length;
}

// Per-word fuzzy tolerance: scales with query word length
function tolerancia(len: number): number {
  if (len >= 7) return 2; // "fernandez" → allows 2 typos
  if (len >= 4) return 1; // "gomes" → matches "gomez"
  return 0;              // short words must match exactly
}

/**
 * Fuzzy multi-word search. Returns true when ALL query words match against
 * the combined fields via any of these strategies (in order of cost):
 *  1. Exact substring — "san" matches "San Rafael"
 *  2. Subsequence    — "fdz" matches "fernandez" (abbreviations)
 *  3. Edit distance  — "gomez" matches "gomes", "fernanod" matches "fernando"
 */
export function coincideBusqueda(query: string, ...campos: (string | null | undefined)[]): boolean {
  const palabrasQuery = normalizarTexto(query).split(/\s+/).filter(Boolean);
  if (!palabrasQuery.length) return true;

  const textoCompleto = campos.map(normalizarTexto).join(' ');
  const palabrasTexto = textoCompleto.split(/\s+/).filter(Boolean);

  return palabrasQuery.every((q) => {
    // 1. Substring (fastest, handles prefixes/suffixes/middles)
    if (textoCompleto.includes(q)) return true;

    // 2. Subsequence: all chars of q appear in order inside any single text word
    if (q.length >= 2 && palabrasTexto.some((t) => esSubsecuencia(q, t))) return true;

    // 3. Fuzzy edit distance against each text word
    const tol = tolerancia(q.length);
    if (tol > 0 && palabrasTexto.some((t) => editDistance(q, t, tol) <= tol)) return true;

    return false;
  });
}
