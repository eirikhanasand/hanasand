import { readLogCatchupSettings } from './catchupLimit.ts'

// A durable pass finishes before the next starts. Busy workers can drain work
// without a five-second idle gap; idle or failed workers still back off.
export function startLogProcessor(processBatch: () => Promise<boolean | undefined>, onError: (error: unknown) => void,
    interval = () => readLogCatchupSettings().intervalMs) {
    let stopped = false, timer: ReturnType<typeof setTimeout>, active: Promise<void> | undefined
    const tick = async () => {
        let delay = 5000
        try { if (await processBatch()) delay = interval() }
        catch (error) { onError(error) }
        if (!stopped) schedule(delay)
    }
    const schedule = (delay: number) => {
        timer = setTimeout(() => { active = tick() }, delay)
        timer.unref()
    }
    schedule(0)
    return async () => { stopped = true; clearTimeout(timer); await active }
}
