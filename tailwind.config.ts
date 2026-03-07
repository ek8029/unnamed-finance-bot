import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        helm: {
          base:      '#070C17',
          surface:   '#0C1525',
          elevated:  '#111E34',
          overlay:   '#162035',
          platinum:  '#E8ECF1',
          secondary: '#B4BFCE',  // Lighter for better contrast
          muted:     '#6B7A90',  // Lighter for better contrast
          gold:      '#B8914A',
          'gold-hi': '#CBAA68',
          'gold-lo': '#8A6A35',
          positive:  '#9EC4A8',
          negative:  '#C47A7A',
          neutral:   '#6B7A90',
        }
      },
      fontFamily: {
        sans:  ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-dm-mono)', 'ui-monospace', 'monospace'],
      },
      borderColor: {
        subtle:  'rgba(255,255,255,0.05)',
        base:    'rgba(255,255,255,0.08)',
        strong:  'rgba(255,255,255,0.13)',
      }
    },
  },
  plugins: [],
};
export default config;
