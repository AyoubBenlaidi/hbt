import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        hbt: {
          bg: "#F5F1ED",
          surface: "#FDFBF9",
          "surface-alt": "#FAF8F4",
          border: "#E8E3DD",
          "text-primary": "#2C2416",
          "text-secondary": "#6B6359",
          "text-muted": "#9B8E7F",
          primary: "#1E3A5F",
          "primary-hover": "#17304F",
          accent: "#B85F3F",
          "accent-soft": "#F3E6DE",
          success: "#6B8E5E",
          "success-soft": "#E7F0E9",
          danger: "#A85F5F",
          "danger-soft": "#F6E6E6",
        },
      },
      animation: {
        "fade-in": "fadeInUp 0.7s ease-out forwards",
        "fade-in-delay": "fadeInUp 0.7s ease-out 0.15s forwards",
        "fade-in-delay-2": "fadeInUp 0.7s ease-out 0.3s forwards",
        "float": "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
export default config
