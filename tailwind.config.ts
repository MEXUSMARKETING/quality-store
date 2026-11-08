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
        // admin palette: NEXSHOP brand (logo gradient blue #006AFF → violet #7A12FF → magenta #FF01BB)
        adm: {
          navy: "#14102E",
          navy2: "#221A4A",
          blue: "#6C1CF5",
          link: "#5B17E6",
          bg: "#F6F5FB",
          line: "#E8E5F3",
          field: "#D8D3EA",
          text: "#17142E",
          mid: "#3D3858",
          muted: "#615C7A",
        },
        nx: {
          blue: "#006AFF",
          violet: "#7A12FF",
          magenta: "#FF01BB",
          deep: "#0B0820",
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
