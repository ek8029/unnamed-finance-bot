import { createHmac, timingSafeEqual } from 'node:crypto';

// A capability may only disable this user's exact device token. It cannot
// authenticate, read account data, or enable/reassign a notification token.
export function pushRevokeCapability(userId: string, token: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Push revocation signing is not configured');
  return createHmac('sha256', key).update(JSON.stringify(['helm.push.disable.v1', userId, token])).digest('hex');
}

export function verifyPushRevoke(userId: unknown, token: string, capability: unknown): userId is string {
  if (typeof userId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId)
    || typeof capability !== 'string' || !/^[a-f0-9]{64}$/i.test(capability)) return false;
  try {
    const expected = Buffer.from(pushRevokeCapability(userId, token), 'hex');
    return timingSafeEqual(expected, Buffer.from(capability, 'hex'));
  } catch { return false; }
}
