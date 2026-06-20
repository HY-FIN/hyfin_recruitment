import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hyfin: {
          blue: "#1B3A6B",
          "light-blue": "#2563EB",
          gold: "#C9A227",
          gray: "#F4F5F7",
        },
      },
    },
  },
  plugins: [],
};

export default config;
