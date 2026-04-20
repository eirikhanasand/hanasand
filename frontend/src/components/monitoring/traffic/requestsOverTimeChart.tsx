export default function RequestsOverTimeChart({ data }: { data: { key: string, count: number }[] }) {
    if (!data || data.length === 0) {
        return <div className='p-4 text-sm text-muted-foreground'>No data available</div>
    }

    const width = 620
    const height = 132
    const padding = { top: 10, right: 10, bottom: 20, left: 35 }

    const maxCount = Math.max(...data.map(d => d.count))
    const minCount = 0

    function xScale(index: number) {
        return (index / (data.length - 1)) * (width - padding.left - padding.right) + padding.left
    }

    function yScale(count: number) {
        return height - padding.bottom - ((count - minCount)
            / (maxCount - minCount || 1)) * (height - padding.top - padding.bottom)
    }

    const points = data.map((d, i) => `${xScale(i)},${yScale(d.count)}`).join(' ')
    const areaPoints = `${xScale(0)},${height - padding.bottom} ${points} ${xScale(data.length - 1)},${height - padding.bottom}`

    const yTicks = []
    const numYTicks = 3
    for (let i = 0; i <= numYTicks; i++) {
        const count = minCount + (maxCount - minCount) * (i / numYTicks)
        yTicks.push({ count: Math.round(count), y: yScale(count) })
    }

    const xTicks = []
    const numXTicks = 6
    const step = Math.max(1, Math.floor((data.length - 1) / (numXTicks - 1)))
    for (let i = 0; i < data.length; i += step) {
        xTicks.push({ index: i, x: xScale(i), label: data[i].key })
    }

    function parseDate(str: string) {
        let d = new Date(str)
        if (isNaN(d.getTime())) {
            d = new Date(str.replace(' ', 'T'))
        }

        return isNaN(d.getTime()) ? null : d
    }

    const startDate = parseDate(data[0]?.key || '')
    const endDate = parseDate(data[data.length - 1]?.key || '')
    const showDate = startDate && endDate && (endDate.getTime() - startDate.getTime() > 86400000)

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className='w-full h-auto overflow-visible'>
            <defs>
                <linearGradient id='chartGradient' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#3b82f6' stopOpacity='0.2' />
                    <stop offset='100%' stopColor='#3b82f6' stopOpacity='0' />
                </linearGradient>
            </defs>

            {yTicks.map((tick, i) => (
                <line
                    key={`y-grid-${i}`}
                    x1={padding.left}
                    y1={tick.y}
                    x2={width - padding.right}
                    y2={tick.y}
                    stroke='currentColor'
                    strokeOpacity={0.1}
                    strokeDasharray='4 4'
                />
            ))}

            <polygon points={areaPoints} fill='url(#chartGradient)' />

            <polyline
                points={points}
                fill='none'
                stroke='#3b82f6'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
            />

            {data.length < 30 && data.map((d, i) => (
                <circle key={i} cx={xScale(i)} cy={yScale(d.count)} r={3} fill='#3b82f6' />
            ))}

            {yTicks.map((tick, i) => (
                <text
                    key={`y-label-${i}`}
                    x={padding.left - 8}
                    y={tick.y + 3}
                    textAnchor='end'
                    className='text-[10px] fill-current opacity-70'
                    style={{ fontSize: '10px' }}
                >
                    {tick.count}
                </text>
            ))}

            {xTicks.map((tick, i) => {
                const date = parseDate(tick.label)
                let label: string
                if (date) {
                    if (showDate) {
                        label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    } else {
                        label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                } else {
                    const parts = tick.label.split(' ')
                    label = parts.length > 1 ? parts[1] : tick.label.substring(0, 10)
                }

                return (
                    <text
                        key={`x-label-${i}`}
                        x={tick.x}
                        y={height - padding.bottom + 15}
                        textAnchor='middle'
                        className='text-[10px] fill-current opacity-70'
                        style={{ fontSize: '10px' }}
                    >
                        {label}
                    </text>
                )
            })}
        </svg>
    )
}
