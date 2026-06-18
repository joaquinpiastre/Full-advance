import { MetodoPago } from '../types';

export const METODOS_PAGO: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia_hecha', label: 'Transferencia hecha' },
  { value: 'transferencia_por_hacer', label: 'Transferencia por hacer' },
  { value: 'cuenta_corriente', label: 'Cuenta corriente' },
  { value: 'cheque', label: 'Cheque' },
];

export const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia_hecha: 'Transferencia hecha',
  transferencia_por_hacer: 'Transferencia por hacer',
  cuenta_corriente: 'Cuenta corriente',
  cheque: 'Cheque',
};

export const METODO_COLOR: Record<MetodoPago, string> = {
  efectivo: '#16A34A',
  transferencia_hecha: '#0EA5E9',
  transferencia_por_hacer: '#F59E0B',
  cuenta_corriente: '#7C3AED',
  cheque: '#DC2626',
};
