/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        primary: "#ff385c",
        "primary-active": "#e00b41",
        ink: "#222222",
        body: "#3f3f3f",
        muted: "#6a6a6a",
        canvas: "#ffffff",
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "14px",
        lg: "20px",
        xl: "32px",
      }
    },
  },
  plugins: [],
}

