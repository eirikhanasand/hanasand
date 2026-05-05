'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Cpu, Gauge, HardDrive, MemoryStick, MessageSquareText, Zap } from 'lucide-react'
import Button from '../misc/button'
import CPU from './cpu'
import GPU from './gpu'
import RAM from './ram'
import Metric from './metric'

export default function DisplayClient({
    client,
    onTestClient,
}: {
    client: GPT_Client
    onTestClient: (client: GPT_Client) => void
}) {
    const [open, setOpen] = useState(false)

    const stats = {
        ram: averageMetric(client.ram.map(ram => ram.load)),
        cpu: averageMetric(client.cpu.map(cpu => cpu.load)),
        gpu: averageMetric(client.gpu.map(gpu => gpu.load)),
    }
    const lanes = client.lanes || []
    const laneCapacity = {
        active: lanes.reduce((sum, lane) => sum + lane.activeRequests, 0),
        max: lanes.reduce((sum, lane) => sum + lane.maxRequests, 0),
        available: lanes.reduce((sum, lane) => sum + lane.availableRequests, 0),
    }

    return (
        <div
            className='w-full rounded-xl bg-dark/35 p-4 text-left outline outline-dark transition-colors hover:bg-dark/50'
        >
            <div className='flex flex-col gap-4'>
                <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                    <div>
                        <h3 className='text-lg font-semibold text-bright/90'>{client.name}</h3>
                        <p className='text-sm text-bright/50'>
                            {client.ram.length} RAM, {client.cpu.length} CPU, {client.gpu.length} GPU sensors
                        </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <Metric label='RAM' metric={stats.ram} />
                        <Metric label='CPU' metric={stats.cpu} />
                        <Metric label='GPU' metric={stats.gpu} />
                        <StatPill
                            label='TPS'
                            value={`${client.model.tps.toFixed(1)}`}
                            icon={<Gauge className='h-3.5 w-3.5' />}
                        />
                        <StatPill
                            label='Lanes'
                            value={`${laneCapacity.available}/${laneCapacity.max || lanes.length}`}
                            icon={<HardDrive className='h-3.5 w-3.5' />}
                        />
                        <StatPill
                            label='Power'
                            value={`${(client.power?.totalWatts || 0).toFixed(0)} W`}
                            icon={<Zap className='h-3.5 w-3.5' />}
                        />
                        <button
                            type='button'
                            onClick={() => setOpen(prev => !prev)}
                            className='flex h-9 w-9 items-center justify-center rounded-full bg-[#fd8738]/12 text-[#fd8738] outline outline-[#fd8738]/20'
                        >
                            {open ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
                        </button>
                    </div>
                </div>
                <div className='grid gap-3 border-t border-dark/80 pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'>
                    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                        <ModelStat title='Current tokens' value={client.model.currentTokens.toString()} />
                        <ModelStat title='Active requests' value={`${laneCapacity.active}/${laneCapacity.max}`} />
                        <ModelStat
                            title='Context'
                            value={`${client.model.contextTokens}/${lanes[0]?.contextMaxTokens || client.model.contextMaxTokens || 0}`}
                        />
                        <ModelStat title='Status' value={client.model.status} highlight={client.model.status} />
                    </div>
                    <div className='flex justify-start md:justify-end'>
                        <Button
                            text='Test client'
                            icon={<MessageSquareText className='h-4 w-4' />}
                            onClick={() => onTestClient(client)}
                        />
                    </div>
                </div>
                {open ? <Open client={client} /> : null}
            </div>
        </div>
    )
}

function Open({ client }: { client: GPT_Client }) {
    return (
        <div className='space-y-4 border-t border-dark/80 pt-4'>
            {(client.lanes || []).length ? (
                <MetricSection
                    title='Inference lanes'
                    icon={<Gauge className='h-4 w-4' />}
                    items={(client.lanes || []).map((lane) => <Lane key={lane.id} lane={lane} />)}
                />
            ) : null}
            <div className='grid gap-4 lg:grid-cols-3'>
            <MetricSection
                title='RAM'
                icon={<MemoryStick className='h-4 w-4' />}
                items={client.ram.map((ram, id) => <RAM key={`${ram.name}-${id}`} ram={ram} />)}
            />
            <MetricSection
                title='CPU'
                icon={<Cpu className='h-4 w-4' />}
                items={client.cpu.map((cpu, id) => <CPU key={`${cpu.name}-${id}`} cpu={cpu} />)}
            />
            <MetricSection
                title='GPU'
                icon={<HardDrive className='h-4 w-4' />}
                items={client.gpu.map((gpu, id) => <GPU key={`${gpu.name}-${id}`} gpu={gpu} />)}
            />
            </div>
        </div>
    )
}

function MetricSection({ title, icon, items }: { title: string, icon: ReactNode, items: ReactNode[] }) {
    return (
        <div className='rounded-xl bg-dark/25 p-4 outline outline-dark'>
            <div className='mb-3 flex items-center gap-2 text-bright/35'>
                {icon}
                <h4 className='text-sm font-semibold uppercase tracking-[0.18em]'>{title}</h4>
            </div>
            <div className='space-y-2'>
                {items.length ? items : <p className='text-sm text-bright/45'>No metrics reported.</p>}
            </div>
        </div>
    )
}

function StatPill({ label, value, icon }: { label: string, value: string, icon: ReactNode }) {
    return (
        <span
            className='inline-flex items-center gap-2 rounded-full bg-[#fd8738]/12 px-3 py-1 text-sm font-semibold text-bright/90 outline outline-[#fd8738]/20'
        >
            {icon}
            <span className='text-[10px] uppercase tracking-[0.18em] text-bright/35'>{label}</span>
            <span>{value}</span>
        </span>
    )
}

function ModelStat({ title, value, highlight }: { title: string, value: string, highlight?: string }) {
    const highlightClass = highlight === 'error'
        ? 'text-red-400'
        : highlight === 'generating'
            ? 'text-emerald-400'
            : highlight === 'preparing'
                ? 'text-yellow-400'
                : 'text-bright/90'

    return (
        <div className='rounded-xl bg-dark/20 px-3 py-2 outline outline-dark'>
            <div className='text-[10px] uppercase tracking-[0.18em] text-bright/35'>{title}</div>
            <div className={`mt-1 text-sm font-semibold ${highlightClass}`}>{value}</div>
        </div>
    )
}

function Lane({ lane }: { lane: GPT_ModelLaneMetrics }) {
    const memoryPercent = lane.memoryTotalMb > 0 ? Math.round(lane.memoryUsedMb / lane.memoryTotalMb * 100) : 0
    const capacityPercent = lane.maxRequests > 0 ? Math.round(lane.activeRequests / lane.maxRequests * 100) : 0

    return (
        <div className='rounded-xl bg-dark/20 p-3 outline outline-dark'>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                <div>
                    <div className='text-sm font-semibold text-bright/90'>Lane {lane.index + 1}</div>
                    <div className='mt-1 text-xs text-bright/45'>{lane.gpuName} • GPU {lane.gpuIndex}</div>
                </div>
                <div className='grid gap-2 sm:grid-cols-4 lg:min-w-[34rem]'>
                    <LaneMetric label='capacity' value={`${lane.availableRequests}/${lane.maxRequests}`} tone={capacityPercent < 75 ? 'ok' : 'warn'} />
                    <LaneMetric label='memory' value={`${memoryPercent}%`} tone={memoryPercent < 86 ? 'ok' : 'warn'} />
                    <LaneMetric label='power' value={`${lane.powerDrawWatts.toFixed(0)} W`} tone={lane.powerLimitWatts && lane.powerDrawWatts / lane.powerLimitWatts > 0.85 ? 'warn' : 'ok'} />
                    <LaneMetric label='temp' value={`${lane.temperatureC.toFixed(0)}°C`} tone={lane.temperatureC < 78 ? 'ok' : 'warn'} />
                </div>
            </div>
        </div>
    )
}

function LaneMetric({ label, value, tone }: { label: string, value: string, tone: 'ok' | 'warn' }) {
    return (
        <div className={`rounded-lg px-3 py-2 ${tone === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-yellow-500/10 text-yellow-300'}`}>
            <div className='text-[10px] uppercase tracking-[0.18em] text-current/70'>{label}</div>
            <div className='mt-1 text-sm font-semibold'>{value}</div>
        </div>
    )
}

function averageMetric(values: number[]) {
    if (!values.length) {
        return 0
    }

    return Math.ceil(values.reduce((sum, value) => sum + value, 0) / values.length * 100)
}
