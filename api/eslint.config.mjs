import config from 'utilbee/eslint'

export default [
    ...config,
    {
        rules: {
            'no-undef': 'off',
            '@stylistic/max-len': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
]
