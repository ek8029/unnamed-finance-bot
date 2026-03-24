import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sovereign Architect palette
        brand: {
          DEFAULT: '#E6B94D',
          light:   '#FFD67A',
          dim:     'rgba(230, 185, 77, 0.1)',
        },
        helm: {
          base:      '#0A0A0A',
          surface:   '#131313',
          elevated:  '#201F1F',
          overlay:   '#2A2A2A',
          inset:     '#060606',
          platinum:  '#FAFAFA',
          secondary: '#737373',
          muted:     '#525252',
          gold:      '#E6B94D',
          'gold-hi': '#FFD67A',
          'gold-lo': '#C4993F',
          positive:  '#4ADE80',
          negative:  '#F87171',
          neutral:   '#525252',
          warning:   '#FBBF24',
        },
        chart: {
          gold:     '#E6B94D',
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
        mono:  ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        'none': '0',
        'sm':   '2px',
        DEFAULT: '4px',
        'md':   '4px',
        'lg':   '6px',
        'xl':   '8px',
        '2xl':  '10px',
        '3xl':  '12px',
        'full': '9999px',
      },
      boxShadow: {
        card:          'var(--shadow-card)',
        'card-hover':  'var(--shadow-card-hover)',
        elevated:      'var(--shadow-elevated)',
        glow:          '0 0 20px rgba(230, 185, 77, 0.15)',
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
