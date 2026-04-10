import Metric from './metric'

export default function RAM({ ram }: { ram: GPT_RAM }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-lg bg-dark/30 px-3 py-2 outline outline-dark'>
            <h1 className='text-sm text-bright/55'>{ram.name}</h1>
            <Metric metric={Math.ceil(ram.load * 100)} />
        </div>
    )
}
