'use client'

import { Activity, ArrowLeftRight, Crown, Server } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import ErrorNotice from '@/components/error/errorNotice'
import { failoverVm, updateHostFeatures } from '@/utils/vms/fetch/updateHostFeatures'

type VMHostOptionsProps = {
    boxStyle: string
    boxTitleStyle: string
    vm: VM
    onUpdate: (vm: VM) => void
}

export default function VMHostOptions({ boxStyle, boxTitleStyle, vm, onUpdate }: VMHostOptionsProps) {
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState<'always' | 'failover' | 'swap' | null>(null)

    async function toggleAlwaysRunning() {
        setLoading('always')
        const result = await updateHostFeatures(vm.name, {
            always_running_enabled: !vm.always_running_enabled,
        })
        if (typeof result === 'string') {
            setMessage(result)
        } else {
            onUpdate(result)
            setMessage(result.always_running_enabled ? 'Always running is on.' : 'Always running is off.')
        }
        setLoading(null)
    }

    async function toggleFailover() {
        setLoading('failover')
        const result = await updateHostFeatures(vm.name, {
            failover_enabled: !vm.failover_enabled,
        })
        if (typeof result === 'string') {
            setMessage(result)
        } else {
            onUpdate(result)
            setMessage(result.failover_enabled ? 'Failover is on.' : 'Failover is off.')
        }
        setLoading(null)
    }

    async function runFailover() {
        setLoading('swap')
        const result = await failoverVm(vm.name)
        if (typeof result === 'string') {
            setMessage(result)
        } else {
            onUpdate(result.vm)
            setMessage(result.message)
        }
        setLoading(null)
    }

    return (
        <section className={`${boxStyle} grid gap-4`}>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h2 className={boxTitleStyle}>Host options</h2>
                    <p className='mt-1 text-xs text-ui-muted'>{vm.primary_host || 'ovhcloud'} primary{vm.failover_host ? `, ${vm.failover_host} standby` : ''}</p>
                </div>
                <Server className='h-4 w-4 text-ui-muted' />
            </div>
            <FeatureToggle
                title='Always running'
                description='Keep the host warm and restart it automatically if it drops.'
                icon={<Activity className='h-4 w-4' />}
                premium={vm.always_running_premium}
                enabled={vm.always_running_enabled}
                loading={loading === 'always'}
                onClick={toggleAlwaysRunning}
            />
            <FeatureToggle
                title='Failover'
                description='Keep a standby copy so the host can move between OVHcloud and Inspur.'
                icon={<ArrowLeftRight className='h-4 w-4' />}
                premium={vm.failover_premium}
                enabled={vm.failover_enabled}
                loading={loading === 'failover'}
                onClick={toggleFailover}
            />
            {vm.failover_enabled && vm.failover_host && (
                <button
                    type='button'
                    onClick={runFailover}
                    disabled={loading === 'swap'}
                    className='h-9 rounded-lg border border-ui-border bg-ui-raised px-3 text-left text-sm text-ui-text transition hover:bg-ui-panel disabled:cursor-wait disabled:opacity-55'
                >
                    Fail over to {vm.failover_host}
                </button>
            )}
            <ErrorNotice compact variant='info' message={message} />
        </section>
    )
}

function FeatureToggle({
    title,
    description,
    icon,
    premium,
    enabled,
    loading,
    onClick,
}: {
    title: string
    description: string
    icon: ReactNode
    premium: boolean
    enabled: boolean
    loading: boolean
    onClick: () => void
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            disabled={loading || !premium}
            className='grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 text-left transition hover:bg-ui-panel disabled:cursor-not-allowed disabled:opacity-60'
        >
            <span className='grid h-9 w-9 place-items-center rounded-md bg-ui-panel text-ui-muted'>{icon}</span>
            <span className='min-w-0'>
                <span className='flex items-center gap-2 text-sm font-medium text-ui-text'>
                    {title}
                    {!premium && <Crown className='h-3.5 w-3.5 text-ui-warning' />}
                </span>
                <span className='mt-0.5 block text-xs leading-5 text-ui-muted'>{premium ? description : 'Premium option'}</span>
            </span>
            <span className={`h-5 w-9 rounded-full p-0.5 transition ${enabled ? 'bg-ui-success/70' : 'bg-ui-border'}`}>
                <span className={`block h-4 w-4 rounded-full bg-ui-panel transition ${enabled ? 'translate-x-4' : ''}`} />
            </span>
        </button>
    )
}
