import DetectionRules from '../detection-rules'
import { ruleCategories } from '../rule-categories'

export const metadata = { title: 'Detection filter', description: ruleCategories.detection.description }
export const dynamic = 'force-dynamic'

export default function Page() {
    return <DetectionRules category='detection' />
}
