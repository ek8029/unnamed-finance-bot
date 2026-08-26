// The lab's palettes. Plain module so both server and client components can
// read the list; the switcher lives in theme-shell.tsx.
export const THEMES = [
  { id: 'paper', name: 'Paper', mode: 'light', line: 'Warm stock, ink, one gold mark. The desk at 7:40 AM.' },
  { id: 'broadsheet', name: 'Broadsheet', mode: 'light', line: 'White, black, one red. Reads like the morning paper.' },
  { id: 'clinical', name: 'Clinical', mode: 'light', line: 'What Orion and Wealthbox users already look at. The control.' },
  { id: 'dusk', name: 'Dusk', mode: 'dark', line: 'Paper after sunset. Same ink, same gold, lamp off.' },
  { id: 'terminal', name: 'Terminal', mode: 'dark', line: 'Helm’s own black and gold, carried over. Brand continuity test.' },
  { id: 'slate', name: 'Slate', mode: 'dark', line: 'Cold blue-black with amber. The institutional desk.' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
