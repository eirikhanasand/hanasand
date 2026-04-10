import Metric from './metric'

export default function CPU({ cpu }: { cpu: GPT_CPU }) {
    return (
        <div className='flex items-center justify-between gap-3 rounded-lg border border-login-100/10 bg-login-900/40 px-3 py-2'>
            <h1 className='text-sm text-login-100'>{cpu.name}</h1>
            <Metric metric={Math.ceil(cpu.load * 100)} />
        </div>
    )
}
