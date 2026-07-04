/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background colors (warm/neutral oklch)
        'bg-0': 'oklch(0.17 0.018 55)',
        'bg-0-deep': 'oklch(0.13 0.015 55)',
        'bg-1': 'oklch(0.21 0.02 55)',
        'bg-2': 'oklch(0.25 0.022 55)',
        'border': 'oklch(0.32 0.02 55 / 0.5)',
        // Text colors
        'text-1': 'oklch(0.96 0.01 55)',
        'text-2': 'oklch(0.68 0.02 55)',
        'text-3': 'oklch(0.52 0.02 55)',
        // Accent
        'accent': '#E8542E',
        'accent-ink': '#1c0f08',
        // Success (scoped to toast only)
        'success-bg': 'oklch(0.24 0.024 145)',
        'success-border': 'oklch(0.4 0.05 145 / 0.5)',
        'success-dot': 'oklch(0.75 0.13 145)',
        'success-text': 'oklch(0.95 0.02 145)',
        // Error (scoped to toast only)
        'error-bg': 'oklch(0.24 0.03 25)',
        'error-border': 'oklch(0.4 0.08 25 / 0.5)',
        'error-dot': 'oklch(0.7 0.18 25)',
        'error-text': 'oklch(0.95 0.02 25)',
      },
      borderRadius: {
        'sm-crate': '10px',
        'md-crate': '16px',
        'lg-crate': '22px',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        'serif-display': ['"Instrument Serif"', 'serif'],
        'mono-label': ['"JetBrains Mono"', 'monospace'],
        'bebas': ['Bebas Neue', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}