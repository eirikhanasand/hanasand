import React from 'react'
import { createRoot } from 'react-dom/client'
import defaultModelMetrics from '../../src/components/gpt/defaultModelMetrics'
import Content from '../../src/components/gpt/content'
const missing = new URLSearchParams(location.search).has('missing')
const client: GPT_Client = {name:'Test worker',ram:[],cpu:[],gpu:[],lanes:[],model:defaultModelMetrics(), power:missing ? undefined : {totalWatts:461.5,monthlyKwh:1.25,sampledAt:new Date().toISOString()}}
createRoot(document.getElementById('root')!).render(<Content clients={[client]} onTestClient={()=>{}} costPerBuildNok={12.5} />)
