/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'verdant': {
          'bg':        '#0a0c0a',
          'sidebar':   '#111411',
          'header':    '#2dba7e',
          'accent':    '#32d583',
          'green-btn': '#1db868',
          'green-card':'#1a9e6a',
          'yellow':    '#f5c542',
          'muted':     '#8a9a8a',
        },
      },
      fontFamily: {
        'mc-big':   ['MinecraftBig', 'monospace'],
        'mc-small': ['MinecraftSmall', 'monospace'],
      },
      backgroundImage: {
        'hero': "url('/src/assets/images/Background.jpg')",
      },
    },
  },
  plugins: [],
}
