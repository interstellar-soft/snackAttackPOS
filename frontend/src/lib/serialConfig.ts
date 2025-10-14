const DEFAULT_SERIAL_PORT_HINT = 'COM4';

const rawHint = import.meta.env.VITE_SERIAL_PORT_HINT;

const normalizedHint =
  typeof rawHint === 'string' && rawHint.trim() !== '' ? rawHint.trim() : DEFAULT_SERIAL_PORT_HINT;

export const SERIAL_PORT_HINT: string | null =
  typeof normalizedHint === 'string' && normalizedHint.trim() !== '' ? normalizedHint : null;
