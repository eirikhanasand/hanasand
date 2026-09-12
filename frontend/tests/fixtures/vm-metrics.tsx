import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import VMMetrics from '../../src/components/vms/vmMetrics'
import useVMMetrics from '../../src/components/vms/useVMMetrics'
const empty: VMMetrics[] = []
function Metrics({ name }: { name: string }) {
    const { metrics, error } = useVMMetrics(name, empty)
    return <VMMetrics boxStyle='' boxTitleStyle='' vm={{ name } as VM} metrics={metrics} error={error} />
}
function Fixture() {
    const [name, setName] = useState('first-vm')
    const [visible, setVisible] = useState(true)
    return <><button onClick={() => setName('second-vm')}>Switch VM</button><button onClick={() => setVisible(false)}>Unmount</button>{visible && <Metrics name={name} />}</>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
