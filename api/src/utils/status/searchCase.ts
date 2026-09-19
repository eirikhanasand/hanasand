import { recordServiceCheckCase } from './serviceCheckCase.ts'

export function recordSearchCase(result: Parameters<typeof recordServiceCheckCase>[2], query?: Parameters<typeof recordServiceCheckCase>[3], record?: Parameters<typeof recordServiceCheckCase>[4]) {
    return recordServiceCheckCase('threat-intelligence', 'Public search', result, query, record)
}
