import packageJson from '../package.json'

// Resolve the real application graph without connecting to production services.
const result = await Bun.build({
    entrypoints: ['src/index.ts'],
    target: 'bun',
    external: Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }),
})
if (!result.success) {
    console.error(...result.logs)
    process.exit(1)
}
console.log('API runtime imports resolve')
