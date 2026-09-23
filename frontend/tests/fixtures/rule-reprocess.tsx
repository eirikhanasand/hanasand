import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import CreateRuleDialog from '../../src/app/dashboard/mill/rules/create-rule-dialog'
import ReprocessRule from '../../src/app/dashboard/mill/rules/reprocess-rule'
import type { MillRule } from '../../src/app/dashboard/mill/rules/detection-rules'
function App() {
    const [rule, setRule] = useState<MillRule | null>(() => JSON.parse(sessionStorage.getItem('test-rule') || 'null'))
    return <main className='mx-auto max-w-5xl p-4'>{rule ? <><h1 className='mb-4 text-xl'>{rule.name}</h1><ReprocessRule rule={rule} organizationId='platform' disabled={false} /></>
        : <CreateRuleDialog category='analysis' organizationId='platform' canManage canManageRetention rules={[]} onClose={() => {}} onCreated={value => { sessionStorage.setItem('test-rule', JSON.stringify(value)); setRule(value) }} />}</main>
}
createRoot(document.getElementById('root')!).render(<App />)
