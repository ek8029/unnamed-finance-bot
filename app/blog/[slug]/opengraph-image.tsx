import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getPostBySlug } from '@/lib/blog';

export const alt = 'Helm Terminal Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.title || 'Helm Terminal';
  const author = post?.author || 'Evan Kim';

  const logoData = await readFile(join(process.cwd(), 'public', 'helm-logo.png'));
  const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0A',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 72px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top: logo + tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src={logoBase64} width={40} height={40} alt="" />
          <span style={{ color: '#8A8A8A', fontSize: '16px', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>
            Helm Terminal
          </span>
        </div>

        {/* Middle: title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px' }}>
          <h1 style={{ color: '#FAFAFA', fontSize: title.length > 60 ? '40px' : '52px', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.03em', margin: 0 }}>
            {title}
          </h1>
        </div>

        {/* Bottom: author + gold bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#8A8A8A', fontSize: '18px' }}>
            {author} · helmterminal.dev
          </span>
          <div style={{ width: '80px', height: '3px', background: '#E6B94D', borderRadius: '2px' }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
