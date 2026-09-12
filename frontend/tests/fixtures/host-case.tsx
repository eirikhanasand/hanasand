import { createRoot } from 'react-dom/client'
import { MonitoringCaseDetail } from '../../src/app/dashboard/cases/monitoring-case-detail'
createRoot(document.getElementById('root')!).render(<MonitoringCaseDetail caseId='HA-15' />)
