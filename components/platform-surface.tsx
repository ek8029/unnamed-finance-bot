'use client';
import { usePathname } from 'next/navigation';

/** Visual scope only. Authentication, data access and routing stay in their existing owners. */
export function PlatformSurface({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const excluded = path === '/' || path.startsWith('/testing') || path.startsWith('/admin');
  const terminal = path.startsWith('/dashboard');
  const auth = ['/login', '/signup', '/forgot-password', '/reset-password', '/mfa-verify'].includes(path);
  return <div className={excluded ? undefined : `helm-platform ${terminal ? 'helm-terminal' : auth ? 'helm-auth-route' : 'helm-public'}`} data-helm-page={path.split('/')[1] || 'home'} data-helm-route={path.split('/')[2] || ''}>{children}</div>;
}
