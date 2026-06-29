/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./frontend/**/*.{js,ts,svelte}",
  ],
  theme: {
    extend: {
      animation: {
        'spin': 'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
}