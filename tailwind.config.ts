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
          elevated:  '#111B2E',
          overlay:   '#162036',
          platinum:  '#E8ECF1',
          secondary: '#8A94A6',
          muted:     '#505A6B',
          gold:      '#B8914A',
          'gold-hi': '#C9A45E',
          'gold-lo': '#9A7838',
          positive:  '#38D39F',
          negative:  '#F87171',
          neutral:   '#505A6B',
          warning:   '#D4A94E',
        }
      },
      fontFamily: {
        sans:  ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'sm':   '1px',
        DEFAULT: '2px',
        'md':   '2px',
        'lg':   '2px',
        'xl':   '4px',
        '2xl':  '4px',
        '3xl':  '4px',
        'full': '9999px',
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
