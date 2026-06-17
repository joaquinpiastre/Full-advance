// Solo cuenta como cliente "Citric" si compra ÚNICAMENTE esa marca (ninguna otra).
export function esSoloCitric(c: { marcas?: string[] | null }): boolean {
  return !!c.marcas && c.marcas.length === 1 && c.marcas[0]?.toUpperCase() === 'CITRIC';
}
