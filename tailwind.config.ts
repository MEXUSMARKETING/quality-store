import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#141414",
        night: "#0E0E0E",
        cream: "#FFFFFF",
        panel: "#F6F5F2",
        sand: "#E9E3D6",
        gold: "#C9A24A",
        golddark: "#7A5A12",
        line: "#E2DFD8",
        muted: "#5F5E5A",
        soft: "#BDB9AF",
        // admin v2 palette
        adm: {
          navy: "#17243A",
          navy2: "#22324D",
          blue: "#3478F6",
          link: "#2563D9",
          bg: "#F5F7FB",
          line: "#E5EAF2",
          field: "#D5DCE8",
          text: "#18263C",
          mid: "#3B475C",
          muted: "#5E6B80",
        },
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
