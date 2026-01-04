/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{html,js}"],
    theme: {
        extend: {
            colors: {
                'bg-dark': '#050505',
                'bg-panel': 'rgba(20, 20, 20, 0.7)',
                'bg-sidebar': 'rgba(10, 10, 10, 0.6)',
                'accent-primary': '#00ff88',
                'accent-secondary': '#00d2ff',
                'text-main': '#ffffff',
                'text-muted': '#888888',
            },
            fontFamily: {
                'outfit': ['Outfit', 'sans-serif'],
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'pulse-glow': 'pulse-glow 2s infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(0, 255, 136, 0.2)' },
                    '50%': { boxShadow: '0 0 40px rgba(0, 255, 136, 0.4)' },
                }
            }
        },
    },
    plugins: [],
}
