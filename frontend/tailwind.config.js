/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Definimos 'sans' como Inter y 'arvo' como Arvo
        sans: ["Inter", "sans-serif"],
        arvo: ["Arvo", "serif"],
      },
    },
  },
  plugins: [],
};
