import Metric from './metric'

export default function GPU({ gpu }: { gpu: GPT_GPU }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-lg bg-dark/30 px-3 py-2 outline outline-dark'>
            <h1 className='text-sm text-bright/55'>{gpu.name}</h1>
            <Metric metric={Math.ceil(gpu.load * 100)} />
        </div>
    )
}
