import React from 'react'
import { createRoot } from 'react-dom/client'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import VMClient from '../../src/app/dashboard/vms/[...id]/clientPage'

document.cookie = 'id=fixture'
document.cookie = 'access_token=fixture'
const vm = { name: 'cashflow', status: 'RUNNING', owner: 'owner', access_users: [], last_checked: '2026-07-22T15:34:00Z', limits_cpu: '1', limits_memory: '2GB', primary_host: 'inspur' } as unknown as VM
const details = { ...vm, profiles: [], ephemeral: 'false', stateful: 'false', device_eth0_ipv4_address: '192.0.2.1' } as unknown as VMDetails
createRoot(document.getElementById('root')!).render(
    <AppRouterContext.Provider value={{ push() {} } as unknown as React.ContextType<typeof AppRouterContext>}>
        <VMClient vm={vm} details={details} metrics={[]} connection={null} />
    </AppRouterContext.Provider>
)
