import { createHash } from 'node:crypto';

export function isImportRequestId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

// Existing holdings.id uniqueness makes individual rows safe to replay after a
// timeout, with a separate namespace for every user and each submitted row.
export function manualHoldingId(userId: string, requestId: string, rowIndex: number): string {
  const hex = createHash('sha256').update(JSON.stringify(['helm.manual-import.v1', userId, requestId.toLowerCase(), rowIndex])).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
