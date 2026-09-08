import { notFound } from 'next/navigation';
import DesignWorkbench from './workbench';

export const metadata = { title: 'Helm | Local design preview', robots: { index: false, follow: false } };
export default function RedesignPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DesignWorkbench />;
}
