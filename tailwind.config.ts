import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: "#2d2d2d",
        "light-blue": "#7dd3fc",
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
