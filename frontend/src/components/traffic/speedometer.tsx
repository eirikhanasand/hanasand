import { Cell, Pie, PieChart } from 'recharts'

export default function Speedometer({ name, tps }: { name: string, tps: number }) {

    function getColor(value: number) {
        if (value < 40) return 'var(--ui-success)'
        if (value < 70) return 'var(--ui-warning)'
        return 'var(--ui-danger)'
    }

    const activeColor = getColor(tps)

    const data = [
        { name: 'traffic', value: Math.min(tps, 100) },
        { name: 'rest', value: 100 - Math.min(tps, 100) },
    ]

    return (
        <div className='relative flex h-60 w-full flex-col items-center justify-center rounded-lg border border-ui-border bg-ui-panel p-6 shadow-sm'>
            <div className='mb-4 text-lg font-semibold text-ui-text'>
                {name}
            </div>

            <div className='relative flex h-25 w-full items-end justify-center'>
                <div className='absolute bottom-0 left-1/2 z-10 h-27.5 w-40 translate-x-[-51%] pr-50'>
                    {[...Array(21)].map((_, i) => {
                        const deg = -90 + i * 9
                        const long = i % 5 === 0
                        return (
                            <div
                                key={i}
                                className={`absolute bottom-0 left-1/2 origin-bottom ${long ? 'h-6 w-0.75' : 'h-3 w-0.5'}`}
                                style={{
                                    transform: `rotate(${deg}deg) translateY(-90px)`,
                                    backgroundColor: long
                                        ? 'var(--ui-muted)'
                                        : 'var(--ui-border)',
                                }}
                            />
                        )
                    })}
                </div>

                <div>
                    <PieChart width={224} height={150}>
                        <Pie
                            data={data}
                            startAngle={180}
                            endAngle={0}
                            innerRadius={90.8}
                            outerRadius={112}
                            dataKey='value'
                            stroke='none'
                            cx='50%'
                            cy='105%'
                            isAnimationActive={true}
                            animationDuration={400}
                            animationEasing='ease-out'
                        >
                            {data.map((_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={index === 0 ? activeColor : 'var(--ui-border)'}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </div>

                <div className='absolute inset-0 flex flex-col items-center justify-end pb-4'>
                    <div
                        className='text-4xl font-bold'
                        style={{ color: activeColor }}
                    >
                        {tps.toFixed(1)}
                    </div>
                    <div className='text-sm text-ui-muted'>req/s</div>
                </div>
            </div>
        </div>
    )
}
