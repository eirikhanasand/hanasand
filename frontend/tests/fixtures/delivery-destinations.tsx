import { createRoot } from 'react-dom/client'
import DeliveryClient from '../../src/app/dashboard/dwm/actions/deliveryClient'
createRoot(document.getElementById('root')!).render(<DeliveryClient scopeId='org-test' />)
