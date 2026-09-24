/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark base — deep petrol ink (not pure black)
        ink: '#0E1719',
        'ink-2': '#152227', // cards / surface
        'ink-3': '#1E2F34', // elevated / hairlines
        // Light base — soft mist (not stark white)
        paper: '#F3F5F4',
        'paper-2': '#FFFFFF', // cards
        'paper-3': '#E4EAE8', // hairlines
        // Brand + semantic — richer
        jade: { DEFAULT: '#2E9E8F', soft: '#3FB0A0', deep: '#1F7A6E' },
        sage: '#6FB98F', // up / long / positive
        clay: '#C77F76', // down / short / loss (soft, not alarm-red)
        brass: '#C9A24B', // "best" / highlight, used sparingly
        // Muted text
        'muted-d': '#8CA3A0', // on dark
        'muted-l': '#5C6B69', // on light
        // Near-ink text on light
        'ink-text': '#16211F',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        md: '4px',
        lg: '6px',
        xl: '8px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(14,23,25,0.04), 0 8px 24px -12px rgba(14,23,25,0.18)',
        float: '0 8px 40px -12px rgba(14,23,25,0.35)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease both',
      },
    },
  },
  plugins: [],
}
