import { createRoot, hydrateRoot } from 'react-dom/client'
import DetectionRules, { type InitialRules } from '../../src/app/dashboard/mill/rules/detection-rules'
import type { RuleCategory } from '../../src/app/dashboard/mill/rules/rule-categories'
const root = document.getElementById('root')!
const initial = (window as typeof window & { initialRules?: InitialRules }).initialRules
const element = <DetectionRules category={location.pathname.split('/').pop() as RuleCategory} initial={initial} />
if (initial) hydrateRoot(root, element)
else createRoot(root).render(element)
