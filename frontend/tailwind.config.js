/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#8B5CF6', // purple-500
                    dark: '#6D28D9', // purple-700
                    light: '#A78BFA', // purple-400
                },
                secondary: {
                    DEFAULT: '#06B6D4', // cyan-500


                    dark: '#0891B2', // cyan-600
                    light: '#22D3EE', // cyan-400
                },
                accent: {
                    DEFAULT: '#EC4899', // pink-500
                    dark: '#DB2777', // pink-600
                    light: '#F472B6', // pink-400
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
