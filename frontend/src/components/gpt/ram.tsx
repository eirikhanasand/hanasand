import Metric from './metric'

export default function RAM({ ram }: { ram: GPT_RAM }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
            <h1 className='text-sm text-ui-muted'>{ram.name}</h1>
            <Metric metric={Math.ceil(ram.load * 100)} />
        </div>
    )
}
