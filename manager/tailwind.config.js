/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './renderer.js',
    './renderer-ui.js',
    './renderer-state.js',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: { 750: '#2d3748', 850: '#1a202c', 900: '#111827', 950: '#0d1117' },
        primary: { DEFAULT: '#4f46e5', hover: '#4338ca', light: '#818cf8' },
        success: '#10b981', warning: '#f59e0b', danger: '#ef4444'
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans JP', 'sans-serif']
      }
    }
  },
  plugins: [],
}