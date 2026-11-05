import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#141414",
        night: "#0E0E0E",
        cream: "#F5F4F0",
        sand: "#E9E3D6",
        gold: "#C9A24A",
        golddark: "#7A5A12",
        line: "#E2DFD8",
        muted: "#5F5E5A",
        soft: "#BDB9AF",
      },
      fontFamily: {
        sans: ["Heebo", "Arial", "sans-serif"],
        display: ["Rubik", "Heebo", "sans-serif"],
        logo: ["'Playfair Display'", "Georgia", "serif"],
      },
      maxWidth: { site: "1320px" },
    },
  },
  plugins: [],
};
export default config;
