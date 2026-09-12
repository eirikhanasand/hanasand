import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import VMAccess from '../../src/components/vms/vmAccess'
import useVMConnection from '../../src/components/vms/useVMConnection'

function Access({ name }: { name: string }) {
    const { connection, error, refresh } = useVMConnection(name, null)
    return <><VMAccess boxStyle='' boxTitleStyle='' connection={connection} error={error} /><button onClick={refresh}>Refresh access</button></>
}
function Fixture() {
    const [name, setName] = useState('first-vm')
    const [visible, setVisible] = useState(true)
    return <><button onClick={() => setName('second-vm')}>Switch VM</button><button onClick={() => setVisible(false)}>Unmount</button>{visible && <Access key={name} name={name} />}</>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
