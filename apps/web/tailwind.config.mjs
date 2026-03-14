/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx,mdx}",
    "./components/**/*.{js,jsx,ts,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        stage: {
          panel: "#05070c",
          line: "#2f3540",
          text: "#ecf0f5",
          muted: "#b7bcc8"
        }
      },
      boxShadow: {
        dialogue: "0 -18px 48px rgba(0, 0, 0, 0.55)",
        stageGlow: "0 28px 80px rgba(0, 0, 0, 0.6)"
      }
    }
  },
  plugins: []
};

export default config;
