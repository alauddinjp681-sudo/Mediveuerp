/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        ink: {
          950: '#060d1f',
          900: '#0a1530',
          850: '#0e1b3b',
          800: '#122246',
          700: '#1b2f5c',
          600: '#2a4175',
        },
        brand: {
          blue: '#1e7bf0',
          sky: '#22b8f0',
          green: '#3ccf6e',
          lime: '#8fe36b',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1e7bf0 0%, #22b8f0 45%, #3ccf6e 100%)',
      },
      boxShadow: {
        glow: '0 10px 40px -12px rgba(34, 184, 240, 0.45)',
      },
    },
  },
  plugins: [],
}
