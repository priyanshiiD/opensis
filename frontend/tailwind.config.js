/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: {
        primary: {
          DEFAULT: '#1A237E',
          50: '#e8eaf6',
          100: '#c5cae9',
          200: '#9fa8da',
          300: '#7986cb',
          400: '#5c6bc0',
          500: '#3f51b5',
          600: '#3949ab',
          700: '#303f9f',
          800: '#283593',
          900: '#1a237e',
        },
        'sgsits-blue': {
          DEFAULT: '#1A237E',
          50: '#e8eaf6',
          100: '#c5cae9',
          200: '#9fa8da',
          300: '#7986cb',
          400: '#5c6bc0',
          500: '#3f51b5',
          600: '#3949ab',
          700: '#303f9f',
          800: '#283593',
          900: '#1a237e',
        },
        'sgsits-gold': {
          DEFAULT: '#D0960E',
          50: '#fefbeb',
          100: '#fdf4c7',
          200: '#fbe78c',
          300: '#f9d54e',
          400: '#f7c223',
          500: '#ecab11',
          600: '#d0960e',
          700: '#a3710b',
          800: '#81560f',
          900: '#694511',
        }
      },
    },
  },
  plugins: [],
};
