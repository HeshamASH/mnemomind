/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // Scan the main HTML file
    "./App.tsx",    // Scan the main App component
    "./components/**/*.{js,ts,jsx,tsx}", // Scan all components
    "./services/**/*.{js,ts,jsx,tsx}",    // Scan services if they contain JSX/classes
    "./utils/**/*.{js,ts,jsx,tsx}",       // Scan utils if they contain JSX/classes
    // --- Removed the overly broad pattern ---
    // "./**/*.{js,ts,jsx,tsx}" // This was matching node_modules
  ],
  darkMode: 'class', // Make sure dark mode is enabled if you're using it
  theme: {
    extend: {},
  },
  plugins: [],
}
