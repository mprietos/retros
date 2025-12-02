/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        good: "#16a34a",
        bad: "#dc2626",
        idea: "#2563eb"
      }
    }
  },
  plugins: []
};


