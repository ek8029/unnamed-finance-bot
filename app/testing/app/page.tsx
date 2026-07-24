// Lab shell home: straight to Research, the headline surface.
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LabShellIndex() {
  if (process.env.NODE_ENV === 'production') notFound();
  redirect('/testing/app/research');
}
