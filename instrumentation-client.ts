/**
 * HeyCatch analytics — client entry point.
 *
 * Next.js runs `instrumentation-client` on the client before hydration, which
 * is the placement HeyCatch specifies for Next >= 15.3. This project is on
 * 16.3, so the older pattern (a 'use client' component mounted in the root
 * layout) is not needed.
 *
 * Separate from `instrumentation.ts`, which is the SERVER hook and runs the
 * Supabase auth health check. Next treats the two filenames as different
 * entry points; they do not interact.
 *
 * The project key is a publishable (`hck_pk_`) key. It is compiled into the
 * client bundle by design, the same way the Plausible script id in
 * app/layout.tsx is, so there is nothing gained by moving it to an env var.
 */
import { analytics } from '@heycatch/sdk';

analytics.init({
  projectKey: 'hck_pk_kNWRjFsW7g60x2p7k42dPMBj8FoRuDvj',
  install: {
    framework: 'nextjs',
    frameworkVersion: '16',
    agent: 'claude-code',
  },
});
