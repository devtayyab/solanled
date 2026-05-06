import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0066B3",
          50:  "#E6F0F8",
          100: "#CCE1F1",
          200: "#99C3E3",
          300: "#66A5D5",
          400: "#3387C7",
          500: "#0066B3",
          600: "#005290",
          700: "#003D6C",
          800: "#002948",
          900: "#001424",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
