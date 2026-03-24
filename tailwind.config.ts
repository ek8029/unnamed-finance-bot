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
          base:      '#09090B',
          surface:   '#0F1219',
          elevated:  '#151920',
          overlay:   '#1A1E27',
          inset:     '#07070A',
          platinum:  '#FAFAFA',
          secondary: '#6B7080',
          muted:     '#52525B',
          gold:      '#B8914A',
          'gold-hi': '#C9A45E',
          'gold-lo': '#9A7838',
          positive:  '#4ADE80',
          negative:  '#F87171',
          neutral:   '#52525B',
          warning:   '#D4A94E',
        },
        chart: {
          gold:     '#B8914A',
          green:    '#4ADE80',
          red:      '#F87171',
          blue:     '#60A5FA',
          purple:   '#A78BFA',
          teal:     '#34D399',
          amber:    '#FBBF24',
          platinum: '#FAFAFA',
        }
      },
      fontFamily: {
        sans:  ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'sm':   '4px',
        DEFAULT: '6px',
        'md':   '6px',
        'lg':   '8px',
        'xl':   '8px',
        '2xl':  '10px',
        '3xl':  '12px',
        'full': '9999px',
      },
      boxShadow: {
        card:          'var(--shadow-card)',
        'card-hover':  'var(--shadow-card-hover)',
        elevated:      'var(--shadow-elevated)',
        'glow-gold':   'var(--shadow-glow-gold)',
        'glow-green':  'var(--shadow-glow-green)',
        'glow-red':    'var(--shadow-glow-red)',
      },
      backdropBlur: {
        xs: '4px',
        glass: '12px',
        heavy: '20px',
      },
      animation: {
        'slide-in-bottom': 'slide-in-bottom 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in-right':  'slide-in-right 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in':         'fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in-scale':   'fade-in-scale 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-glow':      'pulse-glow 2s ease-in-out infinite',
        'data-pulse':      'data-pulse 4s ease-in-out infinite',
        'blur-in':         'blur-in 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        'glow-pulse':      'glow-pulse 3s ease-in-out infinite',
        'gradient-shift':  'gradient-shift 6s ease infinite',
        'border-glow':     'border-glow 4s ease-in-out infinite',
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
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4' },
          '50%':      { opacity: '0.8' },
        },
        'data-pulse': {
          '0%, 100%': { opacity: '0.85' },
          '50%':      { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
