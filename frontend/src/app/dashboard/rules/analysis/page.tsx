import ServerRules from '../server-rules'
import { ruleCategories } from '../rule-categories'

export const metadata = { title: 'Analysis filter', description: ruleCategories.analysis.description }
export const dynamic = 'force-dynamic'

export default function Page() {
    return <ServerRules category='analysis' />
}
