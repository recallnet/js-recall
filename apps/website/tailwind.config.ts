import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        "2xl": "1512px",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        foregroundLight: "var(--foreground-light)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        mutedLight: "var(--muted-light)",
        gray: "var(--gray)",
      },
      fontFamily: {
        primary: "var(--font-primary)",
        secondary: "var(--font-secondary)",
      },
    },
  },
  plugins: [],
} satisfies Config;
