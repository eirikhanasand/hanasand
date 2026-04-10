import Metric from './metric'

export default function CPU({ cpu }: { cpu: GPT_CPU }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-lg bg-dark/30 px-3 py-2 outline outline-dark'>
            <h1 className='text-sm text-bright/55'>{cpu.name}</h1>
            <Metric metric={Math.ceil(cpu.load * 100)} />
        </div>
    )
}
