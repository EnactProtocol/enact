/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0d0d1a",
        surface: "#13131f",
        panel: "#1a1a2e",
        border: "#2a2a40",
        brand: {
          blue: "#2800FF",
          light: "#5A78FF",
          green: "#05F293",
          pink: "#FF7698",
          purple: "#694DFF",
        },
      },
    },
  },
  plugins: [],
};
