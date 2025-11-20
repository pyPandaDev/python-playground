/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0f172a', // Slate 900
          light: '#1e293b',   // Slate 800
          lighter: '#334155', // Slate 700
        },
        accent: {
          DEFAULT: '#2563eb', // Blue 600
          hover: '#1d4ed8',   // Blue 700
        },
        dark: {
          bg: '#0f172a',      // Slate 900 (Main BG)
          panel: '#1e293b',   // Slate 800 (Panel BG)
          border: '#334155',  // Slate 700 (Borders)
          hover: '#334155',   // Slate 700 (Hover)
        },
      },
    },
  },
  plugins: [],
}
