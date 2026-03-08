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
          base:      '#0B0B0B',
          surface:   '#111111',
          elevated:  '#171717',
          overlay:   '#1F1F1F',
          platinum:  '#EAEAEA',
          secondary: '#9A9A9A',
          muted:     '#6F6F6F',
          gold:      '#C8A95B',
          'gold-hi': '#D4B96E',
          'gold-lo': '#A08840',
          positive:  '#38D39F',
          negative:  '#F87171',
          neutral:   '#6F6F6F',
          warning:   '#D4A94E',
        }
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      borderColor: {
        'helm-border-subtle': '#1F1F1F',
        'helm-border-base':   '#2A2A2A',
        'helm-border-strong': '#3A3A3A',
      },
      animation: {
        'slide-in-bottom': 'slide-in-bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right':  'slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in':         'fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in-scale':   'fade-in-scale 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'float':           'float 3s ease-in-out infinite',
        'pulse-glow':      'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'slide-in-bottom': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-scale': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4' },
          '50%':      { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
