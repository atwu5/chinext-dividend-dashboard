/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#F8F9FC',
        card: '#FFFFFF',
        ink: '#202C40',
        muted: '#8792A5',
        gold: { DEFAULT: '#C5A46D', soft: '#F6F0E3' },
        chinext: '#426997',
        zone: { high: '#E65B64', low: '#20A97B' },
        line: '#E7EAF1',
      },
      boxShadow: {
        card: '0 1px 2px rgba(32, 44, 64, 0.04), 0 10px 28px -14px rgba(32, 44, 64, 0.14)',
        pop: '0 12px 32px -8px rgba(32, 44, 64, 0.28)',
      },
    },
  },
  plugins: [],
}
