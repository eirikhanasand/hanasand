import React from 'react'
import { createRoot } from 'react-dom/client'
import SessionsPanel from '../../src/components/profile/sessions'
document.cookie = 'id=session-fixture; path=/'
document.cookie = 'access_token=fixture-only; path=/'
createRoot(document.getElementById('root')!).render(<SessionsPanel isSelf />)
