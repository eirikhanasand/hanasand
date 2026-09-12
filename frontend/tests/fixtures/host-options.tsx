import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import VMHostOptions from '../../src/components/vms/vmHostOptions'
function Fixture() {
    const [vm, setVm] = useState({ name: 'demo-worker', primary_host: 'inspur', always_running_premium: false, always_running_enabled: false, failover_premium: false, failover_enabled: false } as VM)
    return <><VMHostOptions boxStyle='' boxTitleStyle='' vm={vm} onUpdate={setVm} /><button onClick={() => setVm({ ...vm, always_running_premium: true })}>Show purchased option</button></>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
