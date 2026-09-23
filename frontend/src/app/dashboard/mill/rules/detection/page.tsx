import ServerRules from '../server-rules'
import { ruleCategories } from '../rule-categories'

export const metadata = { title: 'Detection filter', description: ruleCategories.detection.description }
export const dynamic = 'force-dynamic'

export default function Page() {
    return <ServerRules category='detection' />
}
