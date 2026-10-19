/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#090a0f',
        surface: {
          50: '#1e212b',
          100: '#171922',
          200: '#12141a',
          300: '#0e1015',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-hover': 'rgba(255, 255, 255, 0.16)',
        },
        accent: {
          DEFAULT: '#7c3aed',
          hover: '#6d28d9',
          glow: 'rgba(124, 58, 237, 0.35)',
          electric: '#8b5cf6',
          cyan: '#06b6d4',
          emerald: '#10b981',
          amber: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 25px rgba(124, 58, 237, 0.25)',
        'glow-cyan': '0 0 25px rgba(6, 182, 212, 0.25)',
        'subtle': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
