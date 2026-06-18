const formatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function formatMoney(n: number | null | undefined): string {
  return formatter.format(n ?? 0);
}
