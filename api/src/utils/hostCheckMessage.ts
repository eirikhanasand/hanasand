import type { JsonRule } from './jsonMonitoring.ts'

const usageNames: Record<string, string> = {
    'host.memoryPercent': 'RAM',
    'host.cpuPercent': 'CPU',
    'host.gpus.*.usedPercent': 'GPU',
    'host.storage.*.usedPercent': 'Storage',
}

export function hostCheckMessage(rule: JsonRule, observed: unknown, failed: boolean, inverted = false): string | null {
    if (inverted || typeof observed !== 'number' || !Number.isFinite(observed)) return null
    const name = usageNames[rule.path]
    if (name && rule.operator === 'gt' && rule.aggregate === 'max' && typeof rule.value === 'number') {
        return `${name} usage is ${failed ? 'high' : 'normal'}: ${observed}% used (alert at ${rule.value}%).`
    }
    const sensor = rule.path === 'host.temperatures.*.margin' ? ['Temperature', '°C'] : rule.path === 'host.power.*.margin' ? ['Power usage', ' W'] : null
    if (sensor && rule.operator === 'lt' && rule.aggregate === 'min' && rule.value === 0) {
        if (observed === 0) return `${sensor[0]} is normal: at the alert limit.`
        return `${sensor[0]} is ${failed ? 'high' : 'normal'}: ${Math.abs(observed)}${sensor[1]} ${observed < 0 ? 'above' : 'below'} the alert limit.`
    }
    return null
}

export function isHostThresholdMessage(message: string): boolean {
    return /^(?:(?:RAM|CPU|GPU|Storage) usage|Temperature|Power usage) is high: /.test(message)
}
