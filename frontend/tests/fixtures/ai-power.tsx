import React from 'react'
import { createRoot } from 'react-dom/client'
import Content from '../../src/components/gpt/content'
const missing = new URLSearchParams(location.search).has('missing')
const client = {name:'Test worker',ram:[],cpu:[],gpu:[],lanes:[],model:{tps:0,currentTokens:0,contextTokens:0,contextMaxTokens:32768}, power:missing ? undefined : {totalWatts:461.5,monthlyKwh:1.25,sampledAt:new Date().toISOString()}} as GPT_Client
createRoot(document.getElementById('root')!).render(<Content clients={[client]} onTestClient={()=>{}} costPerBuildNok={12.5} />)
