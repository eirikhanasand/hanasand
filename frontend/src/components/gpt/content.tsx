import type { ReactNode } from 'react'
import { Bot, Cpu, Gauge, HardDrive, MemoryStick, Target, Zap } from 'lucide-react'
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
    const lanes = clients.flatMap(client => client.lanes || [])
    const power = {
        watts: clients.reduce((sum, client) => sum + (client.power?.totalWatts || 0), 0),
        monthlyKwh: clients.reduce((sum, client) => sum + (client.power?.monthlyKwh || 0), 0),
    }
    const capacity = {
        active: lanes.reduce((sum, lane) => sum + lane.activeRequests, 0),
        max: lanes.reduce((sum, lane) => sum + lane.maxRequests, 0),
        available: lanes.reduce((sum, lane) => sum + lane.availableRequests, 0),
    }

    return (
        <div className='w-full space-y-4'>
            <div className='grid w-full gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <SummaryCard title='RAM load' icon={<MemoryStick className='h-4 w-4' />} metric={totalLoad.ram} />
                <SummaryCard title='CPU load' icon={<Cpu className='h-4 w-4' />} metric={totalLoad.cpu} />
                <SummaryCard title='GPU load' icon={<HardDrive className='h-4 w-4' />} metric={totalLoad.gpu} />
                <ThroughputCard tps={totalLoad.tps} />
                <UsefulProgressCard />
                <CapacityCard active={capacity.active} available={capacity.available} max={capacity.max} lanes={lanes.length} />
                <PowerCard watts={power.watts} monthlyKwh={power.monthlyKwh} />
                <div className='rounded-lg bg-ui-panel p-4 border border-ui-border'>
                    <div className='flex items-center justify-between'>
                        <div>
                            <p className='text-xs font-medium uppercase tracking-[0.18em] text-ui-muted'>Active clients</p>
                            <h2 className='mt-2 text-2xl font-semibold text-ui-text'>{clients.length}</h2>
                        </div>
                        <div className='rounded-full bg-ui-primary/10 p-3 text-ui-primary border border-ui-primary/25'>
                            <Bot className='h-5 w-5' />
                        </div>
                    </div>
                    <p className='mt-3 text-sm text-ui-muted'>
                        Click any client card below to open its per-device RAM, CPU, and GPU metrics.
                    </p>
                </div>
            </div>

            <div className='w-full rounded-lg bg-ui-panel p-4 border border-ui-border space-y-4'>
                <div className='flex items-center justify-between'>
                    <h2 className='text-lg font-semibold text-ui-text'>Clients</h2>
                    <span
                        className='rounded-full bg-ui-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-ui-primary border border-ui-primary/25'
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
        <div className='rounded-lg bg-ui-panel p-4 border border-ui-border'>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>{title}</span>
                {icon}
            </div>
            <div className='mt-3 flex items-end justify-between gap-4'>
                <Metric metric={metric} size='lg' />
                <div className='h-2 flex-1 rounded-full bg-ui-border'>
                    <div
                        className='h-full rounded-full bg-ui-primary transition-[width]'
                        style={{ width: `${Math.min(metric, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    )
}

function ThroughputCard({ tps }: { tps: number }) {
    return (
        <div className='rounded-lg bg-ui-panel p-4 border border-ui-border'>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Throughput</span>
                <Gauge className='h-4 w-4' />
            </div>
            <div className='mt-3 flex items-end justify-between gap-4'>
                <span className='text-2xl font-semibold text-ui-text'>{tps.toFixed(1)} TPS</span>
                <div className='text-right text-xs uppercase tracking-[0.18em] text-ui-muted'>
                    Live generation
                </div>
            </div>
        </div>
    )
}

function UsefulProgressCard() {
    return (
        <div className='rounded-lg bg-ui-panel p-4 border border-ui-border'>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Useful progress</span>
                <Target className='h-4 w-4' />
            </div>
            <div className='mt-3 text-lg font-semibold leading-6 text-ui-text'>
                Verified progress / min / NOK
            </div>
            <p className='mt-2 text-xs leading-5 text-ui-muted'>
                Key metric: not "tokens/sec." For this product, it is verified useful project progress per minute per NOK.
            </p>
        </div>
    )
}

function CapacityCard({ active, available, max, lanes }: { active: number, available: number, max: number, lanes: number }) {
    return (
        <div className='rounded-lg bg-ui-panel p-4 border border-ui-border'>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Lane capacity</span>
                <Gauge className='h-4 w-4' />
            </div>
            <div className='mt-3 text-2xl font-semibold text-ui-text'>{available}/{max}</div>
            <div className='mt-1 text-xs uppercase tracking-[0.18em] text-ui-muted'>
                {active} active across {lanes} lanes
            </div>
        </div>
    )
}

function PowerCard({ watts, monthlyKwh }: { watts: number, monthlyKwh: number }) {
    return (
        <div className='rounded-lg bg-ui-panel p-4 border border-ui-border'>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>Power</span>
                <Zap className='h-4 w-4' />
            </div>
            <div className='mt-3 text-2xl font-semibold text-ui-text'>{watts.toFixed(0)} W</div>
            <div className='mt-1 text-xs uppercase tracking-[0.18em] text-ui-muted'>
                {monthlyKwh.toFixed(2)} kWh this month
            </div>
        </div>
    )
}
