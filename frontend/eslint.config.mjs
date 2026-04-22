import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
    ...nextVitals,
    ...nextTypescript,
    {
        rules: {
            indent: ['error', 4],
        },
    },
]

export default config
