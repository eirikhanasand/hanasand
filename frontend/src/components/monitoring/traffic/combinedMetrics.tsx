import { LucideChartNoAxesGantt } from 'lucide-react'
import { useState } from 'react'
import Bar from './bar'
import type { TrafficMetric, TrafficSlowMetric } from '@/utils/monitoring/types'

export default function CombinedMetrics({ title, data, total }: {
    title: string[],
    data: Array<Array<TrafficMetric | TrafficSlowMetric>>,
    total: number
}) {
    const [index, setIndex] = useState(0)
    const currentData = data[index]
    const currentTitle = title[index]
    const buttonText = `Switch to ${title[1 - index]}`

    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-[0_24px_80px_rgba(0,0,0,0.22)]'>
            <div className='flex justify-between items-center mb-4'>
                <h3 className='text-lg font-semibold text-ui-text'>{currentTitle}</h3>
                <button
                    type='button'
                    onClick={() => setIndex(index === 0 ? 1 : 0)}
                    className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-muted transition hover:border-ui-primary/35 hover:bg-ui-primary/10'
                >
                    <LucideChartNoAxesGantt className='w-4 h-4' />
                    {buttonText}
                </button>
            </div>
            <div className='space-y-2'>
                {currentData.map((entry) => (
                    <Bar
                        key={entry.key}
                        label={entry.key} value={'count' in entry ? (entry.count || 0) : Math.round(entry.avg_time || 0)}
                        total={total} />
                ))}
            </div>
        </div>
    )
}
