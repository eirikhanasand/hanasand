import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import EvaluationBenchmarkClient from './evaluationBenchmarkClient'

export const dynamic = 'force-dynamic'

export default function TiEvaluationPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Extraction evaluation'
                description='Operational automatic evaluation over real retained evidence, with prediction-hidden model review, durable retries, independent adjudication, immutable labels, metrics, and drift.'
            />
            <EvaluationBenchmarkClient />
        </DashboardPage>
    )
}
