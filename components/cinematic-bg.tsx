'use client';

import { InteractiveGrid } from '@/app/landing-effects';

export function CinematicBg({ gridAmbient = true }: { gridAmbient?: boolean } = {}) {
  return (
    <>
      <InteractiveGrid ambient={gridAmbient} />
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[300px] -left-[200px] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(230,185,77,0.06)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[200px] -right-[200px] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(230,185,77,0.04)_0%,transparent_70%)]" />
      </div>
      {/* Scanline overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.015)_2px,rgba(0,0,0,0.015)_4px)]" />
    </>
  );
}
