import ServerRules from '../server-rules'
import { ruleCategories } from '../rule-categories'

export const metadata = { title: 'Match filter', description: ruleCategories.match.description }
export const dynamic = 'force-dynamic'

export default function Page() {
    return <ServerRules category='match' />
}
