/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    screens: {
      'xs': '515px',     // 2 columnas
      'sm': '640px',     // 2 columnas
      'md': '950px',     // 3 columnas
      'lg': '1240px',    // 4 columnas
      'xl': '1600px',    // 5 columnas
      '2xl': '1920px',   // 6 columnas
      'ultra': '2560px', // 7 columnas
    },
    extend: {},
  },
  plugins: [],
}

