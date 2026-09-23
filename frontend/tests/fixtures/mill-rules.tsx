import { createRoot } from 'react-dom/client'
import DetectionRules from '../../src/app/dashboard/mill/rules/detection-rules'
import type { RuleCategory } from '../../src/app/dashboard/mill/rules/rule-categories'
createRoot(document.getElementById('root')!).render(<DetectionRules category={location.pathname.split('/').pop() as RuleCategory} />)
