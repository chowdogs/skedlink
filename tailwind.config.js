/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        }
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
      },
      boxShadow: {
        'brand': '0 4px 24px -4px rgba(99, 102, 241, 0.35)',
        'brand-sm': '0 2px 12px -2px rgba(99, 102, 241, 0.25)',
        'card': '0 1px 3px 0 rgba(0,0,0,0.04), 0 4px 16px -4px rgba(0,0,0,0.06)',
      }
    },
  },
  plugins: [],
}
