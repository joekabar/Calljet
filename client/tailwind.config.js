/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        calljet: {
          50: '#eef5ff',
          100: '#d9e8ff',
          200: '#bcd8ff',
          300: '#8ec0ff',
          400: '#599eff',
          500: '#3478fc',
          600: '#1e59f1',
          700: '#1644de',
          800: '#1838b4',
          900: '#1a338d',
          950: '#152156'
        }
      }
    }
  },
  plugins: []
};
