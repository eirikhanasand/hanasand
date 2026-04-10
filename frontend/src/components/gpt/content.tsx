import type { ReactNode } from 'react'
import { Bot, Cpu, Gauge, HardDrive, MemoryStick } from 'lucide-react'
import DisplayClient from './displayClient'
import Metric from './metric'

export default function GPT_Content({
    clients,
    onTestClient,
}: {
    clients: GPT_Client[]
    onTestClient: (client: GPT_Client) => void
}) {
    const averageLoad = (values: number[]) => values.length
        ? Math.ceil(values.reduce((sum, value) => sum + value, 0) / values.length)
        : 0
    const averageValue = (values: number[]) => values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0

    const totalLoad = {
        ram: averageLoad(clients.map(client => averageLoad(client.ram.map(ram => ram.load * 100)))),
        cpu: averageLoad(clients.map(client => averageLoad(client.cpu.map(cpu => cpu.load * 100)))),
        gpu: averageLoad(clients.map(client => averageLoad(client.gpu.map(gpu => gpu.load * 100)))),
        tps: averageValue(clients.map(client => client.model.tps || 0)),
    }

    return (
        <div className='w-full space-y-4'>
            <div className='grid w-full gap-4 md:grid-cols-2 xl:grid-cols-5'>
                <SummaryCard title='RAM load' icon={<MemoryStick className='h-4 w-4' />} metric={totalLoad.ram} />
                <SummaryCard title='CPU load' icon={<Cpu className='h-4 w-4' />} metric={totalLoad.cpu} />
                <SummaryCard title='GPU load' icon={<HardDrive className='h-4 w-4' />} metric={totalLoad.gpu} />
                <ThroughputCard tps={totalLoad.tps} />
                <div className='rounded-2xl border border-login-100/10 bg-login-900/50 p-4'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-[0.18em] text-login-200'>Active clients</p>
                            <h2 className='mt-2 text-2xl font-semibold text-login-50'>{clients.length}</h2>
                        </div>
                        <div className='rounded-full bg-login/10 p-3 text-login'>
                            <Bot className='h-5 w-5' />
                        </div>
                    </div>
                    <p className='mt-3 text-sm text-login-100'>
                        Click any client card below to open its per-device RAM, CPU, and GPU metrics.
                    </p>
                </div>
            </div>

            <div className='w-full rounded-2xl border border-login-100/10 bg-login-900/50 p-4 space-y-4'>
                <div className='flex items-center justify-between'>
                    <h2 className='text-lg font-semibold text-login-50'>Clients</h2>
                    <span
                        className='rounded-full border border-login-100/10 bg-login-50/5 px-3 py-1
                            text-xs font-medium uppercase tracking-[0.16em] text-login-200'
                    >
                        Live telemetry
                    </span>
                </div>
                <div className='grid w-full gap-4'>
                    {clients.map((client) => (
                        <DisplayClient
                            key={client.name}
                            client={client}
                            onTestClient={onTestClient}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function SummaryCard({ title, icon, metric }: { title: string, icon: ReactNode, metric: number }) {
    return (
        <div className='rounded-2xl border border-login-100/10 bg-login-900/50 p-4'>
            <div className='flex items-center justify-between text-login-200'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>{title}</span>
                {icon}
            </div>
            <div className='mt-3 flex items-end justify-between gap-4'>
                <Metric metric={metric} size='lg' />
                <div className='h-2 flex-1 rounded-full bg-login-50/5'>
                    <div
                        className='h-full rounded-full bg-login transition-[width]'
                        style={{ width: `${Math.min(metric, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    )
}

function ThroughputCard({ tps }: { tps: number }) {
    return (
        <div className='rounded-2xl border border-login-100/10 bg-login-900/50 p-4'>
            <div className='flex items-center justify-between text-login-200'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Throughput</span>
                <Gauge className='h-4 w-4' />
            </div>
            <div className='mt-3 flex items-end justify-between gap-4'>
                <span className='text-2xl font-semibold text-login-50'>{tps.toFixed(1)} TPS</span>
                <div className='text-right text-xs uppercase tracking-[0.18em] text-login-200'>
                    Live generation
                </div>
            </div>
        </div>
    )
}
