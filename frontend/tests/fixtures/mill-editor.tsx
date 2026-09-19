import React from 'react'
import { createRoot } from 'react-dom/client'
import RuleDetails from '../../src/app/dashboard/mill/rules/[id]/rule-details'
const id = location.pathname.split('/').pop() || 'auth.brute_force_success'
createRoot(document.getElementById('root')!).render(<RuleDetails id={id} organizationId='org-a' />)
