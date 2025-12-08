/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "'HK Grotesk'",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "'Helvetica Neue'",
          "sans-serif",
        ],
        mono: ["Menlo", "Consolas", "Monaco", "'Lucida Console'", "monospace"],
      },
      fontSize: {
        tiny: "0.75rem",
        small: "0.875rem",
        normal: "1rem",
        big: "1.125rem",
        bigger: "1.375rem",
        huge: "2rem",
      },
      spacing: {
        "space-1": "8px",
        "space-2": "16px",
        "space-3": "32px",
        "space-4": "64px",
        "space-5": "128px",
      },
      borderRadius: {
        DEFAULT: "5px",
      },
      boxShadow: {
        pop: "0px 2px 5px 0px rgba(0, 0, 0, 0.27), 0px 1px 1px 0px rgba(0, 0, 0, 0.15)",
      },
      colors: {
        // Brand colors
        brand: {
          red: "#FF7698",
          pink: "#FEC1EE",
          blue: "#2800FF",
          lightBlue: "#5A78FF",
          green: "#05F293",
          teal: "#9BE7D8",
          lightTeal: "#D0FFF1",
          yellow: "#FFFF60",
        },
        // Primary (blue dark scale)
        primary: {
          50: "#F0EDFF",
          100: "#BDC9FF",
          200: "#9480FF",
          300: "#694DFF",
          400: "#3E1AFF",
          500: "#2800FF",
          600: "#2000CC",
          700: "#140080",
          800: "#0D0055",
          900: "#06002A",
        },
        // Blue light scale
        blueLight: {
          1: "#BDC9FF",
          2: "#9CAEFF",
          3: "#7B93FF",
          4: "#5A78FF",
          5: "#4860CC",
          6: "#364899",
        },
        blue: {
          100: "#BDC9FF",
          200: "#9CAEFF",
          300: "#7B93FF",
          400: "#5A78FF",
          500: "#4860CC",
          600: "#364899",
        },
        // Teal scale
        teal: {
          100: "#D7F5EF",
          200: "#C3F1E8",
          300: "#AFECE0",
          400: "#9BE7D8",
          500: "#8CD0C2",
          600: "#6DA297",
        },
        // Green scale
        green: {
          100: "#B4FBDF",
          200: "#69F7BE",
          300: "#37F5A9",
          400: "#05F293",
          500: "#05DA84",
          600: "#04C276",
        },
        // Yellow scale
        yellow: {
          100: "#FFFFDF",
          200: "#FFFFBF",
          300: "#FFFFA0",
          400: "#FFFF60",
          500: "#E6E656",
          600: "#CCCC4D",
        },
        // Pink scale
        pink: {
          100: "#FFF3FC",
          200: "#FFE6F8",
          300: "#FED4F3",
          400: "#FEC1EE",
          500: "#E5AED6",
          600: "#CB9ABE",
        },
        // Gray scale
        gray: {
          50: "#FAFAFA",
          100: "#F2F2F2",
          200: "#E0E0E0",
          300: "#BDBDBD",
          400: "#828282",
          500: "#4F4F4F",
          600: "#333333",
          700: "#1F1F1F",
          800: "#141414",
          900: "#0A0A0A",
        },
        // Status colors
        status: {
          good: "#04C276",
          unknown: "#FF8C22",
          bad: "#DA2F47",
        },
        // Warning colors
        warning: {
          light: "#FFF4E6",
          orange: "#FFCC8F",
          red: "#FF7698",
          bg: "#FFE6E6",
        },
        // Editor colors
        editor: {
          1: "#2800FF",
          2: "#4860CC",
          3: "#CD4466",
          4: "#B25099",
          5: "#77770A",
          6: "#3E7A6E",
        },
        // UI colors
        share: "#694DFF",
        badge: "#FF7698",
        dropdown: "#E8F8F4",
      },
      backgroundImage: {
        "gradient-enact":
          "linear-gradient(180deg, hsl(0deg 0% 96%) 0%, hsl(344deg 0% 96%) 11%, hsl(344deg 0% 97%) 22%, hsl(344deg 0% 97%) 33%, hsl(344deg 0% 98%) 44%, hsl(344deg 0% 98%) 56%, hsl(344deg 0% 99%) 67%, hsl(344deg 0% 99%) 78%, hsl(344deg 0% 100%) 89%, hsl(0deg 0% 100%) 100%)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
