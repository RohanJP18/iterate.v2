import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      colors: {
        charcoal: "#2d2d2d",
        accent: "#c75a38",
        "accent-muted": "rgba(199, 90, 56, 0.12)",
        "dot-grid": "rgba(0,0,0,0.06)",
      },
      backgroundImage: {
        "dot-grid":
          "radial-gradient(circle, var(--tw-gradient-stops) 1px, transparent 1px)",
      },
      backgroundSize: {
        "dot-grid": "20px 20px",
      },
    },
  },
  plugins: [],
};

export default config;
