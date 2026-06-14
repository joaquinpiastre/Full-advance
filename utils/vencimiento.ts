// Convierte la fecha elegida en el valor que se guarda en fecha_vencimiento:
// si la fecha es hoy o anterior, la mercadería ya está vencida.
export const calcularFechaVencimiento = (fecha: Date | null): string | null => {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha);
  f.setHours(0, 0, 0, 0);
  if (f.getTime() <= hoy.getTime()) return 'Vencida';
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
};
