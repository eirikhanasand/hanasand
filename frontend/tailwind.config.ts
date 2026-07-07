import type { Config } from 'tailwindcss'

export default {
    content: [
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}'
    ],
    theme: {
        extend: {
            spacing: {
                '37.5': '9.375rem',
                '45': '11.25rem',
                '70': '17.5rem',
                '77.5': '19.375rem',
                '98': '24.5rem',
                '105': '26.25rem',
                '130': '32.5rem',
                '140': '35rem',
                '170': '42.5rem',
                '175': '43.75rem',
                '180': '45rem',
                '190': '47.5rem',
                '212.5': '53.125rem',
                '215': '53.75rem',
                '245': '61.25rem',
            }
        }
    }
} satisfies Config
