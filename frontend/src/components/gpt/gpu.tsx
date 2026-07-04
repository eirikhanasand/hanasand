import Metric from './metric'

export default function GPU({ gpu }: { gpu: GPT_GPU }) {
    const details = [
        typeof gpu.memoryUsedMb === 'number' && typeof gpu.memoryTotalMb === 'number'
            ? `${Math.round(gpu.memoryUsedMb / 1024)}/${Math.round(gpu.memoryTotalMb / 1024)} GB`
            : null,
        typeof gpu.powerDrawWatts === 'number' ? `${gpu.powerDrawWatts.toFixed(0)} W` : null,
        typeof gpu.temperatureC === 'number' ? `${gpu.temperatureC.toFixed(0)}°C` : null,
    ].filter(Boolean).join(' • ')

    return (
        <div className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
            <div className='min-w-0'>
                <h1 className='truncate text-sm text-ui-muted'>{gpu.name}</h1>
                {details ? <p className='mt-1 text-xs text-ui-muted'>{details}</p> : null}
            </div>
            <Metric metric={Math.ceil(gpu.load * 100)} />
        </div>
    )
}
